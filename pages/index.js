import { useState } from 'react';
import {marked} from 'marked';
import Link from 'next/link';

export default function Home() {
  const [hnId, setHnId] = useState('');
  const [summary, setSummary] = useState('');
  const [loadingState, setLoadingState] = useState('idle'); // 'idle' | 'fetching_hn' | 'generating'
  const [error, setError] = useState('');
  const [isFromCache, setIsFromCache] = useState(false);

  const handleSummarize = async () => {
    setLoadingState('fetching_hn');
    setError('');
    setIsFromCache(false);
    const id = hnId.match(/(?:id=)?(\d+)/)?.[1]; 
    
    try {
      // Fetch HN data
      const hnRes = await fetch(`https://hn.algolia.com/api/v1/items/${id}`);
      if (!hnRes.ok) {
        throw new Error('Failed to fetch HN data');
      }
      const hnData = await hnRes.json();

      // Process comments
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

      // Update loading state for LLM processing
      setLoadingState('generating');

      // Send data to API for article extraction and summarization
      const response = await fetch(`/api/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleUrl: hnData.url || '',
          comments: comments.join('\n').substring(0, 3000),
          hnId: id
        })
      });
      
      if (!response.ok) throw new Error('Failed to summarize');
      const data = await response.json();
      setSummary(marked.parse(data.summary));
      setIsFromCache(data.fromCache);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingState('idle');
    }
  };

  const getButtonText = () => {
    switch (loadingState) {
      case 'fetching_hn':
        return 'Fetching HN data...';
      case 'generating':
        return 'Generating summary...';
      default:
        return 'Go';
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>HN Summarizer</h1>
        <Link href="/saved" className="saved-link">
          View Saved Summaries
        </Link>
      </div>
      <div className="input-group">
        <input
          type="text"
          value={hnId}
          onChange={(e) => setHnId(e.target.value)}
          placeholder="Enter Hacker News Item ID or URL"
        />
        <button 
          onClick={handleSummarize}
          disabled={loadingState !== 'idle'}
        >
          {getButtonText()}
        </button>
      </div>
      
      {error && <div className="error">{error}</div>}
      {loadingState !== 'idle' && (
        <div className="status-indicator">
          <div className={`loading-dot ${loadingState}`} />
          <span>
            {loadingState === 'fetching_hn' 
              ? 'Fetching data from Hacker News...' 
              : 'Generating summary with AI...'}
          </span>
        </div>
      )}
      {summary && (
        <>
          {isFromCache && (
            <div className="cache-indicator">
              ⚡ Loaded from cache
            </div>
          )}
          <div 
            className="summary" 
            dangerouslySetInnerHTML={{ __html: summary }} 
          />
        </>
      )}

      <style jsx>{`
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .saved-link {
          color: #0369a1;
          text-decoration: none;
          padding: 8px 16px;
          border-radius: 4px;
          background: #f0f9ff;
          transition: all 0.2s;
        }
        .saved-link:hover {
          background: #e0f2fe;
        }
        .status-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 20px 0;
          padding: 10px;
          background: #f5f5f5;
          border-radius: 4px;
        }
        .loading-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }
        .loading-dot.fetching_hn {
          background: #ff6600;  /* HN orange */
        }
        .loading-dot.generating {
          background: #10a37f;  /* OpenAI green */
        }
        .cache-indicator {
          display: inline-block;
          margin: 10px 0;
          padding: 4px 8px;
          background: #f0f9ff;
          color: #0369a1;
          border-radius: 4px;
          font-size: 14px;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
