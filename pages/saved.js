import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { marked } from 'marked';

export default function SavedSummaries() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const response = await fetch('/api/saved-summaries');
        const data = await response.json();
        if (response.ok) {
          setSummaries(data.summaries);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError('Failed to fetch summaries');
      } finally {
        setLoading(false);
      }
    };

    fetchSummaries();
  }, []);

  if (loading) {
    return (
      <div className="container">
        <h1>Loading saved summaries...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <Head>
        <title>Saved Summaries - HN Summarizer</title>
      </Head>

      <div className="header">
        <h1>Saved Summaries</h1>
        <Link href="/" className="saved-link">
          Back to Home
        </Link>
      </div>

      {summaries.length === 0 ? (
        <p>No saved summaries yet.</p>
      ) : (
        <div className="summaries-list">
          {summaries.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)).map((item) => (
            <div key={item.id} className="summary-card">
              <div className="summary-header">
                <Link 
                  href={`https://news.ycombinator.com/item?id=${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hn-link"
                >
                  HN Discussion #{item.id}
                </Link>
                <span className="date">
                  {new Date(item.savedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="summary prose" 
                dangerouslySetInnerHTML={{ 
                  __html: marked.parse(item.summary) 
                }} 
              />
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .summaries-list {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        .summary-card {
          background: white;
          border: 1px solid #eee;
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .hn-link {
          color: #ff6600;
          text-decoration: none;
        }
        .hn-link:hover {
          text-decoration: underline;
        }
        .date {
          color: #666;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
} 