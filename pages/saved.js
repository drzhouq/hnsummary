import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { marked } from 'marked';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function SavedSummaries() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedKeywords, setSelectedKeywords] = useState([]);

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

  // Get all dates that have summaries
  const datesWithSummaries = useMemo(() => {
    return summaries.reduce((dates, summary) => {
      const date = new Date(summary.savedAt).toISOString().split('T')[0];
      dates[date] = true;
      return dates;
    }, {});
  }, [summaries]);

  // Get all unique keywords from summaries
  const allKeywords = useMemo(() => {
    const keywordSet = new Set();
    summaries.forEach(summary => {
      summary.keywords?.forEach(keyword => keywordSet.add(keyword));
    });
    return Array.from(keywordSet).sort();
  }, [summaries]);

  // Filter summaries based on search text, selected date, and keywords
  const filteredSummaries = useMemo(() => {
    return summaries.filter(item => {
      const matchesSearch = searchText === '' || 
        item.summary.toLowerCase().includes(searchText.toLowerCase());
      
      const matchesDate = !selectedDate || 
        new Date(item.savedAt).toISOString().split('T')[0] === 
        selectedDate.toISOString().split('T')[0];

      const matchesKeywords = selectedKeywords.length === 0 ||
        selectedKeywords.every(keyword => item.keywords?.includes(keyword));

      return matchesSearch && matchesDate && matchesKeywords;
    });
  }, [summaries, searchText, selectedDate, selectedKeywords]);

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

      <div className="filters">
        <div className="search-and-keywords">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search summaries..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="keywords-filter">
            <div className="keywords-label">Filter by keywords:</div>
            <div className="keywords-list">
              {allKeywords.map(keyword => (
                <button
                  key={keyword}
                  onClick={() => {
                    setSelectedKeywords(prev => 
                      prev.includes(keyword)
                        ? prev.filter(k => k !== keyword)
                        : [...prev, keyword]
                    );
                  }}
                  className={`keyword-tag ${selectedKeywords.includes(keyword) ? 'selected' : ''}`}
                >
                  {keyword}
                </button>
              ))}
            </div>
            {selectedKeywords.length > 0 && (
              <button 
                className="clear-keywords"
                onClick={() => setSelectedKeywords([])}
              >
                Clear Keywords
              </button>
            )}
          </div>
        </div>
        
        <div className="calendar-wrapper">
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            tileClassName={({ date }) => {
              const dateStr = date.toISOString().split('T')[0];
              return datesWithSummaries[dateStr] ? 'has-summaries' : '';
            }}
          />
          {selectedDate && (
            <button 
              className="clear-date"
              onClick={() => setSelectedDate(null)}
            >
              Clear Date Filter
            </button>
          )}
        </div>
      </div>

      {filteredSummaries.length === 0 ? (
        <p>No matching summaries found.</p>
      ) : (
        <div className="summaries-list">
          {filteredSummaries
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
            .map((item) => (
            <div key={item.id} className="summary-card">
              <div className="summary-header">
                <div className="links">
                  <Link 
                    href={`https://news.ycombinator.com/item?id=${item.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hn-link"
                  >
                    HN Discussion
                  </Link>
                  {item.articleUrl && (
                    <>
                      <span className="link-separator">•</span>
                      <Link 
                        href={item.articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="article-link"
                      >
                        Original Article
                      </Link>
                    </>
                  )}
                </div>
                <span className="date">
                  {new Date(item.savedAt).toLocaleDateString()}
                </span>
              </div>
              {item.keywords && item.keywords.length > 0 && (
                <div className="summary-keywords">
                  {item.keywords.map(keyword => (
                    <span key={keyword} className="keyword-tag">{keyword}</span>
                  ))}
                </div>
              )}
              <div 
                className="summary prose" 
                dangerouslySetInnerHTML={{ 
                  __html: marked.parse(item.summary || '') 
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
        .filters {
          display: grid;
          grid-template-columns: minmax(400px, 2fr) auto;
          gap: 2rem;
          margin-bottom: 2rem;
          align-items: start;
        }
        .search-and-keywords {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .keywords-filter {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .keywords-label {
          font-weight: 500;
          color: #666;
        }
        .keywords-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .keyword-tag {
          padding: 0.25rem 0.75rem;
          background: #f0f9ff;
          color: #0369a1;
          border: 1px solid #e0f2fe;
          border-radius: 9999px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .keyword-tag.selected {
          background: #0369a1;
          color: white;
          border-color: #0369a1;
        }
        .keyword-tag:hover {
          background: #e0f2fe;
        }
        .keyword-tag.selected:hover {
          background: #0284c7;
        }
        .clear-keywords {
          align-self: flex-start;
          padding: 0.5rem 1rem;
          background: #f0f0f0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
        }
        .clear-keywords:hover {
          background: #e0e0e0;
        }
        .summary-keywords {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin: 0.5rem 0 1rem;
        }
        .summary-keywords .keyword-tag {
          cursor: default;
        }
        .summary-keywords .keyword-tag:hover {
          background: #f0f9ff;
        }
        .calendar-wrapper {
          width: 350px;
          max-width: 100%;
        }
        .clear-date {
          margin-top: 0.5rem;
          padding: 0.5rem 1rem;
          background: #f0f0f0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          width: 100%;
        }
        .clear-date:hover {
          background: #e0e0e0;
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
        .links {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .link-separator {
          color: #666;
        }
        .hn-link, .article-link {
          color: #0369a1;
          text-decoration: none;
          font-size: 0.9rem;
        }
        .hn-link:hover, .article-link:hover {
          text-decoration: underline;
        }
        .date {
          color: #666;
          font-size: 0.9rem;
        }
        @media (max-width: 768px) {
          .filters {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <style jsx global>{`
        .react-calendar {
          width: 350px;
          max-width: 100%;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1rem;
          font-family: inherit;
          color: #333;
        }
        .react-calendar__navigation button {
          color: #333;
          font-weight: bold;
          font-size: 1rem;
        }
        .react-calendar__navigation button:enabled:hover,
        .react-calendar__navigation button:enabled:focus {
          background-color: #f0f0f0;
        }
        .react-calendar__month-view__weekdays {
          font-weight: bold;
          color: #333;
        }
        .react-calendar__tile {
          padding: 0.75em 0.5em;
          color: #333;
          font-size: 0.95rem;
        }
        .react-calendar__tile:enabled:hover,
        .react-calendar__tile:enabled:focus {
          background-color: #f0f0f0;
        }
        .react-calendar__tile.has-summaries {
          background-color: #ff660020;
          font-weight: bold;
          color: #333;
        }
        .react-calendar__tile.has-summaries:hover,
        .react-calendar__tile.has-summaries:enabled:focus {
          background-color: #ff660040;
        }
        .react-calendar__tile--active {
          background: #ff6600 !important;
          color: white !important;
        }
        .react-calendar__tile--active:enabled:hover,
        .react-calendar__tile--active:enabled:focus {
          background: #ff6600 !important;
        }
        .react-calendar__month-view__days__day--weekend {
          color: #d10000;
        }
        .react-calendar__month-view__days__day--neighboringMonth {
          color: #757575;
        }
      `}</style>
    </div>
  );
} 