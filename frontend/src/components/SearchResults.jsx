/**
 * Search Results Component
 * 
 * This component renders the list of results returned by the search API.
 * Each result item displays the source file name, similarity score, and relevant text chunk.
 * Crucially, each result is clickable to trigger the interactive viewing experience.
 */
import { useState } from 'react';

const SearchResults = ({ results = [], onResultClick, isLoading = false, query = '' }) => {
  const [selectedResult, setSelectedResult] = useState(null);

  // Helper function to clean filename display
  const cleanFileName = (fileName) => {
    if (!fileName) return '';
    return fileName.replace(/^doc_\d+_/, '').replace(/\.pdf$/, '');
  };

  const handleResultClick = (result, index) => {
    setSelectedResult(index);
    console.log('Search result clicked:', result);
    onResultClick?.(result);
  };

  const formatScore = (score) => {
    // Convert to percentage and ensure it's between 0-100
    const percentage = Math.round(Math.max(0, Math.min(1, score)) * 100);
    return percentage;
  };

  const truncateText = (text, maxLength = 350) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const highlightQueryTerms = (text, query) => {
    if (!query || !text) return text;
    
    // Split query into individual terms
    const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    if (terms.length === 0) return text;
    
    let highlightedText = text;
    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });
    
    return highlightedText;
  };

  const getScoreColor = (score) => {
    const percentage = formatScore(score);
    if (percentage >= 80) return '#28a745'; // Green
    if (percentage >= 60) return '#ffc107'; // Yellow
    if (percentage >= 40) return '#fd7e14'; // Orange
    return '#dc3545'; // Red
  };

  const getScoreLabel = (score) => {
    const percentage = formatScore(score);
    if (percentage >= 80) return 'Excellent Match';
    if (percentage >= 60) return 'Good Match';
    if (percentage >= 40) return 'Fair Match';
    return 'Weak Match';
  };

  if (isLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e9ecef',
          borderTop: '4px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <h4 style={{ margin: '0 0 8px', color: '#007bff' }}>Searching...</h4>
        <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
          Finding relevant content in your documents
        </p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          backgroundColor: '#f8f9fa',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: '24px'
        }}>
          🔍
        </div>
        <h4 style={{ margin: '0 0 8px', color: '#6c757d' }}>
          {query ? 'No results found' : 'No search performed'}
        </h4>
        <p style={{ margin: 0, color: '#868e96', fontSize: '14px' }}>
          {query 
            ? `No documents match "${query}". Try different keywords.`
            : 'Enter a search query to find relevant content in your documents.'
          }
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* Search Results Header */}
      <div style={{ marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #e9ecef' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '600', color: '#343a40' }}>
          Search Results
        </h3>
        <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
          Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
        </p>
      </div>

      {/* Results List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {results.map((result, index) => {
          const isSelected = selectedResult === index;
          const scorePercentage = formatScore(result.score);
          const scoreColor = getScoreColor(result.score);
          
          return (
            <div
              key={`${result.document_id}-${index}`}
              onClick={() => handleResultClick(result, index)}
              style={{
                border: `2px solid ${isSelected ? '#007bff' : '#e9ecef'}`,
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                backgroundColor: isSelected ? '#f8f9fa' : 'white',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.target.style.borderColor = '#007bff';
                  e.target.style.backgroundColor = '#f8f9fa';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 2px 8px rgba(0,123,255,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.target.style.borderColor = '#e9ecef';
                  e.target.style.backgroundColor = 'white';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }
              }}
            >
              {/* Document Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ 
                    margin: '0 0 4px', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#007bff',
                    textDecoration: 'none'
                  }}>
                    📄 {cleanFileName(result.file_name) || `Document ${result.document_id}`}
                  </h4>
                  {(result.page_number !== undefined && result.page_number !== null) && (
                    <p style={{ 
                      margin: 0, 
                      fontSize: '12px', 
                      color: '#6c757d',
                      fontWeight: '500'
                    }}>
                      Page {result.page_number + 1}
                    </p>
                  )}
                </div>
                
                {/* Similarity Score */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    backgroundColor: scoreColor,
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    marginBottom: '2px'
                  }}>
                    {scorePercentage}%
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: scoreColor,
                    fontWeight: '500'
                  }}>
                    {getScoreLabel(result.score)}
                  </div>
                </div>
              </div>

              {/* Text Content */}
              <div style={{ marginBottom: '8px' }}>
                <p 
                  style={{ 
                    margin: 0, 
                    fontSize: '14px', 
                    lineHeight: '1.5',
                    color: '#495057'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: highlightQueryTerms(truncateText(result.text_chunk), query)
                  }}
                />
              </div>

              {/* Jump to Source Button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '12px',
                paddingTop: '8px',
                borderTop: '1px solid #e9ecef'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#868e96' }}>
                    {(result.page_number !== undefined && result.page_number !== null) 
                      ? `Jump to Page ${result.page_number + 1}` 
                      : 'Click to view in document'}
                  </span>
                  <div style={{
                    backgroundColor: isSelected ? '#007bff' : '#e9ecef',
                    color: isSelected ? 'white' : '#868e96',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: '500'
                  }}>
                    JUMP TO SOURCE
                  </div>
                </div>
                <span style={{ fontSize: '16px', color: isSelected ? '#007bff' : '#dee2e6' }}>
                  {isSelected ? '�' : '�'}
                </span>
              </div>

              {/* Selection Indicator */}
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  borderRadius: '0 6px 0 6px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  SELECTED
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Results Footer */}
      <div style={{ 
        marginTop: '16px', 
        paddingTop: '12px', 
        borderTop: '1px solid #e9ecef',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#868e96' }}>
          Click any result to navigate to the exact page in the document
        </p>
      </div>

      <style jsx>{`
        mark {
          background-color: #fff3cd;
          color: #856404;
          padding: 1px 2px;
          border-radius: 2px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default SearchResults;
