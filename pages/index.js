import { useState } from 'react';
import {marked} from 'marked';
export default function Home() {
  const [hnId, setHnId] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSummarize = async () => {
    setLoading(true);
    setError('');
    const id = hnId.match(/(?:id=)?(\d+)/)?.[1]; 
    try {
      const response = await fetch(`/api/summarize?id=${id}`);
      if (!response.ok) throw new Error('Failed to summarize');
      
      const data = await response.json();
      setSummary(marked.parse(data.summary));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>HN Summarizer</h1>
      <div className="input-group">
        <input
          type="text"
          value={hnId}
          onChange={(e) => setHnId(e.target.value)}
          placeholder="Enter Hacker News Item ID or URL"
        />
        <button 
          onClick={handleSummarize}
          disabled={loading}
        >
          {loading ? 'Summarizing...' : 'Go'}
        </button>
      </div>
      
      {error && <div className="error">{error}</div>}
      <div 
        className="summary" 
        dangerouslySetInnerHTML={{ __html: summary }} 
      />
    </div>
  );
}
