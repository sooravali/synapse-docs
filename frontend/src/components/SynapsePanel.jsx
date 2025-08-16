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
  currentContext, 
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
    if (!currentContext || isLoadingInsights) return;
    
    console.log(` UNIFIED WORKFLOW - Generating insights from current context: "${currentContext.substring(0, 50)}..."`);
    setActiveTab('insights'); // Switch to insights tab
    await generateInsights(currentContext, connections);
  };

  const generatePodcastFromContext = async () => {
    if (!currentContext || isGeneratingPodcast) return;
    
    console.log(` UNIFIED WORKFLOW - Generating podcast from current context: "${currentContext.substring(0, 50)}..."`);
    await generatePodcast(currentContext);
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
    
    // Try to extract page from context first using the correct pattern: (Page X)
    const pageMatch = context.match(/\(Page\s+(\d+)\)/i);
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

  // STAGE 1: Auto-search for connections when context changes (ENHANCED CACHING)
  useEffect(() => {
    console.log(` SynapsePanel: STAGE 1 - Context changed to: "${currentContext?.substring(0, 50)}..."`);
    
    if (!currentContext || currentContext.length <= 10) {
      console.log(` SynapsePanel: Context too short or empty, not searching`);
      // Clear insights when context becomes empty
      if (insights) {
        console.log(` SynapsePanel: Clearing insights due to empty context`);
        setInsights(null);
        setPodcastData(null);
        setInsightsMetadata(null);
        if (onInsightsGenerated) {
          onInsightsGenerated(false);
        }
      }
      return;
    }

    // Extract page context for intelligent caching
    const pageContext = extractPageContext(currentContext, selectedDocument);
    if (!pageContext) {
      console.log(` SynapsePanel: Could not extract page context, skipping search`);
      return;
    }

    console.log(` SynapsePanel: Page context:`, pageContext);

    // ENHANCED INSIGHTS STABILITY: Intelligent insights clearing logic
    const shouldClearInsights = (() => {
      // Never clear if no insights exist
      if (!insights) return false;
      
      // Never clear if no previous page context
      if (!lastPageContextRef.current) return false;
      
      // Check if context identifiers are different
      const contextChanged = lastPageContextRef.current.identifier !== pageContext.identifier;
      if (!contextChanged) return false;
      
      // STABILITY RULE 1: Never clear insights from text selections (explicit user actions)
      if (insightsMetadata && insightsMetadata.sourceType === 'selection') {
        console.log(` SynapsePanel: Preserving insights from text selection - not clearing`);
        return false;
      }
      
      // STABILITY RULE 2: Don't clear insights too quickly after generation (stability period)
      if (insightsMetadata && insightsMetadata.generatedAt) {
        const timeSinceGeneration = Date.now() - insightsMetadata.generatedAt;
        const stabilityPeriod = 10000; // 10 seconds stability period
        
        if (timeSinceGeneration < stabilityPeriod) {
          console.log(` SynapsePanel: Insights still in stability period (${Math.round(timeSinceGeneration/1000)}s < 10s) - not clearing`);
          return false;
        }
      }
      
      // STABILITY RULE 3: Don't clear for text selections within the same general context
      if (pageContext.isTextSelection) {
        console.log(` SynapsePanel: New text selection detected - not clearing previous insights`);
        return false;
      }
      
      // STABILITY RULE 4: Only clear for significant document/page changes
      const isSignificantChange = lastPageContextRef.current.documentId !== pageContext.documentId ||
        (lastPageContextRef.current.pageNumber !== undefined && 
         pageContext.pageNumber !== undefined && 
         Math.abs(lastPageContextRef.current.pageNumber - pageContext.pageNumber) > 2);
      
      if (!isSignificantChange) {
        console.log(` SynapsePanel: Context change not significant enough - preserving insights`);
        return false;
      }
      
      console.log(` SynapsePanel: Significant context change detected - clearing insights`);
      return true;
    })();

    if (shouldClearInsights) {
      console.log(` SynapsePanel: Clearing insights due to significant context change`);
      setInsights(null);
      setPodcastData(null);
      setExpandedInsights({});
      setInsightsMetadata(null);
      if (onInsightsGenerated) {
        onInsightsGenerated(false);
      }
    }

    // TEXT SELECTION: Always search immediately, don't use cache
    if (pageContext.isTextSelection) {
      console.log(` SynapsePanel: TEXT SELECTION detected - bypassing cache and searching immediately`);
      searchForConnections(currentContext, pageContext);
      lastQueryRef.current = currentContext;
      lastPageContextRef.current = pageContext;
      return;
    }

    // READING CONTEXT: Use normal caching logic
    // OPTIMIZATION: Check if this is the same page context as the last one
    if (lastPageContextRef.current && 
        lastPageContextRef.current.identifier === pageContext.identifier &&
        connections.length > 0) {
      console.log(` SynapsePanel: Same page context as last time with existing connections, skipping duplicate API call`);
      return;
    }

    // ENHANCED CACHING: Check cache with similarity detection (only for reading contexts)
    const cacheKey = `${pageContext.documentId}:${pageContext.identifier}`;
    const cachedEntry = connectionsCache.current.get(cacheKey);
    
    if (cachedEntry) {
      console.log(` SynapsePanel: Found cached results for page ${pageContext.identifier}`);
      
      // For content-based caching, verify content similarity
      if (pageContext.isContentBased && cachedEntry.contentHash !== pageContext.contentHash) {
        console.log(` SynapsePanel: Content hash mismatch, checking similarity...`);
        
        // Simple similarity check - if hashes are different but close, still use cache
        const hashDiff = Math.abs(parseInt(cachedEntry.contentHash) - parseInt(pageContext.contentHash));
        const similarityThreshold = 1000; // Adjust as needed
        
        if (hashDiff > similarityThreshold) {
          console.log(` SynapsePanel: Content significantly different (hash diff: ${hashDiff}), will search again`);
        } else {
          console.log(` SynapsePanel: Content similar enough (hash diff: ${hashDiff}), using cache`);
          setConnections(cachedEntry.results);
          lastPageContextRef.current = pageContext;
          
          // SMART TAB MANAGEMENT: Don't auto-switch if user is actively viewing insights
          if (activeTab !== 'insights') {
            console.log(` SynapsePanel: Auto-switching to connections tab (user not viewing insights)`);
            setActiveTab('connections');
          }
          
          if (onConnectionsUpdate) {
            onConnectionsUpdate(cachedEntry.results);
          }
          return;
        }
      } else {
        // Page-based cache hit
        console.log(` SynapsePanel: Using cached results for page ${pageContext.identifier}`);
        setConnections(cachedEntry.results);
        lastPageContextRef.current = pageContext;
        
        // SMART TAB MANAGEMENT
        if (activeTab !== 'insights') {
          setActiveTab('connections');
        }
        
        if (onConnectionsUpdate) {
          onConnectionsUpdate(cachedEntry.results);
        }
        return;
      }
    }

    // OPTIMIZATION: Clear any pending search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // INSTANT SEARCH: No debounce delay for immediate response
    console.log(` SynapsePanel: IMMEDIATE search triggered for page: ${pageContext.identifier}`);
    searchForConnections(currentContext, pageContext);

    // Update last query and page context references
    lastQueryRef.current = currentContext;
    lastPageContextRef.current = pageContext;

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [currentContext, selectedDocument, activeTab, connections.length, onConnectionsUpdate, insights, onInsightsGenerated]);

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

  const searchForConnections = async (query, pageContext) => {
    console.log(` SynapsePanel: STAGE 1 - Starting enhanced connections search for page: ${pageContext?.identifier || 'unknown'}`);
    console.log(` Full query text being sent:`, query.substring(0, 100) + '...');
    
    // OPTIMIZATION: Prevent concurrent requests
    if (isLoadingConnections) {
      console.log(` SynapsePanel: Already loading connections, skipping...`);
      return;
    }
    
    setIsLoadingConnections(true);
    
    try {
      console.log(` SynapsePanel: Making API call to semantic search...`);
      
      // Request at least 5 results to ensure we get 3+ relevant sections (hackathon requirement)
      const results = await searchAPI.semantic({
        query_text: query,
        top_k: 5,
        similarity_threshold: 0.1  // Very low threshold to ensure we get results
      });
      
      console.log(` SynapsePanel: API response received:`, results);
      
      const connections = results.results || [];
      console.log(` SynapsePanel: Found ${connections.length} raw connections`);
      
      // Filter for >80% accuracy where possible, but show at least 3 results
      const highAccuracyConnections = connections.filter(conn => conn.similarity_score > 0.8);
      const finalConnections = highAccuracyConnections.length >= 3 
        ? highAccuracyConnections.slice(0, 3)
        : connections.slice(0, Math.max(3, connections.length));
      
      console.log(` STAGE 1 - Found ${finalConnections.length} connections (requirement: ≥3 with >80% accuracy)`);
      console.log(` Accuracy distribution:`, finalConnections.map(c => `${Math.round(c.similarity_score * 100)}%`));
      
      // ENHANCED CACHING: Cache by page context with content hash
      if (pageContext) {
        const cacheKey = `${pageContext.documentId}:${pageContext.identifier}`;
        const cacheEntry = {
          results: finalConnections,
          contentHash: pageContext.contentHash,
          timestamp: Date.now()
        };
        connectionsCache.current.set(cacheKey, cacheEntry);
        console.log(` SynapsePanel: Cached results for page ${pageContext.identifier} (cache size: ${connectionsCache.current.size})`);
      } else {
        // Fallback to query-based caching
        connectionsCache.current.set(query, finalConnections);
        console.log(` SynapsePanel: Cached results with query fallback (cache size: ${connectionsCache.current.size})`);
      }
      
      setConnections(finalConnections);
      console.log(` SynapsePanel: Updated connections state with ${finalConnections.length} items`);
      
      // SMART TAB MANAGEMENT: Don't auto-switch if user is actively viewing insights
      if (activeTab !== 'insights') {
        console.log(` SynapsePanel: Auto-switching to connections tab (user not viewing insights)`);
        setActiveTab('connections');
      } else {
        console.log(`� SynapsePanel: User is viewing insights, preserving current tab`);
      }
      console.log(` SynapsePanel: Stage 1 completed with smart tab management`);
      
      // Notify parent about connections update for potential insights context
      if (onConnectionsUpdate) {
        onConnectionsUpdate(finalConnections);
        console.log(` SynapsePanel: Notified parent of connections update`);
      }
    } catch (error) {
      console.error(' SynapsePanel: STAGE 1 - Failed to search for connections:', error);
      setConnections([]);
    } finally {
      setIsLoadingConnections(false);
      console.log(` SynapsePanel: STAGE 1 - Connections search completed`);
    }
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
          key_insights: [`Parsing failed. Raw content: ${result.insights}`],
          did_you_know: [],
          contradictions: [],
          connections: []
        };
      }
      
      // Clean filename references in all insight text content
      const cleanInsightArray = (insights) => {
        if (!Array.isArray(insights)) return insights;
        return insights.map(insight => cleanInsightText(insight));
      };

      // Apply cleaning to all insight sections
      if (parsedInsights) {
        if (parsedInsights.key_insights) {
          parsedInsights.key_insights = cleanInsightArray(parsedInsights.key_insights);
        }
        if (parsedInsights.did_you_know) {
          parsedInsights.did_you_know = cleanInsightArray(parsedInsights.did_you_know);
        }
        if (parsedInsights.contradictions) {
          parsedInsights.contradictions = cleanInsightArray(parsedInsights.contradictions);
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
                if (currentContext) {
                  generateInsights(currentContext, connections);
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
                                          <span key={page} className="page-tag">p.{page}</span>
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
                                      <span key={page} className="page-tag">p.{page}</span>
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
          {parsed.key_insights && parsed.key_insights.length > 0 && (
            <div className="insight-card compact">
              <h4 className="insight-card-title">Key Insights</h4>
              {(() => {
                const { visible, hasMore, isExpanded } = getTruncatedInsights(parsed.key_insights, 'key_insights', 2);
                return (
                  <>
                    <ul className="insight-list compact">
                      {visible.map((insight, index) => (
                        <li key={index}>{insight}</li>
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
                      {visible.map((fact, index) => (
                        <li key={index}>{fact}</li>
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

          {parsed.contradictions && parsed.contradictions.length > 0 && (
            <div className="insight-card compact">
              <h4 className="insight-card-title">Contradictions & Nuances</h4>
              {(() => {
                const { visible, hasMore, isExpanded } = getTruncatedInsights(parsed.contradictions, 'contradictions', 2);
                return (
                  <>
                    <ul className="insight-list compact">
                      {visible.map((contradiction, index) => (
                        <li key={index}>{contradiction}</li>
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

          {parsed.connections && parsed.connections.length > 0 && (
            <div className="insight-card compact">
              <h4 className="insight-card-title">Cross-Document Connections</h4>
              {(() => {
                const { visible, hasMore, isExpanded } = getTruncatedInsights(parsed.connections, 'connections', 2);
                return (
                  <>
                    <ul className="insight-list compact">
                      {visible.map((connection, index) => (
                        <li key={index}>{connection}</li>
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

        {/* Integrated Podcast Mode within the panel */}
        <div className="integrated-podcast-section">
          <div className="podcast-header">
            <h4 className="podcast-section-title">Generate Audio Summary</h4>
            {(() => {
              // Display page information for podcast section
              const pageInfo = getPageInfoForDisplay(currentContext, connections);
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
              onClick={() => generatePodcast(currentContext)}
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
                  Generate Audio Summary
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
                onClick={() => generatePodcast(currentContext)}
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
                      onClick={() => generatePodcast(currentContext)}
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
            className={`tab-button insights-bulb-button ${activeTab === 'insights' ? 'active' : ''} ${isLoadingInsights ? 'loading' : ''}`}
            onClick={() => {
              setActiveTab('insights');
              // Always attempt to generate insights when button is clicked, even if insights already exist
              // The generateInsights function will handle confirmation if previous insights exist
              if (!isLoadingInsights && currentContext && connections.length > 0) {
                generateInsightsFromContext();
              }
            }}
            disabled={!currentContext || connections.length === 0 || isLoadingInsights}
            title={
              !currentContext 
                ? 'Read document first to generate insights'
                : connections.length === 0 
                  ? 'No connections found yet - scroll through document'
                  : insights && insights.parsed
                    ? 'Generate new insights (will clear current insights)'
                    : `Generate AI insights from ${connections.length} connections`
            }
          >
            <div className="insights-button-content">
              {isLoadingInsights ? (
                <>
                  <div className="bulb-spinner"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Lightbulb size={16} className="insights-bulb-icon" />
                  <span>AI Insights</span>
                </>
              )}
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
                    <span className="tip-icon">💡</span>
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
                      {currentContext?.includes('[Selected Text from') 
                        ? ' from your selected text'
                        : ' from your reading context'
                      }
                    </p>
                    
                    {/* Source Information - Show the page where user is currently reading/selected text from */}
                    {(() => {
                      // Extract page information from the current context
                      // Handle the enhanced format: [Selected Text from doc (Page X)] or [Reading context from doc (Page X)]
                      const pageMatch = currentContext?.match(/\(Page\s+(\d+)\)/i);
                      const isTextSelection = currentContext?.includes('[Selected Text from');
                      const isReadingContext = currentContext?.includes('[Reading context from');
                      
                      return (
                        <div className="connections-source-info">
                          {isTextSelection ? (
                            <p className="context-source">
                              📄 Source: Text selected from {cleanFileName(selectedDocument?.file_name) || 'document'}
                              {pageMatch && (
                                <span className="source-page"> • Page {pageMatch[1]}</span>
                              )}
                            </p>
                          ) : isReadingContext ? (
                            <p className="context-source">
                              📖 Source: Reading context from {cleanFileName(selectedDocument?.file_name) || 'document'}
                              {pageMatch && (
                                <span className="source-page"> • Page {pageMatch[1]}</span>
                              )}
                            </p>
                          ) : (
                            <p className="context-source">
                              📖 Source: Reading context from {cleanFileName(selectedDocument?.file_name) || 'document'}
                            </p>
                          )}
                        </div>
                      );
                    })()}
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

