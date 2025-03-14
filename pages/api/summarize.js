import { Configuration, OpenAIApi } from 'openai';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { createClient } from 'redis';

const config = new Configuration({
  apiKey: process.env.OPENAI_KEY,
});
const openai = new OpenAIApi(config);

// Initialize Redis client
const getRedisClient = async () => {
  const client = createClient({
    url: process.env.REDIS_URL || process.env.KV_REST_API_URL,
    password: process.env.REDIS_PASSWORD || process.env.KV_REST_API_TOKEN,
  });
  await client.connect();
  return client;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let redis;
  try {
    const { articleUrl, comments, hnId } = req.body;

    if (!hnId) {
      return res.status(400).json({ error: 'HN ID is required' });
    }

    // Initialize Redis connection first
    redis = await createClient({ 
      url: process.env.REDIS_URL || process.env.KV_REST_API_URL,
      password: process.env.REDIS_PASSWORD || process.env.KV_REST_API_TOKEN,
    }).connect();

    // Check cache first before doing any other operations
    const cached = await redis.get(`summary:${hnId}`);
    if (cached) {
      await redis.quit();
      return res.status(200).json({ summary: cached, fromCache: true });
    }

    // If not in cache, proceed with fetching and summarizing
    let articleText = '';
    if (articleUrl) {
      try {
        const articleRes = await fetch(articleUrl);
        if (articleRes.ok) {
          const html = await articleRes.text();
          const dom = new JSDOM(html);
          const reader = new Readability(dom.window.document);
          articleText = reader.parse()?.textContent || '';
        }
      } catch (error) {
        console.error('Error fetching article:', error);
        // Continue with empty article text if fetch fails
      }
    }

    const prompt = `Summarize the Hacker News submission:
    
    Article: ${articleText.substring(0, 6000)}
    
    Comments: ${comments}
    
    Please provide:
    1. Keywords/Tags (5-7 relevant keywords separated by commas)
    2. Summary:
    - 3 paragraph article summary
    - Key discussion themes with markdown headers
    - Direct quotes with attribution
    - All mentioned URLs as markdown links`;

    const gptResponse = await openai.createChatCompletion({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 1.0,
      max_tokens: 9500
    });

    const response = gptResponse.data.choices[0].message.content;
    
    // Extract keywords and summary
    const [keywordsSection, ...rest] = response.split('\n\n');
    const keywords = keywordsSection.replace(/^.*?:/, '').trim().split(',').map(k => k.trim());
    const summary = rest.join('\n\n');

    // Cache the summary and keywords if we have an HN ID
    if (hnId) {
      await redis.set(`summary:${hnId}`, summary);
      await redis.set(`summary:${hnId}:keywords`, JSON.stringify(keywords));
      await redis.set(`summary:${hnId}:savedAt`, new Date().toISOString());
      if (articleUrl) {
        await redis.set(`summary:${hnId}:articleUrl`, articleUrl);
        await redis.expire(`summary:${hnId}:articleUrl`, 60 * 60 * 24 * 30);
      }
      // Set expiration to 30 days
      await redis.expire(`summary:${hnId}`, 60 * 60 * 24 * 30);
      await redis.expire(`summary:${hnId}:keywords`, 60 * 60 * 24 * 30);
      await redis.expire(`summary:${hnId}:savedAt`, 60 * 60 * 24 * 30);
    }

    // Close Redis connection
    await redis.quit();

    res.status(200).json({
      summary,
      keywords,
      fromCache: false
    });

  } catch (error) {
    console.error('Error in summarize API:', error);
    // Ensure Redis connection is closed even if there's an error
    if (redis) {
      await redis.quit();
    }
    res.status(500).json({
      error: error.message
    });
  }
}
