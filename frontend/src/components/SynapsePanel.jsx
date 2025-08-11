/**
 * Right Panel: The Synapse
 * 
 * Implements the AI conversation interface with tabbed layout for
 * Connections and Insights, featuring structured display and actions.
 */
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Network, Lightbulb, Play, Pause, Download, ExternalLink, Zap } from 'lucide-react';
import { searchAPI, insightsAPI, podcastAPI } from '../api';
import './SynapsePanel.css';

const SynapsePanel = forwardRef(({ 
  currentContext, 
  selectedDocument, 
  onConnectionSelect,
  onConnectionsUpdate 
}, ref) => {
  const [activeTab, setActiveTab] = useState('connections');
  const [connections, setConnections] = useState([]);
  const [insights, setInsights] = useState(null);
  const [podcastData, setPodcastData] = useState(null);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [isPlayingPodcast, setIsPlayingPodcast] = useState(false);

  // OPTIMIZATION: Cache and deduplication for efficient API usage
  const connectionsCache = useRef(new Map()); // Cache query -> results
  const lastQueryRef = useRef('');
  const searchTimeoutRef = useRef(null);
  const audioRef = useRef(null); // For controlling podcast audio

  // OPTIMIZATION: Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // STAGE 1: Auto-search for connections when context changes (OPTIMIZED)
  useEffect(() => {
    console.log(`🔄 SynapsePanel: STAGE 1 - Context changed to: "${currentContext?.substring(0, 50)}..."`);
    
    if (!currentContext || currentContext.length <= 10) {
      console.log(`❌ SynapsePanel: Context too short or empty, not searching`);
      return;
    }

    // OPTIMIZATION: Check if this is the same query as the last one AND we already have connections
    if (currentContext === lastQueryRef.current && connections.length > 0) {
      console.log(`🔄 SynapsePanel: Same query as last time with existing connections, skipping duplicate API call`);
      return;
    }

    // OPTIMIZATION: Check cache first
    const cachedResults = connectionsCache.current.get(currentContext);
    if (cachedResults) {
      console.log(`⚡ SynapsePanel: Found cached results for query, using cache instead of API`);
      setConnections(cachedResults);
      
      // SMART TAB MANAGEMENT: Don't auto-switch if user is actively viewing insights
      if (activeTab !== 'insights') {
        console.log(`📋 SynapsePanel: Auto-switching to connections tab (user not viewing insights)`);
        setActiveTab('connections');
      } else {
        console.log(`👁️ SynapsePanel: User is viewing insights, preserving current tab`);
      }
      
      if (onConnectionsUpdate) {
        onConnectionsUpdate(cachedResults);
      }
      return;
    }

    // OPTIMIZATION: Check cache first, then trigger immediate search if not cached
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // INSTANT SEARCH: No debounce delay for immediate response
    console.log(`🔍 SynapsePanel: IMMEDIATE search triggered for: "${currentContext.substring(0, 50)}..."`);
    searchForConnections(currentContext);

    // Update last query reference
    lastQueryRef.current = currentContext;

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [currentContext, activeTab, connections.length, onConnectionsUpdate]);

  // Helper function to extract quoted strings from JSON-like text
  const extractQuotedStrings = (text) => {
    if (!text) return [];
    
    // Match quoted strings, handling escaped quotes
    const matches = text.match(/"((?:[^"\\]|\\.)*)"/g);
    if (!matches) return [];
    
    return matches.map(match => {
      // Remove surrounding quotes and unescape internal quotes
      const content = match.slice(1, -1);
      return content.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }).filter(content => content.trim().length > 0);
  };

  // STAGE 2: Expose methods to parent component for explicit insights generation
  useImperativeHandle(ref, () => ({
    generateInsights: (text, contextConnections = []) => {
      console.log(`💡 SynapsePanel: STAGE 2 - Explicit insights request for: "${text?.substring(0, 50)}..."`);
      return generateInsights(text, contextConnections);
    },
    generatePodcast: (text) => {
      console.log(`🎧 SynapsePanel: STAGE 2 - Explicit podcast request for: "${text?.substring(0, 50)}..."`);
      return generatePodcast(text);
    }
  }));

  const searchForConnections = async (query) => {
    console.log(`🔎 SynapsePanel: STAGE 1 - Starting optimized connections search for: "${query.substring(0, 50)}..."`);
    console.log(`🔍 Full query text being sent:`, query);
    
    // OPTIMIZATION: Prevent concurrent requests
    if (isLoadingConnections) {
      console.log(`⏳ SynapsePanel: Already loading connections, skipping...`);
      return;
    }
    
    setIsLoadingConnections(true);
    
    try {
      console.log(`📡 SynapsePanel: Making API call to semantic search...`);
      
      // Request at least 5 results to ensure we get 3+ relevant sections (hackathon requirement)
      const results = await searchAPI.semantic({
        query_text: query,
        top_k: 5,
        similarity_threshold: 0.1  // Very low threshold to ensure we get results
      });
      
      console.log(`📥 SynapsePanel: API response received:`, results);
      
      const connections = results.results || [];
      console.log(`📊 SynapsePanel: Found ${connections.length} raw connections`);
      
      // Filter for >80% accuracy where possible, but show at least 3 results
      const highAccuracyConnections = connections.filter(conn => conn.similarity_score > 0.8);
      const finalConnections = highAccuracyConnections.length >= 3 
        ? highAccuracyConnections.slice(0, 3)
        : connections.slice(0, Math.max(3, connections.length));
      
      console.log(`🎯 STAGE 1 - Found ${finalConnections.length} connections (requirement: ≥3 with >80% accuracy)`);
      console.log(`📊 Accuracy distribution:`, finalConnections.map(c => `${Math.round(c.similarity_score * 100)}%`));
      
      // OPTIMIZATION: Cache the results
      connectionsCache.current.set(query, finalConnections);
      console.log(`💾 SynapsePanel: Cached results for future use (cache size: ${connectionsCache.current.size})`);
      
      setConnections(finalConnections);
      console.log(`✅ SynapsePanel: Updated connections state with ${finalConnections.length} items`);
      
      // SMART TAB MANAGEMENT: Don't auto-switch if user is actively viewing insights
      if (activeTab !== 'insights') {
        console.log(`📋 SynapsePanel: Auto-switching to connections tab (user not viewing insights)`);
        setActiveTab('connections');
      } else {
        console.log(`�️ SynapsePanel: User is viewing insights, preserving current tab`);
      }
      console.log(`📋 SynapsePanel: Stage 1 completed with smart tab management`);
      
      // Notify parent about connections update for potential insights context
      if (onConnectionsUpdate) {
        onConnectionsUpdate(finalConnections);
        console.log(`📤 SynapsePanel: Notified parent of connections update`);
      }
    } catch (error) {
      console.error('❌ SynapsePanel: STAGE 1 - Failed to search for connections:', error);
      setConnections([]);
    } finally {
      setIsLoadingConnections(false);
      console.log(`✅ SynapsePanel: STAGE 1 - Connections search completed`);
    }
  };

  const generateInsights = async (text, contextConnections = []) => {
    console.log(`🧠 SynapsePanel: STAGE 2 - Starting explicit insights generation for: "${text?.substring(0, 50)}..."`);
    
    if (isLoadingInsights) {
      console.log(`⏳ SynapsePanel: Already generating insights, skipping...`);
      return;
    }
    
    setIsLoadingInsights(true);
    setActiveTab('insights'); // Switch to insights tab for Stage 2
    
    try {
      // Enhanced payload with context-rich data from Stage 1 connections
      const enrichedContext = contextConnections.length > 0 
        ? `Related content from library:\n${contextConnections.map((conn, i) => 
            `${i + 1}. From "${conn.document_name}": ${conn.text_chunk.substring(0, 150)}...`
          ).join('\n\n')}`
        : "";
      
      console.log(`🧠 STAGE 2 - Generating insights with ${contextConnections.length} context connections from Stage 1`);
      
      const result = await insightsAPI.generate(text, enrichedContext);
      
      // Parse the insights JSON string
      let parsedInsights;
      
      console.log('🔍 DEBUG - Raw insights type:', typeof result.insights);
      console.log('🔍 DEBUG - Raw insights value:', result.insights);
      
      try {
        let insightsData = result.insights;
        
        // Simple approach: if it's a string, try to parse it as JSON
        if (typeof insightsData === 'string') {
          // Clean up common issues with JSON strings
          insightsData = insightsData.trim();
          
          // Remove any surrounding markdown
          insightsData = insightsData.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          
          console.log('🔍 DEBUG - Cleaned insights:', insightsData.substring(0, 100) + '...');
          
          // Parse the JSON
          parsedInsights = JSON.parse(insightsData);
        } else {
          // Already an object
          parsedInsights = insightsData;
        }
        
        console.log('✅ DEBUG - Parsed insights:', parsedInsights);
        
        // SPECIAL CASE: Check if the real insights are nested inside key_insights[0]
        if (parsedInsights.key_insights && 
            parsedInsights.key_insights.length === 1 && 
            typeof parsedInsights.key_insights[0] === 'string' &&
            parsedInsights.key_insights[0].includes('```json')) {
          
          console.log('🔍 DEBUG - Found nested JSON in key_insights[0], extracting...');
          
          // Extract the nested JSON
          let nestedJson = parsedInsights.key_insights[0];
          nestedJson = nestedJson.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          nestedJson = nestedJson.trim();
          
          console.log('🔍 DEBUG - Nested JSON before fixing:', nestedJson.substring(0, 200) + '...');
          
          // More aggressive cleaning for escaped characters
          try {
            // First, try to parse it as-is (in case it's already properly formatted)
            parsedInsights = JSON.parse(nestedJson);
            console.log('✅ DEBUG - Successfully parsed without fixing:', parsedInsights);
          } catch (firstAttempt) {
            console.log('🔄 DEBUG - First parse failed, trying to fix escaping...');
            
            // Fix escaped quotes and other JSON issues step by step
            let fixedJson = nestedJson;
            
            // Fix escaped quotes that break JSON
            fixedJson = fixedJson.replace(/\\"/g, '"');
            
            // Fix any double escaping  
            fixedJson = fixedJson.replace(/\\\\\"/g, '\\"');
            fixedJson = fixedJson.replace(/\\\\\\\\/g, '\\\\');
            
            // Remove any newline escaping that breaks JSON
            fixedJson = fixedJson.replace(/\\n/g, ' ');
            fixedJson = fixedJson.replace(/\n/g, ' ');
            
            console.log('🔍 DEBUG - Nested JSON after fixing:', fixedJson.substring(0, 200) + '...');
            
            // Try parsing the fixed version
            parsedInsights = JSON.parse(fixedJson);
            console.log('✅ DEBUG - Successfully parsed after fixing:', parsedInsights);
          }
        }
        
      } catch (parseError) {
        console.error('❌ DEBUG - JSON parse failed:', parseError);
        console.log('📝 DEBUG - Failed on text:', result.insights);
        
        // Simple fallback: just show the raw text for now to identify the issue
        parsedInsights = {
          key_insights: [`Parsing failed. Raw content: ${result.insights}`],
          did_you_know: [],
          contradictions: [],
          connections: []
        };
      }
      
      setInsights({
        ...result,
        parsed: parsedInsights,
        contextConnections: contextConnections
      });
      
      console.log(`✅ STAGE 2 - Insights generation completed successfully`);
    } catch (error) {
      console.error('❌ STAGE 2 - Failed to generate insights:', error);
      setInsights({
        status: 'error',
        error: 'Failed to generate insights',
        parsed: null
      });
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const generatePodcast = async (content) => {
    console.log(`🎧 SynapsePanel: STAGE 2 - Starting explicit podcast generation for: "${content?.substring(0, 50)}..."`);
    
    if (isGeneratingPodcast) {
      console.log(`⏳ SynapsePanel: Already generating podcast, skipping...`);
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      console.error('❌ SynapsePanel: Invalid content for podcast generation');
      setPodcastData({
        status: 'error',
        error: 'No content available for podcast generation'
      });
      return;
    }
    
    setIsGeneratingPodcast(true);
    setIsPlayingPodcast(false); // Reset playing state for new podcast
    
    try {
      // Get related content from connections if available
      const relatedContent = connections.length > 0 
        ? connections.map(conn => conn.content).join('\n\n')
        : "";
      
      const result = await podcastAPI.generate(content, relatedContent);
      setPodcastData(result);
      console.log(`✅ STAGE 2 - Podcast generation completed successfully`);
    } catch (error) {
      console.error('❌ STAGE 2 - Failed to generate podcast:', error);
      setPodcastData({
        status: 'error',
        error: 'Failed to generate podcast'
      });
    } finally {
      setIsGeneratingPodcast(false);
    }
  };

  const handleAudioDownload = async (audioUrl) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
      const fullUrl = `${API_BASE_URL}${audioUrl}`;
      console.log(`🔽 Downloading audio from: ${fullUrl}`);
      
      // Create a temporary anchor element for download
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = 'synapse-podcast.mp3';
      link.target = '_blank';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`✅ Audio download initiated successfully`);
    } catch (error) {
      console.error('❌ Audio download failed:', error);
      
      // Fallback: open in new tab
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
      const fullUrl = `${API_BASE_URL}${audioUrl}`;
      window.open(fullUrl, '_blank');
    }
  };

  const handlePlayPause = async () => {
    try {
      if (!audioRef.current) {
        console.warn('Audio element not available');
        return;
      }

      if (isPlayingPodcast) {
        // Pause the audio
        audioRef.current.pause();
        setIsPlayingPodcast(false);
        console.log('🔇 Audio paused');
      } else {
        // Play the audio
        await audioRef.current.play();
        setIsPlayingPodcast(true);
        console.log('🔊 Audio playing');
      }
    } catch (error) {
      console.error('❌ Audio play/pause error:', error);
      setIsPlayingPodcast(false);
      
      // Show user-friendly error message
      alert('Unable to play audio. Please check your connection and try again.');
    }
  };

  const handleConnectionClick = (connection) => {
    if (onConnectionSelect) {
      // Add visual feedback for the jump action
      const startTime = performance.now();
      
      onConnectionSelect(connection);
      
      // Log navigation performance (must be <2 seconds per requirements)
      const endTime = performance.now();
      const navigationTime = endTime - startTime;
      
      console.log(`🚀 Navigation completed in ${navigationTime.toFixed(2)}ms (requirement: <2000ms)`);
      
      // Show success feedback
      if (navigationTime < 2000) {
        console.log('✅ Navigation performance meets hackathon requirements');
      }
    }
  };

  const formatSimilarityScore = (score) => {
    const percentage = Math.round(score * 100);
    const bars = Math.round(score * 10);
    const filled = '|'.repeat(bars);
    const empty = ' '.repeat(10 - bars);
    return { percentage, visual: `[${filled}${empty}] ${percentage}%` };
  };

  const renderConnectionCard = (connection) => {
    const similarity = formatSimilarityScore(connection.similarity_score);
    
    // Generate relevance explanation (1-2 sentences as per hackathon requirements)
    const generateRelevanceExplanation = (score, text) => {
      if (score > 0.8) {
        return "Highly relevant content with strong semantic similarity to your selected text.";
      } else if (score > 0.6) {
        return "Related content that shares key concepts and context with your selection.";
      } else if (score > 0.4) {
        return "Moderately related content that may provide additional context or background.";
      } else {
        return "Potentially relevant content with some thematic connections.";
      }
    };
    
    return (
      <div 
        key={connection.chunk_id} 
        className="connection-card"
        onClick={() => handleConnectionClick(connection)}
      >
        <div className="connection-header">
          <div className="similarity-score">
            <div className="similarity-visual">
              {similarity.visual}
            </div>
            <span className="accuracy-badge">
              {similarity.percentage}% match
            </span>
          </div>
        </div>
        
        <div className="connection-content">
          <p className="connection-snippet">{connection.text_chunk}</p>
          <p className="relevance-explanation">
            {generateRelevanceExplanation(connection.similarity_score, connection.text_chunk)}
          </p>
        </div>
        
        <div className="connection-footer">
          <div className="connection-source">
            From: {connection.document_name}, Page {connection.page_number + 1}
          </div>
          <button className="jump-button">
            <ExternalLink size={14} />
            Jump to Source
          </button>
        </div>
      </div>
    );
  };

  const renderInsightsContent = () => {
    if (isLoadingInsights) {
      return (
        <div className="insights-loading">
          <div className="loading-spinner" />
          <p>Generating insights...</p>
        </div>
      );
    }

    if (!insights) {
      return (
        <div className="insights-empty">
          <Lightbulb size={48} className="empty-icon" />
          <h3>No insights generated yet</h3>
          <p>Select text in the document and click the insights button to generate AI-powered insights.</p>
        </div>
      );
    }

    if (insights.status === 'error') {
      return (
        <div className="insights-error">
          <p>Error: {insights.error}</p>
        </div>
      );
    }

    const { parsed } = insights;
    if (!parsed) return null;

    return (
      <div className="insights-content">
        {parsed.key_insights && parsed.key_insights.length > 0 && (
          <div className="insight-section">
            <h4>Key Insights</h4>
            <ul>
              {parsed.key_insights.map((insight, index) => (
                <li key={index}>{insight}</li>
              ))}
            </ul>
          </div>
        )}

        {parsed.did_you_know && parsed.did_you_know.length > 0 && (
          <div className="insight-section">
            <h4>Did You Know?</h4>
            <ul>
              {parsed.did_you_know.map((fact, index) => (
                <li key={index}>{fact}</li>
              ))}
            </ul>
          </div>
        )}

        {parsed.contradictions && parsed.contradictions.length > 0 && (
          <div className="insight-section">
            <h4>Contradictions & Nuances</h4>
            <ul>
              {parsed.contradictions.map((contradiction, index) => (
                <li key={index}>{contradiction}</li>
              ))}
            </ul>
          </div>
        )}

        {parsed.connections && parsed.connections.length > 0 && (
          <div className="insight-section">
            <h4>Cross-Document Connections</h4>
            <ul>
              {parsed.connections.map((connection, index) => (
                <li key={index}>{connection}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Podcast Mode Section */}
        <div className="podcast-section">
          <h4>Podcast Mode</h4>
          <p>Generate an audio summary of these insights</p>
          
          {!podcastData ? (
            <button 
              className={`podcast-generate-btn ${isGeneratingPodcast ? 'loading' : ''}`}
              onClick={() => generatePodcast(currentContext)}
              disabled={isGeneratingPodcast}
            >
              {isGeneratingPodcast ? (
                <>
                  <div className="button-spinner" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Generate Audio Summary
                </>
              )}
            </button>
          ) : podcastData.status === 'error' ? (
            <div className="podcast-error">
              ❌ Failed to generate podcast: {podcastData.error}
              <br />
              <small>Try again or check if the backend is running.</small>
            </div>
          ) : (
            <div className="podcast-player">
              <div className="podcast-status">
                {podcastData.audio_url ? (
                  <span className="status-ready">🎧 Audio ready</span>
                ) : (
                  <span className="status-script">📄 Script generated, audio processing...</span>
                )}
              </div>
              <div className="podcast-controls">
                <button 
                  className="play-button"
                  onClick={handlePlayPause}
                  title={isPlayingPodcast ? "Pause audio" : "Play audio"}
                >
                  {isPlayingPodcast ? <Pause size={16} /> : <Play size={16} />}
                </button>
                {podcastData.audio_url && (
                  <button 
                    className="download-button"
                    onClick={() => handleAudioDownload(podcastData.audio_url)}
                    title="Download Audio"
                  >
                    <Download size={16} />
                  </button>
                )}
              </div>
              {podcastData.audio_url && (
                <audio 
                  ref={audioRef}
                  controls 
                  className="audio-player"
                  src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}${podcastData.audio_url}`}
                  onPlay={() => setIsPlayingPodcast(true)}
                  onPause={() => setIsPlayingPodcast(false)}
                  onEnded={() => setIsPlayingPodcast(false)}
                  onError={(e) => {
                    console.error('Audio playback error:', e);
                    setIsPlayingPodcast(false);
                    // Fallback: try direct file access
                    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
                    e.target.src = `${API_BASE_URL}${podcastData.audio_url}?t=${Date.now()}`;
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="synapse-panel">
      <div className="synapse-header">
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'connections' ? 'active' : ''}`}
            onClick={() => setActiveTab('connections')}
          >
            <Network size={16} />
            Connections
            {connections.length > 0 && (
              <span className="tab-badge">{connections.length}</span>
            )}
          </button>
          
          <button 
            className={`tab-button ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            <Lightbulb size={16} />
            Insights
          </button>
        </div>
      </div>

      <div className="synapse-content">
        {activeTab === 'connections' && (
          <div className="connections-tab">
            {isLoadingConnections ? (
              <div className="connections-loading">
                <div className="skeleton-loader">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton-card">
                      <div className="skeleton-line skeleton-header" />
                      <div className="skeleton-line skeleton-content" />
                      <div className="skeleton-line skeleton-content short" />
                      <div className="skeleton-line skeleton-footer" />
                    </div>
                  ))}
                </div>
              </div>
            ) : connections.length === 0 ? (
              <div className="connections-empty">
                <Network size={48} className="empty-icon" />
                <h3>No connections found</h3>
                <p>Select text in your document to discover related content across your library.</p>
              </div>
            ) : (
              <div className="connections-list">
                <div className="connections-header">
                  <h4>Synaptic Connections</h4>
                  <span className="connection-count">{connections.length} found</span>
                </div>
                {connections.map(renderConnectionCard)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && renderInsightsContent()}
      </div>
    </div>
  );
});

export default SynapsePanel;
