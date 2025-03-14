import { createClient } from 'redis';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let redis;
  try {
    // Initialize Redis connection
    redis = await createClient({ 
      url: process.env.REDIS_URL || process.env.KV_REST_API_URL,
      password: process.env.REDIS_PASSWORD || process.env.KV_REST_API_TOKEN,
    }).connect();

    // Get all keys matching the summary pattern, excluding timestamp keys
    const keys = (await redis.keys('summary:*')).filter(key => !key.endsWith(':savedAt'));
    
    // Get all summaries in parallel
    const summaries = await Promise.all(
      keys.map(async (key) => {
        const summary = await redis.get(key);
        const hnId = key.split(':')[1];
        const keywords = JSON.parse(await redis.get(`summary:${hnId}:keywords`) || '[]');
        return {
          id: hnId,
          summary,
          keywords,
          savedAt: await redis.get(`summary:${hnId}:savedAt`) || new Date().toISOString()
        };
      })
    );

    await redis.quit();
    res.status(200).json({ summaries });
  } catch (error) {
    console.error('Error fetching saved summaries:', error);
    if (redis) {
      await redis.quit();
    }
    res.status(500).json({ error: error.message });
  }
} 