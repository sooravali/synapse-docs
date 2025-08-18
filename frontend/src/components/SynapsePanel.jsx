/**
 * Right Panel: The Synapse
 * 
 * Implements the AI conversation interface with tabbed layout for
 * Connections and Insights, featuring structured display and actions.
 */
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Network, Lightbulb, Play, Pause, Download, ExternalLink, Zap, Radio, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { searchAPI, insightsAPI, podcastAPI } from '../api';
import './SynapsePanel.css';

const SynapsePanel = forwardRef(({ 
  contextInfo, // NEW: Structured context object { queryText, source, uniqueId }
  selectedDocument, 
  onConnectionSelect,
  onConnectionsUpdate,
  onInsightsGenerated 
}, ref) => {

  // Helper function to show confirmation overlay
  const showConfirmation = (message, action, actionText = 'Continue', cancelText = 'Keep Current') => {
    return new Promise((resolve) => {
      setConfirmationConfig({
        message,
        action,
        actionText,
        cancelText,
        resolve
      });
      setShowConfirmationOverlay(true);
    });
  };

  // Helper function to handle confirmation response
  const handleConfirmationResponse = (confirmed) => {
    setShowConfirmationOverlay(false);
    if (confirmationConfig.resolve) {
      confirmationConfig.resolve(confirmed);
    }
  };

  // Helper function to clean filename display
  const cleanFileName = (fileName) => {
    if (!fileName) return '';
    return fileName.replace(/^doc_\d+_/, '').replace(/\.pdf$/, '');
  };

  // Helper function to truncate long filenames for display
  const truncateFileName = (fileName, maxLength = 25) => {
    const cleaned = cleanFileName(fileName);
    if (cleaned.length <= maxLength) return cleaned;
    
    // Try to keep the file extension if it was originally there
    const hasExtension = fileName && fileName.includes('.pdf');
    if (hasExtension) {
      const nameWithoutExt = cleaned;
      const truncated = nameWithoutExt.substring(0, maxLength - 7); // Reserve space for "...pdf"
      return `${truncated}...pdf`;
    } else {
      return `${cleaned.substring(0, maxLength - 3)}...`;
    }
  };

  // Helper function to clean filename references within insight text
  const cleanInsightText = (text) => {
    if (!text || typeof text !== 'string') return text;
    // Replace doc_X_ patterns within the text content
    return text.replace(/\bdoc_\d+_([^.\s]+(?:\.\w+)?)/gi, '$1');
  };
  const [activeTab, setActiveTab] = useState('connections');
  const [connections, setConnections] = useState([]);
  const [insights, setInsights] = useState(null);
  const [podcastData, setPodcastData] = useState(null);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [isPlayingPodcast, setIsPlayingPodcast] = useState(false);
  const [navigatingConnectionId, setNavigatingConnectionId] = useState(null);
  const [expandedInsights, setExpandedInsights] = useState({});
  const [expandedSnippets, setExpandedSnippets] = useState({}); // For snippet expansion
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaybackSpeed, setAudioPlaybackSpeed] = useState(1);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  
  // Confirmation overlay state
  const [showConfirmationOverlay, setShowConfirmationOverlay] = useState(false);
  const [confirmationConfig, setConfirmationConfig] = useState({
    message: '',
    action: null,
    actionText: 'Continue',
    cancelText: 'Keep Current'
  });
  
  // INSIGHTS STABILITY: Track insights generation metadata for intelligent clearing
  const [insightsMetadata, setInsightsMetadata] = useState(null);

  // ENHANCED CACHING: Page-based cache with content similarity detection
  const connectionsCache = useRef(new Map()); // Cache: "docId:pageNum" -> {results, contentHash}
  const lastQueryRef = useRef('');
  const lastPageContextRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const audioRef = useRef(null); // For controlling podcast audio
  const sourceDropdownRef = useRef(null); // For source dropdown click outside detection

  // UNIFIED WORKFLOW: Helper functions for generating insights/podcast from current context
  const generateInsightsFromContext = async () => {
    if (!contextInfo || isLoadingInsights) return;
    
    console.log(` UNIFIED WORKFLOW - Generating insights from current context:`, {
      type: contextInfo.source?.type,
      page: contextInfo.source?.pageNumber,
      textLength: contextInfo.queryText.length
    });
    setActiveTab('insights'); // Switch to insights tab
    await generateInsights(contextInfo.queryText, connections);
  };

  const generatePodcastFromContext = async () => {
    if (!contextInfo || isGeneratingPodcast) return;
    
    console.log(` UNIFIED WORKFLOW - Generating podcast from current context:`, {
      type: contextInfo.source?.type,
      page: contextInfo.source?.pageNumber,
      textLength: contextInfo.queryText.length
    });
    await generatePodcast(contextInfo.queryText);
  };

  // Helper function to generate content hash for similarity detection
  const generateContentHash = (text) => {
    if (!text) return '';
    // Normalize text: remove extra whitespace, convert to lowercase, remove special chars
    const normalized = text.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  };

  // Helper functions for audio time formatting
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
      audioRef.current.playbackRate = audioPlaybackSpeed;
    }
  };

  const handleSeek = (event) => {
    if (audioRef.current) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const percentage = x / rect.width;
      const newTime = percentage * audioDuration;
      audioRef.current.currentTime = newTime;
      setAudioCurrentTime(newTime);
    }
  };

  const handlePlaybackSpeedChange = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(audioPlaybackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    
    setAudioPlaybackSpeed(newSpeed);
    
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  // Helper function to toggle snippet expansion
  const toggleSnippetExpansion = (snippetId) => {
    setExpandedSnippets(prev => ({
      ...prev,
      [snippetId]: !prev[snippetId]
    }));
  };

  // Helper function to truncate filename for display
  const getTruncatedFileName = (fileName, maxLength = 30) => {
    if (!fileName || fileName.length <= maxLength) return fileName;
    
    const extension = fileName.substring(fileName.lastIndexOf('.'));
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const truncated = nameWithoutExt.substring(0, maxLength - 3 - extension.length);
    
    return `${truncated}...${extension}`;
  };

  // Helper function to toggle insight section expansion
  const toggleInsightExpansion = (section) => {
    setExpandedInsights(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Helper function to truncate insights list
  const getTruncatedInsights = (insights, section, maxItems = 2) => {
    if (!insights || insights.length === 0) return { visible: [], hasMore: false };
    
    const isExpanded = expandedInsights[section];
    const visible = isExpanded ? insights : insights.slice(0, maxItems);
    const hasMore = insights.length > maxItems;
    
    return { visible, hasMore, isExpanded };
  };

  // Extract page information from context or document viewer state
  const extractPageContext = (context, document) => {
    if (!context || !document) return null;
    
    // DETECT TEXT SELECTION: Check if this is a text selection context
    const isTextSelection = context.startsWith('[Selected Text from');
    
    // Try to extract page number from various sources
    let pageNumber = null;
    
    // Method 1: Look for page indicators in the text
    const pageMatch = context.match(/\[(.*?Page\s+(\d+).*?)\]/i);
    if (pageMatch) {
      pageNumber = parseInt(pageMatch[2], 10) - 1; // Convert to 0-based
    }
    
    // Method 2: If no explicit page found, use content hash as identifier
    if (pageNumber === null) {
      const contentHash = generateContentHash(context);
      
      // For text selections, always use a unique identifier to avoid cache conflicts
      if (isTextSelection) {
        return {
          documentId: document.id,
          identifier: `selection_${contentHash}_${Date.now()}`, // Unique identifier for selections
          contentHash,
          isContentBased: true,
          isTextSelection: true
        };
      }
      
      // For reading context, use normal content-based caching
      return {
        documentId: document.id,
        identifier: `content_${contentHash}`,
        contentHash,
        isContentBased: true,
        isTextSelection: false
      };
    }
    
    return {
      documentId: document.id,
      identifier: isTextSelection ? `selection_page_${pageNumber}_${Date.now()}` : `page_${pageNumber}`,
      pageNumber,
      contentHash: generateContentHash(context),
      isContentBased: false,
      isTextSelection
    };
  };

  // Helper function to extract and format page information for display
  const getPageInfoForDisplay = (context, connections = []) => {
    if (!context) return null;
    
    // Ensure context is a string before using match
    const contextString = typeof context === 'string' ? context : 
                         typeof context === 'object' && context.text ? context.text :
                         JSON.stringify(context);
    
    // Try to extract page from context first using the correct pattern: (Page X)
    const pageMatch = contextString.match(/\(Page\s+(\d+)\)/i);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1], 10);
      return { pageNumber: pageNum, isFromContext: true };
    }
    
    // If connections are available, get page info from them
    if (connections && connections.length > 0) {
      const sourcePages = connections
        .filter(conn => conn.page_number !== undefined && conn.page_number !== null)
        .map(conn => conn.page_number + 1); // Convert from 0-based to 1-based
      
      if (sourcePages.length > 0) {
        const uniquePages = [...new Set(sourcePages)].sort((a, b) => a - b);
        return { 
          pageNumbers: uniquePages, 
          isFromConnections: true,
          primaryPage: uniquePages[0]
        };
      }
    }
    
    return null;
  };

  // OPTIMIZATION: Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle click outside for source dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target)) {
        setSourceDropdownOpen(false);
      }
    };

    if (sourceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [sourceDropdownOpen]);

  // CLEAN CONTEXT HANDLING: React to structured context changes
  useEffect(() => {
    console.log(`🔍 SynapsePanel: Context changed:`, contextInfo);

    // No context - clear connections
    if (!contextInfo || !contextInfo.queryText) {
      console.log(`⚠️ SynapsePanel: No valid context, clearing connections`);
      setConnections([]);
      setIsLoadingConnections(false);
      return;
    }

    // Validate context
    if (contextInfo.queryText.length < 10) {
      console.log(`⚠️ SynapsePanel: Context too short (${contextInfo.queryText.length} chars)`);
      setConnections([]);
      setIsLoadingConnections(false);
      return;
    }

    console.log(`✅ SynapsePanel: Valid context received:`, {
      type: contextInfo.source?.type,
      page: contextInfo.source?.pageNumber,
      textLength: contextInfo.queryText.length,
      uniqueId: contextInfo.uniqueId
    });

    // Search for connections with clean query text
    searchForConnections(contextInfo.queryText, contextInfo);

  }, [contextInfo]); // Simple dependency - reacts to any context change

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
      console.log(` SynapsePanel: STAGE 2 - Explicit insights request for: "${text?.substring(0, 50)}..."`);
      return generateInsights(text, contextConnections);
    },
    generatePodcast: (text) => {
      console.log(` SynapsePanel: STAGE 2 - Explicit podcast request for: "${text?.substring(0, 50)}..."`);
      return generatePodcast(text);
    },
    resetPanelState: () => {
      console.log(' SynapsePanel: Resetting panel state for new document');
      setConnections([]);
      setInsights(null);
      setPodcastData(null);
      setActiveTab('connections');
      setNavigatingConnectionId(null);
      setExpandedInsights({});
      setExpandedSnippets({});
      setAudioCurrentTime(0);
      setAudioDuration(0);
      setIsPlayingPodcast(false);
      setInsightsMetadata(null);
      setSourceDropdownOpen(false);
      setSourceDropdownOpen(false);
      // Clear cache for clean slate
      connectionsCache.current.clear();
      lastQueryRef.current = '';
      lastPageContextRef.current = null;
      
      // Notify parent that insights are cleared
      if (onInsightsGenerated) {
        onInsightsGenerated(false);
      }
    }
  }));

  const searchForConnections = async (queryText, contextInfo) => {
    console.log(`🔍 SynapsePanel: Searching for connections:`, {
      type: contextInfo?.source?.type,
      page: contextInfo?.source?.pageNumber,
      textLength: queryText.length
    });
    
    // Prevent concurrent requests
    if (isLoadingConnections) {
      console.log(`⏸️ SynapsePanel: Already loading connections, skipping...`);
      return;
    }
    
    setIsLoadingConnections(true);
    setConnections([]); // Clear immediately for better UX
    
    try {
      // Clean query text - remove any metadata markers
      const cleanQuery = queryText
        .replace(/\[Selected Text from[^\]]*\]/g, '')
        .replace(/\[Reading context from[^\]]*\]/g, '')
        .replace(/\[End of Selection\]/g, '')
        .replace(/\[End of Context\]/g, '')
        .trim();

      if (!cleanQuery || cleanQuery.length < 10) {
        console.log(`❌ SynapsePanel: Query too short after cleaning: "${cleanQuery}"`);
        setConnections([]);
        return;
      }

      console.log(`📤 SynapsePanel: Clean query (${cleanQuery.length} chars): "${cleanQuery.substring(0, 100)}..."`);
      
      // Make API call
      const results = await searchAPI.semantic({
        query_text: cleanQuery,
        top_k: 6,
        similarity_threshold: 0.1
      });
      
      console.log(`📥 SynapsePanel: API response:`, results);
      
      const connections = results?.results || [];
      
      if (connections.length === 0) {
        console.log(`❌ SynapsePanel: No connections found`);
        setConnections([]);
        return;
      }
      
      // Filter for quality connections
      const highAccuracyConnections = connections.filter(conn => conn.similarity_score > 0.8);
      const finalConnections = highAccuracyConnections.length >= 3 
        ? highAccuracyConnections.slice(0, 3)
        : connections.slice(0, Math.max(3, connections.length));
      
      console.log(`✅ SynapsePanel: Found ${finalConnections.length} connections`);
      console.log(`📈 Accuracy scores:`, finalConnections.map(c => `${Math.round(c.similarity_score * 100)}%`));
      
      setConnections(finalConnections);
      
      // Auto-switch to connections tab
      if (activeTab !== 'insights') {
        setActiveTab('connections');
      }
      
      // Notify parent
      if (onConnectionsUpdate) {
        onConnectionsUpdate(finalConnections);
      }
      
    } catch (error) {
      console.error(`❌ SynapsePanel: Search failed:`, error);
      
      if (error.response?.status === 422) {
        console.error(`💥 SynapsePanel: 422 Validation Error:`, error.response.data);
      }
      
      setConnections([]);
      
    } finally {
      setIsLoadingConnections(false);
    }
  };

  // Manual search function for user-initiated searches
  const manualSearch = async (searchQuery) => {
    console.log(`🔍 SynapsePanel: Manual search initiated for: "${searchQuery}"`);
    
    if (!searchQuery || searchQuery.trim().length < 3) {
      console.log(`⚠️ SynapsePanel: Search query too short`);
      return;
    }
    
    const pageContext = {
      isTextSelection: false,
      identifier: `manual-search-${Date.now()}`,
      documentId: selectedDocument?.id || 'unknown'
    };
    
    await searchForConnections(searchQuery, pageContext);
  };

  const generateInsights = async (text, contextConnections = []) => {
    console.log(` SynapsePanel: STAGE 2 - Starting explicit insights generation for: "${text?.substring(0, 50)}..."`);
    
    if (isLoadingInsights) {
      console.log(` SynapsePanel: Already generating insights, skipping...`);
      return;
    }

    // Check if we already have insights and show confirmation dialog
    if (insights && insights.parsed) {
      const shouldProceed = await showConfirmation(
        "This will clear your old insights and audio content to generate new analysis.",
        "generate-insights",
        "Continue",
        "Keep Current"
      );
      
      if (!shouldProceed) {
        console.log(` User cancelled insights generation to preserve existing content`);
        return;
      }
    }

    // Clear all previous state before generating new insights
    console.log(` Clearing previous insights and audio state for fresh generation`);
    setInsights(null);
    setPodcastData(null);
    setInsightsMetadata(null);
    setExpandedInsights({});
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setIsPlayingPodcast(false);
    
    // Notify parent that insights are being cleared
    if (onInsightsGenerated) {
      onInsightsGenerated(false);
    }
    
    setIsLoadingInsights(true);
    setActiveTab('insights'); // Switch to insights tab for Stage 2
    
    try {
      // Enhanced payload with context-rich data from Stage 1 connections
      const enrichedContext = contextConnections.length > 0 
        ? `Related content from library:\n${contextConnections.map((conn, i) => 
            `${i + 1}. From "${cleanFileName(conn.document_name)}": ${conn.text_chunk.substring(0, 150)}...`
          ).join('\n\n')}`
        : "";
      
      console.log(` STAGE 2 - Generating insights with ${contextConnections.length} context connections from Stage 1`);
      
      const result = await insightsAPI.generate(text, enrichedContext);
      
      // Parse the insights JSON string
      let parsedInsights;
      
      console.log(' DEBUG - Raw insights type:', typeof result.insights);
      console.log(' DEBUG - Raw insights value:', result.insights);
      
      try {
        let insightsData = result.insights;
        
        // Simple approach: if it's a string, try to parse it as JSON
        if (typeof insightsData === 'string') {
          // Clean up common issues with JSON strings
          insightsData = insightsData.trim();
          
          // Remove any surrounding markdown
          insightsData = insightsData.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          
          console.log(' DEBUG - Cleaned insights:', insightsData.substring(0, 100) + '...');
          
          // Parse the JSON
          parsedInsights = JSON.parse(insightsData);
        } else {
          // Already an object
          parsedInsights = insightsData;
        }
        
        console.log(' DEBUG - Parsed insights:', parsedInsights);
        
        // SPECIAL CASE: Check if the real insights are nested inside key_insights[0]
        if (parsedInsights.key_insights && 
            parsedInsights.key_insights.length === 1 && 
            typeof parsedInsights.key_insights[0] === 'string' &&
            parsedInsights.key_insights[0].includes('```json')) {
          
          console.log(' DEBUG - Found nested JSON in key_insights[0], extracting...');
          
          // Extract the nested JSON
          let nestedJson = parsedInsights.key_insights[0];
          nestedJson = nestedJson.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          nestedJson = nestedJson.trim();
          
          console.log(' DEBUG - Nested JSON before fixing:', nestedJson.substring(0, 200) + '...');
          
          // More aggressive cleaning for escaped characters
          try {
            // First, try to parse it as-is (in case it's already properly formatted)
            parsedInsights = JSON.parse(nestedJson);
            console.log(' DEBUG - Successfully parsed without fixing:', parsedInsights);
          } catch (firstAttempt) {
            console.log(' DEBUG - First parse failed, trying to fix escaping...');
            
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
            
            console.log(' DEBUG - Nested JSON after fixing:', fixedJson.substring(0, 200) + '...');
            
            // Try parsing the fixed version
            parsedInsights = JSON.parse(fixedJson);
            console.log(' DEBUG - Successfully parsed after fixing:', parsedInsights);
          }
        }
        
      } catch (parseError) {
        console.error(' DEBUG - JSON parse failed:', parseError);
        console.log(' DEBUG - Failed on text:', result.insights);
        
        // Simple fallback: just show the raw text for now to identify the issue
        parsedInsights = {
          contradictions: [],
          supporting_examples: [{insight: `Parsing failed. Raw content: ${result.insights}`, source: "System", explanation: "JSON parsing error"}],
          related_concepts: [],
          key_takeaways: []
        };
      }
      
      // Helper function to clean insights that may be in object or string format
      const cleanInsightContent = (item) => {
        if (typeof item === 'string') {
          return cleanInsightText(item);
        } else if (typeof item === 'object' && item.insight) {
          return {
            ...item,
            insight: cleanInsightText(item.insight),
            source: item.source ? cleanInsightText(item.source) : item.source,
            explanation: item.explanation ? cleanInsightText(item.explanation) : item.explanation
          };
        }
        return item;
      };

      // Clean filename references in all insight sections
      const cleanInsightArray = (insights) => {
        if (!Array.isArray(insights)) return insights;
        return insights.map(cleanInsightContent);
      };

      // Apply cleaning to all insight sections
      if (parsedInsights) {
        // Handle both new structure and legacy structure
        if (parsedInsights.contradictions) {
          parsedInsights.contradictions = cleanInsightArray(parsedInsights.contradictions);
        }
        if (parsedInsights.supporting_examples) {
          parsedInsights.supporting_examples = cleanInsightArray(parsedInsights.supporting_examples);
        }
        if (parsedInsights.related_concepts) {
          parsedInsights.related_concepts = cleanInsightArray(parsedInsights.related_concepts);
        }
        if (parsedInsights.key_takeaways) {
          parsedInsights.key_takeaways = cleanInsightArray(parsedInsights.key_takeaways);
        }
        
        // Legacy structure support
        if (parsedInsights.key_insights) {
          parsedInsights.key_insights = cleanInsightArray(parsedInsights.key_insights);
        }
        if (parsedInsights.did_you_know) {
          parsedInsights.did_you_know = cleanInsightArray(parsedInsights.did_you_know);
        }
        if (parsedInsights.connections) {
          parsedInsights.connections = cleanInsightArray(parsedInsights.connections);
        }
      }
      
      const sourceType = text && text.includes('[Selected Text from') ? 'selection' : 'reading';
      
      setInsights({
        ...result,
        parsed: parsedInsights,
        contextConnections: contextConnections,
        context: text, // Store the original context for "from/through" display
        sourceType: sourceType
      });
      
      // INSIGHTS STABILITY: Track metadata for intelligent clearing decisions
      setInsightsMetadata({
        sourceType: sourceType,
        generatedAt: Date.now(),
        contextLength: text ? text.length : 0,
        hasConnections: contextConnections.length > 0
      });
      
      // Notify parent component that insights were generated
      if (onInsightsGenerated) {
        onInsightsGenerated(true);
      }
      
      console.log(` STAGE 2 - Insights generation completed successfully`);
    } catch (error) {
      console.error(' STAGE 2 - Failed to generate insights:', error);
      
      // More user-friendly error messages
      let errorMessage = 'Failed to generate insights';
      if (error.message && error.message.includes('503')) {
        errorMessage = 'AI service is temporarily busy. Please try again in a moment.';
      } else if (error.message && error.message.includes('temporarily unavailable')) {
        errorMessage = 'AI service is temporarily unavailable. Please try again shortly.';
      } else if (error.message && error.message.includes('network')) {
        errorMessage = 'Network connection issue. Please check your connection and try again.';
      }
      
      setInsights({
        status: 'error',
        error: errorMessage,
        parsed: null,
        canRetry: true
      });
      
      // INSIGHTS STABILITY: Clear metadata on error
      setInsightsMetadata(null);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const generatePodcast = async (content) => {
    console.log(` SynapsePanel: STAGE 2 - Starting explicit podcast generation for: "${content?.substring(0, 50)}..."`);
    
    if (isGeneratingPodcast) {
      console.log(` SynapsePanel: Already generating podcast, skipping...`);
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      console.error(' SynapsePanel: Invalid content for podcast generation');
      setPodcastData({
        status: 'error',
        error: 'No content available for podcast generation'
      });
      return;
    }

    // Check if we already have podcast data and show confirmation dialog
    if (podcastData && podcastData.audio_url) {
      const shouldProceed = await showConfirmation(
        "This will replace your current audio content with new audio.",
        "generate-audio",
        "Continue",
        "Keep Current"
      );
      
      if (!shouldProceed) {
        console.log(` User cancelled podcast generation to preserve existing audio`);
        return;
      }
    }

    // Clear previous podcast state before generating new audio
    console.log(` Clearing previous podcast state for fresh generation`);
    setPodcastData(null);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setIsPlayingPodcast(false);
    
    setIsGeneratingPodcast(true);
    
    try {
      // Get related content from connections if available
      const relatedContent = connections.length > 0 
        ? connections.map(conn => conn.content).join('\n\n')
        : "";
      
      console.log(` STAGE 2 - Generating podcast with ${connections.length} context connections from Stage 1`);
      const result = await podcastAPI.generate(content, relatedContent);
      
      if (result && result.status !== 'error') {
        setPodcastData(result);
        console.log(` STAGE 2 - Podcast generation completed successfully`);
      } else {
        throw new Error(result?.error || 'Unknown error occurred during podcast generation');
      }
    } catch (error) {
      console.error(' STAGE 2 - Failed to generate podcast:', error);
      setPodcastData({
        status: 'error',
        error: error.message || 'Failed to generate podcast. Please try again.'
      });
    } finally {
      setIsGeneratingPodcast(false);
    }
  };

  const handleAudioDownload = async (audioUrl) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
        (import.meta.env.PROD ? '' : 'http://localhost:8080');
      const fullUrl = `${API_BASE_URL}${audioUrl}`;
      console.log(` Downloading audio from: ${fullUrl}`);
      
      // Create a temporary anchor element for download
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = 'synapse-podcast.mp3';
      link.target = '_blank';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(` Audio download initiated successfully`);
    } catch (error) {
      console.error(' Audio download failed:', error);
      
      // Fallback: open in new tab
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
        (import.meta.env.PROD ? '' : 'http://localhost:8080');
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
        console.log(' Audio paused');
      } else {
        // Play the audio
        await audioRef.current.play();
        setIsPlayingPodcast(true);
        console.log(' Audio playing');
      }
    } catch (error) {
      console.error(' Audio play/pause error:', error);
      setIsPlayingPodcast(false);
      
      // Show user-friendly error message
      alert('Unable to play audio. Please check your connection and try again.');
    }
  };

  const handleConnectionClick = (connection) => {
    if (onConnectionSelect) {
      // Set navigation state for visual feedback
      setNavigatingConnectionId(connection.chunk_id);
      
      // Add visual feedback for the jump action
      const startTime = performance.now();
      
      // Check if it's same document (Go to page) vs different document (Open & Go)
      const isCurrentDocument = selectedDocument && selectedDocument.id === connection.document_id;
      
      onConnectionSelect(connection);
      
      // Clear navigation state based on navigation type
      setTimeout(() => {
        setNavigatingConnectionId(null);
      }, isCurrentDocument ? 400 : 1200); // 400ms for same doc, 1200ms for different doc
      
      // Log navigation performance (must be <2 seconds per requirements)
      const endTime = performance.now();
      const navigationTime = endTime - startTime;
      
      console.log(` Navigation completed in ${navigationTime.toFixed(2)}ms (requirement: <2000ms)`);
      
      // Show success feedback
      if (navigationTime < 2000) {
        console.log(' Navigation performance meets hackathon requirements');
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
    const isCurrentDocument = selectedDocument && selectedDocument.id === connection.document_id;
    const documentName = cleanFileName(connection.document_name);
    const isNavigating = navigatingConnectionId === connection.chunk_id;
    const isSnippetExpanded = expandedSnippets[connection.chunk_id];
    
    // Determine if snippet needs truncation
    const snippetText = connection.text_chunk;
    const needsTruncation = snippetText.length > 150;
    const displayText = needsTruncation && !isSnippetExpanded 
      ? snippetText.substring(0, 150) + '...' 
      : snippetText;
    
    return (
      <div 
        key={connection.chunk_id} 
        className={`connection-card ${isCurrentDocument ? 'same-document' : 'different-document'} ${isNavigating ? 'navigating' : ''}`}
        onClick={() => handleConnectionClick(connection)}
      >
        <div className="connection-header">
          <div className="connection-source-header">
            <div className="source-document-header">
              <div className="document-icon">
                <FileText size={14} />
              </div>
              <span 
                className="document-name-header"
                title={isCurrentDocument ? "In this document" : `From: ${documentName}`}
              >
                {isCurrentDocument ? "In this document" : `From: ${truncateFileName(connection.document_name)}`}
              </span>
            </div>
            <div className="source-context">
              Page {connection.page_number + 1}
            </div>
          </div>
        </div>
        
        <div className="connection-content">
          <p className="connection-snippet">{displayText}</p>
          {needsTruncation && (
            <button 
              className="snippet-expand-toggle"
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click
                toggleSnippetExpansion(connection.chunk_id);
              }}
            >
              {isSnippetExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
          {isNavigating && (
            <div className="navigation-feedback">
              <div className="navigation-progress">
                <div className="progress-spinner"></div>
                <span>{isCurrentDocument ? 'Going to page...' : 'Opening document...'}</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="connection-footer">
          <div className="connection-actions-full">
            <div className="similarity-indicator" title={`${similarity.percentage}% relevance`}>
              {similarity.percentage}% match
            </div>
            <button 
              className={`jump-section-button ${isNavigating ? 'loading' : ''}`} 
              title={isCurrentDocument ? 'Jump to Section' : 'Open & Jump to Section'}
              disabled={isNavigating}
            >
              {isNavigating ? (
                <>
                  <span className="jump-text">Going...</span>
                </>
              ) : (
                <>
                  <ExternalLink size={14} />
                  <span className="jump-text">Jump to Section</span>
                </>
              )}
            </button>
          </div>
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
          <div className="empty-content">
            <h3>Generate AI Insights</h3>
            <p>Insights will appear here after connections are generated. Start by reading or selecting text.</p>
            <div className="empty-steps">
              <div className="step-item">
                <span className="step-number">1</span>
                <span>Read document or select text</span>
              </div>
              <div className="step-item">
                <span className="step-number">2</span>
                <span>Wait for connections to generate</span>
              </div>
              <div className="step-item">
                <span className="step-number">3</span>
                <span>Click "Generate Insights" button</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (insights.status === 'error') {
      return (
        <div className="insights-error">
          <p>{insights.error}</p>
          {insights.canRetry && (
            <button 
              className="retry-insights-btn"
              onClick={() => {
                setInsights(null);
                setInsightsMetadata(null);
                if (onInsightsGenerated) {
                  onInsightsGenerated(false);
                }
                if (contextInfo) {
                  generateInsights(contextInfo, connections);
                }
              }}
              disabled={isLoadingInsights}
            >
              Try Again
            </button>
          )}
        </div>
      );
    }

    const { parsed } = insights;
    if (!parsed) return null;

    return (
      <div className="insights-content">
        <div className="insights-header">
          <h4>Insights</h4>
          <p className="insights-context">
            {insights.context && insights.context.includes('[Selected Text from') 
              ? ' Generated from your selected text'
              : insights.context && insights.context.includes('[Reading context from')
                ? ' Generated from your reading context'
                : ' Generated from your reading context'
            }
          </p>
          {(() => {
            // Enhanced page information display for insights - use stored contextConnections
            const storedConnections = insights.contextConnections || [];
            const pageInfo = getPageInfoForDisplay(insights.context, storedConnections);
            
            if (pageInfo) {
              return (
                <div className="insights-page-info">
                  {insights.context && insights.context.includes('[Selected Text from') ? (
                    <div>
                      <p className="context-source">
                         From: {cleanFileName(selectedDocument?.file_name) || 'document'}
                        {(() => {
                          // Extract page from context for text selection
                          const pageMatch = insights.context?.match(/\[(.*?)\(Page\s+(\d+)\)\]/i) || 
                                           insights.context?.match(/\[(.*?Page\s+(\d+).*?)\]/i);
                          return pageMatch ? (
                            <span className="page-indicator"> • Page {pageMatch[2]}</span>
                          ) : null;
                        })()}
                      </p>
                      
                      {/* Show sources dropdown for text selection insights if there are related sources */}
                      {storedConnections && storedConnections.length > 0 && (
                        <div className="insights-source-info">
                          <div className="sources-compact" ref={sourceDropdownRef}>
                            <button 
                              className="sources-toggle"
                              onClick={() => setSourceDropdownOpen(!sourceDropdownOpen)}
                              title="View all source pages used for insights"
                            >
                              <span className="sources-label">
                                {storedConnections.length === 1 
                                  ? "1 source used"
                                  : `${storedConnections.length} sources used`
                                }
                              </span>
                              {sourceDropdownOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                            
                            {sourceDropdownOpen && (
                              <div className="sources-popup">
                                {(() => {
                                  // Group sources by document for better organization
                                  const sourcesByDoc = {};
                                  storedConnections.forEach(conn => {
                                    const docName = selectedDocument && selectedDocument.id === conn.document_id 
                                      ? 'This document' 
                                      : cleanFileName(conn.document_name);
                                    const pageNum = conn.page_number + 1;
                                    
                                    if (!sourcesByDoc[docName]) {
                                      sourcesByDoc[docName] = [];
                                    }
                                    if (!sourcesByDoc[docName].includes(pageNum)) {
                                      sourcesByDoc[docName].push(pageNum);
                                    }
                                  });
                                  
                                  // Sort pages within each document
                                  Object.keys(sourcesByDoc).forEach(docName => {
                                    sourcesByDoc[docName].sort((a, b) => a - b);
                                  });
                                  
                                  return Object.entries(sourcesByDoc).map(([docName, pages]) => (
                                    <div key={docName} className="source-group">
                                      <div className="source-doc-name">{docName}</div>
                                      <div className="source-pages">
                                        {pages.map(page => (
                                          <span key={page} className="page-tag">Page {page}</span>
                                        ))}
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : pageInfo.pageNumbers && pageInfo.pageNumbers.length > 0 ? (
                    <div className="insights-source-info">
                      <div className="sources-compact" ref={sourceDropdownRef}>
                        <button 
                          className="sources-toggle"
                          onClick={() => setSourceDropdownOpen(!sourceDropdownOpen)}
                          title="View source pages"
                        >
                          <span className="sources-label">
                            {pageInfo.pageNumbers.length === 1 
                              ? `Source: Page ${pageInfo.pageNumbers[0]}`
                              : `${pageInfo.pageNumbers.length} sources`
                            }
                          </span>
                          {sourceDropdownOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        
                        {sourceDropdownOpen && (
                          <div className="sources-popup">
                            {(() => {
                              // Group sources by document for better organization
                              const sourcesByDoc = {};
                              storedConnections.forEach(conn => {
                                const docName = selectedDocument && selectedDocument.id === conn.document_id 
                                  ? 'This document' 
                                  : cleanFileName(conn.document_name);
                                const pageNum = conn.page_number + 1;
                                
                                if (!sourcesByDoc[docName]) {
                                  sourcesByDoc[docName] = [];
                                }
                                if (!sourcesByDoc[docName].includes(pageNum)) {
                                  sourcesByDoc[docName].push(pageNum);
                                }
                              });
                              
                              // Sort pages within each document
                              Object.keys(sourcesByDoc).forEach(docName => {
                                sourcesByDoc[docName].sort((a, b) => a - b);
                              });
                              
                              return Object.entries(sourcesByDoc).map(([docName, pages]) => (
                                <div key={docName} className="source-group">
                                  <div className="source-doc-name">{docName}</div>
                                  <div className="source-pages">
                                    {pages.map(page => (
                                      <span key={page} className="page-tag">Page {page}</span>
                                    ))}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }
            return (insights.context && (insights.context.includes('[Selected Text from') || insights.context.includes('[Reading context from'))) && (
              <p className="context-source">
                 From: {cleanFileName(selectedDocument?.file_name) || 'document'}
                {(() => {
                  // Extract page from context using the correct pattern
                  const pageMatch = insights.context?.match(/\(Page\s+(\d+)\)/i);
                  return pageMatch ? (
                    <span className="page-indicator"> • Page {pageMatch[1]}</span>
                  ) : null;
                })()}
              </p>
            );
          })()}
        </div>
        
        <div className="insights-cards">
          {/* Enhanced Insights Structure */}
          {parsed.supporting_examples && parsed.supporting_examples.length > 0 && (
            <div className="insight-card compact">
              <h4 className="insight-card-title">Supporting Examples</h4>
              {(() => {
                const { visible, hasMore, isExpanded } = getTruncatedInsights(parsed.supporting_examples, 'supporting_examples', 2);
                return (
                  <>
                    <ul className="insight-list compact">
                      {visible.map((item, index) => (
                        <li key={index}>
                          <div className="insight-content">
                            <span className="insight-text">{typeof item === 'object' ? item.insight : item}</span>
                            {typeof item === 'object' && item.source && (
                              <span className="insight-source">— {cleanFileName(item.source)}</span>
                            )}
                          </div>
                          {typeof item === 'object' && item.explanation && (
                            <div className="insight-explanation">{item.explanation}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {hasMore && (
                      <button 
                        className="expand-toggle"
                        onClick={() => toggleInsightExpansion('supporting_examples')}
                      >
                        {isExpanded ? 'Show less' : `Show ${parsed.supporting_examples.length - 2} more`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {parsed.contradictions && parsed.contradictions.length > 0 && (
            <div className="insight-card compact">
              <h4 className="insight-card-title">Contradictions & Counterpoints</h4>
              {(() => {
                const { visible, hasMore, isExpanded } = getTruncatedInsights(parsed.contradictions, 'contradictions', 2);
                return (
                  <>
                    <ul className="insight-list compact">
                      {visible.map((item, index) => (
                        <li key={index}>
                          <div className="insight-content">
                            <span className="insight-text">{typeof item === 'object' ? item.insight : item}</span>
                            {typeof item === 'object' && item.source && (
                              <span className="insight-source">— {cleanFileName(item.source)}</span>
                            )}
                          </div>
                          {typeof item === 'object' && item.explanation && (
                            <div className="insight-explanation">{item.explanation}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {hasMore && (
                      <button 
                        className="expand-toggle"
                        onClick={() => toggleInsightExpansion('contradictions')}
                      >
                        {isExpanded ? 'Show less' : `Show ${parsed.contradictions.length - 2} more`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {parsed.related_concepts && parsed.related_concepts.length > 0 && (
            <div className="insight-card compact">
              <h4 className="insight-card-title">Related Concepts</h4>
              {(() => {
                const { visible, hasMore, isExpanded } = getTruncatedInsights(parsed.related_concepts, 'related_concepts', 2);
                return (
                  <>
                    <ul className="insight-list compact">
                      {visible.map((item, index) => (
                        <li key={index}>
                          <div className="insight-content">
                            <span className="insight-text">{typeof item === 'object' ? item.insight : item}</span>
                            {typeof item === 'object' && item.source && (
                              <span className="insight-source">— {cleanFileName(item.source)}</span>
                            )}
                          </div>
                          {typeof item === 'object' && item.explanation && (
                            <div className="insight-explanation">{item.explanation}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {hasMore && (
                      <button 
                        className="expand-toggle"
                        onClick={() => toggleInsightExpansion('related_concepts')}
                      >
                        {isExpanded ? 'Show less' : `Show ${parsed.related_concepts.length - 2} more`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {parsed.key_takeaways && parsed.key_takeaways.length > 0 && (
            <div className="insight-card compact">
              <h4 className="insight-card-title">Key Takeaways</h4>
              {(() => {
                const { visible, hasMore, isExpanded } = getTruncatedInsights(parsed.key_takeaways, 'key_takeaways', 2);
                return (
                  <>
                    <ul className="insight-list compact">
                      {visible.map((item, index) => (
                        <li key={index}>
                          <div className="insight-content">
                            <span className="insight-text">{typeof item === 'object' ? item.insight : item}</span>
                            {typeof item === 'object' && item.source && (
                              <span className="insight-source">— {cleanFileName(item.source)}</span>
                            )}
                          </div>
                          {typeof item === 'object' && item.explanation && (
                            <div className="insight-explanation">{item.explanation}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {hasMore && (
                      <button 
                        className="expand-toggle"
                        onClick={() => toggleInsightExpansion('key_takeaways')}
                      >
                        {isExpanded ? 'Show less' : `Show ${parsed.key_takeaways.length - 2} more`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Legacy structure support */}
          {parsed.key_insights && parsed.key_insights.length > 0 && (
            <div className="insight-card compact">
              <h4 className="insight-card-title">Key Insights</h4>
              {(() => {
                const { visible, hasMore, isExpanded } = getTruncatedInsights(parsed.key_insights, 'key_insights', 2);
                return (
                  <>
                    <ul className="insight-list compact">
                      {visible.map((item, index) => (
                        <li key={index}>
                          <div className="insight-content">
                            <span className="insight-text">{typeof item === 'object' ? item.insight : item}</span>
                            {typeof item === 'object' && item.source && (
                              <span className="insight-source">— {cleanFileName(item.source)}</span>
                            )}
                          </div>
                          {typeof item === 'object' && item.explanation && (
                            <div className="insight-explanation">{item.explanation}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {hasMore && (
                      <button 
                        className="expand-toggle"
                        onClick={() => toggleInsightExpansion('key_insights')}
                      >
                        {isExpanded ? 'Show less' : `Show ${parsed.key_insights.length - 2} more`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {parsed.did_you_know && parsed.did_you_know.length > 0 && (
            <div className="insight-card compact">
              <h4 className="insight-card-title">Did You Know?</h4>
              {(() => {
                const { visible, hasMore, isExpanded } = getTruncatedInsights(parsed.did_you_know, 'did_you_know', 2);
                return (
                  <>
                    <ul className="insight-list compact">
                      {visible.map((item, index) => (
                        <li key={index}>
                          <div className="insight-content">
                            <span className="insight-text">{typeof item === 'object' ? item.insight : item}</span>
                            {typeof item === 'object' && item.source && (
                              <span className="insight-source">— {cleanFileName(item.source)}</span>
                            )}
                          </div>
                          {typeof item === 'object' && item.explanation && (
                            <div className="insight-explanation">{item.explanation}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {hasMore && (
                      <button 
                        className="expand-toggle"
                        onClick={() => toggleInsightExpansion('did_you_know')}
                      >
                        {isExpanded ? 'Show less' : `Show ${parsed.did_you_know.length - 2} more`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {parsed.connections && parsed.connections.length > 0 && (
            <div className="insight-card compact">
              <h4 className="insight-card-title">Cross-Document Connections</h4>
              {(() => {
                const { visible, hasMore, isExpanded } = getTruncatedInsights(parsed.connections, 'connections', 2);
                return (
                  <>
                    <ul className="insight-list compact">
                      {visible.map((item, index) => (
                        <li key={index}>
                          <div className="insight-content">
                            <span className="insight-text">{typeof item === 'object' ? item.insight : item}</span>
                            {typeof item === 'object' && item.source && (
                              <span className="insight-source">— {cleanFileName(item.source)}</span>
                            )}
                          </div>
                          {typeof item === 'object' && item.explanation && (
                            <div className="insight-explanation">{item.explanation}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {hasMore && (
                      <button 
                        className="expand-toggle"
                        onClick={() => toggleInsightExpansion('connections')}
                      >
                        {isExpanded ? 'Show less' : `Show ${parsed.connections.length - 2} more`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Separate podcast section renderer for fixed footer in insights
  const renderPodcastSection = () => {
    return (
      <div className="integrated-podcast-section">
        <div className="podcast-header">
          <h4 className="podcast-section-title">Generate Audio Summary</h4>
          {(() => {
            // Display page information for podcast section
            const pageInfo = getPageInfoForDisplay(contextInfo, connections);
            if (pageInfo && (podcastData || isGeneratingPodcast)) {
              return (
                <div className="podcast-page-info">
                  {pageInfo.pageNumber ? (
                    <p className="podcast-source">
                       Based on Page {pageInfo.pageNumber}
                    </p>
                  ) : pageInfo.pageNumbers && pageInfo.pageNumbers.length > 0 ? (
                    <p className="podcast-source">
                       Based on {pageInfo.pageNumbers.length === 1 
                        ? `Page ${pageInfo.pageNumbers[0]}`
                        : pageInfo.pageNumbers.length <= 3
                          ? `Pages ${pageInfo.pageNumbers.join(', ')}`
                          : `Pages ${pageInfo.pageNumbers.slice(0, 3).join(', ')} +${pageInfo.pageNumbers.length - 3} more`
                      }
                    </p>
                  ) : null}
                </div>
              );
            }
            return null;
          })()}
        </div>
        
        {!podcastData ? (
          <button 
            className={`integrated-podcast-btn ${isGeneratingPodcast ? 'loading' : ''}`}
            onClick={() => {
              console.log('🎯 Generate Audio button clicked!');
              console.log('🎯 contextInfo:', contextInfo);
              console.log('🎯 contextInfo.queryText:', contextInfo?.queryText);
              generatePodcast(contextInfo?.queryText);
            }}
            disabled={isGeneratingPodcast}
          >
            {isGeneratingPodcast ? (
              <>
                <div className="podcast-spinner" />
                Generating Audio...
              </>
            ) : (
              <>
                <Zap size={16} />
                Podcast Mode
              </>
            )}
          </button>
        ) : podcastData.status === 'error' ? (
          <div className="podcast-error">
            <strong>🎧 Audio generation failed</strong>
            <p>We encountered an issue creating your audio summary. This might be due to:</p>
            <ul>
              <li>Server connectivity issues</li>
              <li>Text content formatting problems</li>
              <li>Audio service temporary unavailability</li>
            </ul>
            <button 
              className="retry-podcast-btn"
              onClick={() => generatePodcast(contextInfo?.queryText)}
              disabled={isGeneratingPodcast}
            >
              {isGeneratingPodcast ? 'Generating...' : 'Try Again'}
            </button>
          </div>
        ) : (
          <div className="integrated-podcast-player">
            <div className="podcast-status">
              {podcastData.audio_url ? (
                <span className="status-ready"> Audio ready - Play below</span>
              ) : (
                <span className="status-script"> Audio is being processed...</span>
              )}
            </div>
            
            {podcastData.audio_url && (
              <div className="minimalist-player">
                <button 
                  className="integrated-play-button"
                  onClick={handlePlayPause}
                  title={isPlayingPodcast ? "Pause audio" : "Play audio"}
                >
                  {isPlayingPodcast ? <Pause size={18} /> : <Play size={18} />}
                  <span className="play-text">
                    {isPlayingPodcast ? 'Pause Audio' : 'Play Audio Summary'}
                  </span>
                </button>
                
                <audio 
                  ref={audioRef}
                  src={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:8080')}${podcastData.audio_url}`}
                  onPlay={() => setIsPlayingPodcast(true)}
                  onPause={() => setIsPlayingPodcast(false)}
                  onEnded={() => setIsPlayingPodcast(false)}
                  onTimeUpdate={handleAudioTimeUpdate}
                  onLoadedMetadata={handleAudioLoadedMetadata}
                  onError={(e) => {
                    console.error('Audio playback error:', e);
                    setIsPlayingPodcast(false);
                    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
                      (import.meta.env.PROD ? '' : 'http://localhost:8080');
                    e.target.src = `${API_BASE_URL}${podcastData.audio_url}?t=${Date.now()}`;
                  }}
                />
                
                <div className="audio-controls">
                  <div className="audio-time-display">
                    <span className="current-time">{formatTime(audioCurrentTime)}</span>
                    <button 
                      className="playback-speed-btn"
                      onClick={handlePlaybackSpeedChange}
                      title={`Current speed: ${audioPlaybackSpeed}x. Click to change speed.`}
                    >
                      {audioPlaybackSpeed}x
                    </button>
                    <span className="duration">{formatTime(audioDuration)}</span>
                  </div>
                  
                  <div 
                    className="audio-progress-bar"
                    onClick={handleSeek}
                  >
                    <div 
                      className={`progress-indicator ${isPlayingPodcast ? 'playing' : ''}`}
                      style={{ 
                        width: audioDuration > 0 ? `${(audioCurrentTime / audioDuration) * 100}%` : '0%' 
                      }}
                    ></div>
                  </div>
                </div>
                
                <div className="audio-action-buttons">
                  <button 
                    className="download-audio-btn"
                    onClick={() => handleAudioDownload(podcastData.audio_url)}
                    title="Download Audio"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                  
                  <button 
                    className="generate-new-audio-btn"
                    onClick={() => generatePodcast(contextInfo?.queryText)}
                    disabled={isGeneratingPodcast}
                    title="Generate new audio (will replace current audio)"
                  >
                    <Zap size={14} />
                    <span>{isGeneratingPodcast ? 'Generating...' : 'Generate New'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
            Related Snippets
            {connections.length > 0 && (
              <span className="tab-badge">{connections.length}</span>
            )}
          </button>
          
          <button 
            className={`tab-button insights-bulb-button ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('insights');
              // Always attempt to generate insights when button is clicked, even if insights already exist
              // The generateInsights function will handle confirmation if previous insights exist
              if (!isLoadingInsights && contextInfo && connections.length > 0) {
                generateInsightsFromContext();
              }
            }}
            disabled={!contextInfo || connections.length === 0}
            title={
              !contextInfo 
                ? 'Read document first to generate insights'
                : connections.length === 0 
                  ? 'No connections found yet - scroll through document'
                  : insights && insights.parsed
                    ? 'Generate new insights (will clear current insights)'
                    : `Generate AI insights from ${connections.length} connections`
            }
          >
            <div className="insights-button-content">
              <Lightbulb size={16} className="insights-bulb-icon" />
              <span>Insights</span>
            </div>
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
                <div className="empty-content">
                  <h3>Discover Related Snippets</h3>
                  <p>Start reading or select text - related snippets will automatically appear from your other documents.</p>
                  <div className="empty-tip">
                    <span className="tip-icon"></span>
                    <span>Both reading and text selection trigger the same unified workflow!</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="connections-list">
                <div className="connections-header">
                  <div className="header-content">
                    <h4>Related Snippets</h4>
                    <p className="header-subtitle">
                      Found {connections.length} relevant {connections.length === 1 ? 'snippet' : 'snippets'} 
                      {contextInfo?.source?.type === 'text_selection' 
                        ? ' from your selected text'
                        : ' from your reading context'
                      }
                    </p>
                    
                    {/* Source Information */}
                    <div className="sources-compact" style={{ marginTop: '8px' }}>
                      <div className="sources-toggle" style={{ cursor: 'default' }}>
                        <span className="sources-label">
                          Source: {contextInfo?.source?.type === 'text_selection' ? 'Selected text' : 'Reading context'}
                          {contextInfo?.source?.pageNumber ? ` from page ${contextInfo.source.pageNumber}` : ' from current page'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {connections.map(renderConnectionCard)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div className={`insights-tab-container ${showConfirmationOverlay ? 'overlay-active' : ''}`}>
            <div className="insights-content-wrapper">
              {renderInsightsContent()}
            </div>
            
            {/* Fixed Podcast Section - Always visible at bottom for insights */}
            <div className="insights-podcast-footer">
              {renderPodcastSection()}
            </div>
            
            {/* Professional Confirmation Overlay */}
            {showConfirmationOverlay && (
              <div className="confirmation-overlay">
                <div className="confirmation-backdrop" onClick={() => handleConfirmationResponse(false)} />
                <div className="confirmation-dialog">
                  <div className="confirmation-content">
                    <div className="confirmation-icon">
                      <Lightbulb size={20} />
                    </div>
                    <div className="confirmation-text">
                      <h4>Confirm Action</h4>
                      <p>{confirmationConfig.message}</p>
                    </div>
                  </div>
                  <div className="confirmation-actions">
                    <button 
                      className="confirmation-btn cancel-btn" 
                      onClick={() => handleConfirmationResponse(false)}
                    >
                      {confirmationConfig.cancelText}
                    </button>
                    <button 
                      className="confirmation-btn continue-btn" 
                      onClick={() => handleConfirmationResponse(true)}
                    >
                      {confirmationConfig.actionText}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default SynapsePanel;

