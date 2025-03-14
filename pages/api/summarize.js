import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { Configuration, OpenAIApi } from 'openai';

const config = new Configuration({
  apiKey: process.env.OPENAI_KEY,
});
const openai = new OpenAIApi(config);

export default async function handler(req, res) {
//  console.log('Received request with query:', req.query);
 // console.log(config);

  const { id } = req.query;
  if (!id) {
    console.error('Missing Hacker News ID');
    return res.status(400).json({ error: 'Missing Hacker News ID' });
  }

  try {
    //console.log('Fetching HN data for ID:', id);
    const hnRes = await fetch(`https://hn.algolia.com/api/v1/items/${id}`);
    if (!hnRes.ok) {
      console.error('Failed to fetch HN data:', hnRes.status, hnRes.statusText);
      return res.status(500).json({ error: 'Failed to fetch HN data' });
    }

    const hnData = await hnRes.json();
    //console.log('Fetched HN data:', hnData);

    let articleText = '';
    if (hnData.url) {
      //console.log('Fetching article content from:', hnData.url);
      const articleRes = await fetch(hnData.url);
      if (!articleRes.ok) {
        console.error('Failed to fetch article content:', articleRes.status, articleRes.statusText);
        return res.status(500).json({ error: 'Failed to fetch article content' });
      }

      const html = await articleRes.text();
      const dom = new JSDOM(html);
      const reader = new Readability(dom.window.document);
      articleText = reader.parse()?.textContent || '';
      //console.log('Extracted article content:', articleText.substring(0, 100) + '...');
    }

    const comments = [];
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = new Map();

    function processComments(children) {
      children.forEach(child => {
        if (child.text) {
          const text = `${child.author}: ${child.text}`;
          comments.push(text);
          
          const matches = child.text.match(urlRegex) || [];
          matches.forEach(url => {
            const cleanUrl = url.replace(/[.,]+$/, '');
            urls.set(cleanUrl, urls.get(cleanUrl)?.add(child.author) || new Set([child.author]));
          });
        }
        if (child.children) processComments(child.children);
      });
    }

    processComments(hnData.children);
    //console.log('Processed comments:', comments.length);

    const prompt = `Summarize the Hacker News submission:
    
    Article: ${articleText.substring(0, 6000)}
    
    Comments: ${comments.join('\n').substring(0, 3000)}
    
    Include:
    - 3 paragraph article summary
    - Key discussion themes with markdown headers
    - Direct quotes with attribution
    - All mentioned URLs as markdown links`;

    console.log('Sending prompt to OpenAI:', prompt.substring(0, 100) + '...');
    const gptResponse = await openai.createChatCompletion({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 1.0,
      max_tokens: 9500
    });

    console.log('Received response from OpenAI');
    //console.log(gptResponse.data.choices[0].message); 
    res.status(200).json({
      summary: gptResponse.data.choices[0].message.content
    });

  } catch (error) {
    console.error('Error in summarize API:', error);
    res.status(500).json({
      error: error.message
    });
  }
}
