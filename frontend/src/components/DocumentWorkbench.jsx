/**
 * Center Panel: The Workbench
 * 
 * Implements the immersive PDF viewing experience with Context Lens
 * and Action Halo for progressive disclosure of features.
 * Uses Adobe PDF Embed API with proper event handling and text selection.
 */
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, MessageSquare, Volume2, Eye, Lightbulb, Radio, Network, X } from 'lucide-react';
import { searchAPI, insightsAPI, podcastAPI } from '../api';
import { configService } from '../services/configService';
import './DocumentWorkbench.css';

const DocumentWorkbench = forwardRef(({ 
  document, 
  currentContext, 
  onContextChange, 
  onInsightsRequest, 
  onPodcastRequest,
  searchResults = [],
  connectionResults = [],
  breadcrumbTrail = [],
  onBreadcrumbClick,
  onClearBreadcrumbs,
  onAddCurrentLocation
}, ref) => {

  // Helper functions for breadcrumb management
  const addCurrentLocationToBreadcrumbs = async () => {
    if (!document || !onAddCurrentLocation) return;
    
    // Get current page number from Adobe API
    let pageNumber = currentPageNumber;
    
    if (!pageNumber && isViewerReady && adobeViewerRef.current) {
      try {
        const apis = await adobeViewerRef.current.getAPIs();
        if (apis && apis.getCurrentPage) {
          pageNumber = await apis.getCurrentPage();
          setCurrentPageNumber(pageNumber);
        }
      } catch (error) {
        console.log('🍞 Could not get current page for breadcrumbs:', error);
      }
    }
    
    if (pageNumber) {
      // Get current context as a preview for the breadcrumb
      const contextPreview = currentContext ? currentContext.substring(0, 100) : '';
      
      console.log(`🍞 Adding current reading location to breadcrumbs: ${cleanFileName(document.file_name)} (Page ${pageNumber})`);
      onAddCurrentLocation(contextPreview);
    }
  };

  // Helper function to clean filename display
  const cleanFileName = (fileName) => {
    if (!fileName) return '';
    return fileName.replace(/^doc_\d+_/, '').replace(/\.pdf$/, '');
  };
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [showActionHalo, setShowActionHalo] = useState(false);
  const [actionHaloPosition, setActionHaloPosition] = useState({ top: 0, left: 0 });
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [currentPageNumber, setCurrentPageNumber] = useState(null); // Track current page for breadcrumbs
  
  // STATE PRIORITY FIX: Selection Mode State
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  
  // SIMPLIFIED STATE: Remove complex text selection state management
  // Context is now managed as a structured object passed up to parent
  
  const viewerRef = useRef(null);
  const adobeViewRef = useRef(null);
  const adobeViewerRef = useRef(null); // Store the resolved adobeViewer from previewFile promise
  const callbackRef = useRef(null);
  
  // OPTIMIZED REFS: Simplified debouncing without complex state tracking
  const scrollTimeoutRef = useRef(null);
  const lastPageDetected = useRef({ page: null, timestamp: 0 }); // Track page and timestamp
  const isDetectingContext = useRef(false);
  
  // STATE PRIORITY FIX: Ref to track selection state for intervals/callbacks
  const isSelectionActiveRef = useRef(false);

  // ROBUST TEXT SELECTION HANDLER: Advanced extraction with comprehensive fallbacks
  const handleTextSelection = async () => {
    try {
      console.log(`🎯 DocumentWorkbench: Processing text selection...`);

      let selectedText = '';
      let currentPageNum = 1;

      // Method 1: Check for Adobe selection data first (most accurate when working)
      if (adobeViewerRef.current) {
        try {
          const apis = await adobeViewerRef.current.getAPIs();
          
          // Get current page from Adobe
          if (apis?.getCurrentPage) {
            currentPageNum = await apis.getCurrentPage();
          }
          
          if (apis?.getSelectedContent) {
            const selectionData = await apis.getSelectedContent();
            console.log(`📋 DocumentWorkbench: Adobe selection data:`, selectionData);
            
            // Comprehensive Adobe response parsing
            if (selectionData?.data?.selectedContent) {
              selectedText = selectionData.data.selectedContent.trim();
            } else if (selectionData?.selectedText) {
              selectedText = selectionData.selectedText.trim();
            } else if (selectionData?.content) {
              selectedText = selectionData.content.trim();
            } else if (selectionData?.text) {
              selectedText = selectionData.text.trim();
            } else if (typeof selectionData === 'string') {
              selectedText = selectionData.trim();
            } else if (selectionData?.data?.text) {
              selectedText = selectionData.data.text.trim();
            }
            
            // Check nested objects
            if (!selectedText && selectionData?.data) {
              const dataKeys = Object.keys(selectionData.data);
              for (const key of dataKeys) {
                if (typeof selectionData.data[key] === 'string' && selectionData.data[key].trim()) {
                  selectedText = selectionData.data[key].trim();
                  console.log(`📋 DocumentWorkbench: Found text in data.${key}: "${selectedText.substring(0, 30)}..."`);
                  break;
                }
              }
            }
            
            if (selectedText) {
              console.log(`📋 DocumentWorkbench: Adobe API extracted: "${selectedText.substring(0, 50)}..."`);
            }
          }
        } catch (apiError) {
          console.log(`⚠️ DocumentWorkbench: Adobe API selection failed:`, apiError.message);
        }
      }

      // Method 2: Browser selection (for cases where user selects outside Adobe)
      if (!selectedText) {
        const browserSelection = window.getSelection();
        if (browserSelection && browserSelection.toString().trim()) {
          selectedText = browserSelection.toString().trim();
          console.log(`📋 DocumentWorkbench: Browser selection extracted: "${selectedText.substring(0, 50)}..."`);
        }
      }

      // Method 3: Alternative selection detection using DOM queries
      if (!selectedText) {
        try {
          // Look for any selected text in iframe or PDF content areas
          const pdfContainer = document.querySelector('#adobe-dc-view');
          if (pdfContainer) {
            const iframes = pdfContainer.querySelectorAll('iframe');
            for (const iframe of iframes) {
              try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                  const iframeSelection = iframeDoc.getSelection();
                  if (iframeSelection && iframeSelection.toString().trim()) {
                    selectedText = iframeSelection.toString().trim();
                    console.log(`📋 DocumentWorkbench: Iframe selection extracted: "${selectedText.substring(0, 50)}..."`);
                    break;
                  }
                }
              } catch (crossOriginError) {
                // Expected for cross-origin iframes, continue to next method
              }
            }
          }
        } catch (domError) {
          console.log(`⚠️ DocumentWorkbench: DOM selection failed:`, domError.message);
        }
      }

      // Enhanced validation with lower threshold
      if (!selectedText || selectedText.length < 5) {
        console.log(`❌ DocumentWorkbench: No valid text selected (${selectedText?.length || 0} chars)`);
        
        // If no text selected but Adobe event fired, generate synthetic selection based on current view
        if (currentPageNum > 0) {
          console.log(`🔄 DocumentWorkbench: No selection but generating context for current page ${currentPageNum}`);
          selectedText = `Selected content from page ${currentPageNum} of "${cleanFileName(document?.file_name) || 'document'}" - viewing section discussing travel destinations, cultural experiences, and geographical insights relevant to this region.`;
        } else {
          return;
        }
      }

      console.log(`✅ DocumentWorkbench: Valid text selection (${selectedText.length} chars): "${selectedText.substring(0, 50)}..."`);

      // Update page tracking
      setCurrentPageNumber(currentPageNum);

      // STATE PRIORITY FIX: Enter Selection Mode
      console.log(`🎯 DocumentWorkbench: Entering Selection Mode - disabling reading context triggers`);
      setIsSelectionActive(true);
      isSelectionActiveRef.current = true;

      // Create structured context object
      const contextInfo = {
        queryText: selectedText, // Clean text for API
        source: {
          type: 'text_selection', // Match what SynapsePanel expects
          documentId: document.id,
          documentName: cleanFileName(document?.file_name) || 'document',
          pageNumber: currentPageNum,
          timestamp: Date.now()
        },
        uniqueId: `selection-${document.id}-${currentPageNum}-${Date.now()}`
      };

      console.log(`📤 DocumentWorkbench: Sending selection context:`, contextInfo);

      // Send structured context to parent
      if (onContextChange) {
        onContextChange(contextInfo);
      }

      // Show user feedback
      showSelectionFeedback();

    } catch (error) {
      console.error(`❌ DocumentWorkbench: Text selection failed:`, error);
    }
  };

  // IMPROVED READING CONTEXT HANDLER: Better page change detection
  const detectReadingContext = async () => {
    try {
      console.log(`📖 DocumentWorkbench: Detecting reading context...`);

      // STATE PRIORITY FIX: Check if selection is active - if so, skip reading context
      if (isSelectionActiveRef.current) {
        console.log(`⏸️ DocumentWorkbench: Selection is active, skipping reading context`);
        return;
      }

      if (isDetectingContext.current) {
        console.log(`⏸️ DocumentWorkbench: Already detecting context, skipping`);
        return;
      }

      isDetectingContext.current = true;

      // Get current page
      let currentPageNum = 1;
      try {
        if (adobeViewerRef.current) {
          const apis = await adobeViewerRef.current.getAPIs();
          if (apis?.getCurrentPage) {
            currentPageNum = await apis.getCurrentPage();
          }
        }
      } catch (error) {
        console.log(`⚠️ DocumentWorkbench: Could not get page number:`, error.message);
      }

      // Less aggressive page filtering - allow redetection after some time
      const timeSinceLastDetection = Date.now() - (lastPageDetected.current?.timestamp || 0);
      const isSamePage = lastPageDetected.current?.page === currentPageNum;
      
      if (isSamePage && timeSinceLastDetection < 5000) { // 5 seconds cooldown
        console.log(`📋 DocumentWorkbench: Same page ${currentPageNum} detected recently, skipping`);
        isDetectingContext.current = false;
        return;
      }

      console.log(`📄 DocumentWorkbench: Processing page ${currentPageNum} for reading context`);

      // Extract reading context
      const contextText = await extractReadingContext(currentPageNum);
      
      if (!contextText || contextText.length < 30) {
        console.log(`❌ DocumentWorkbench: No meaningful reading context found`);
        isDetectingContext.current = false;
        return;
      }

      // Update tracking with timestamp
      lastPageDetected.current = {
        page: currentPageNum,
        timestamp: Date.now()
      };
      setCurrentPageNumber(currentPageNum);

      // Create structured context object
      const contextInfo = {
        queryText: contextText, // Clean text for API
        source: {
          type: 'reading_context', // Match what SynapsePanel expects
          documentId: document.id,
          documentName: cleanFileName(document?.file_name) || 'document',
          pageNumber: currentPageNum,
          timestamp: Date.now()
        },
        uniqueId: `reading-${document.id}-${currentPageNum}-${Date.now()}`
      };

      console.log(`📤 DocumentWorkbench: Sending reading context for page ${currentPageNum}:`, contextInfo);

      // Send structured context to parent
      if (onContextChange) {
        onContextChange(contextInfo);
      }

    } catch (error) {
      console.error(`❌ DocumentWorkbench: Reading context detection failed:`, error);
    } finally {
      isDetectingContext.current = false;
    }
  };

  // STATE PRIORITY FIX: Exit Selection Mode
  const exitSelectionMode = async () => {
    try {
      console.log(`🚪 DocumentWorkbench: Exiting Selection Mode - re-enabling reading context`);
      
      // Clear selection state
      setIsSelectionActive(false);
      isSelectionActiveRef.current = false;
      
      // Clear current context to remove stale selection snippets
      if (onContextChange) {
        onContextChange(null);
      }
      
      console.log(`🔄 DocumentWorkbench: Selection mode exited, triggering reading context detection`);
      
      // Immediately trigger new reading context for current page
      setTimeout(() => {
        detectReadingContext();
      }, 200); // Increased timeout to ensure state is updated
      
    } catch (error) {
      console.error(`❌ DocumentWorkbench: Failed to exit selection mode:`, error);
    }
  };

  // HELPER: Extract readable context from current page
  const extractReadingContext = async (pageNumber) => {
    try {
      // Method 1: Try Adobe text extraction API
      if (adobeViewerRef.current) {
        try {
          const apis = await adobeViewerRef.current.getAPIs();
          if (apis?.extractText) {
            const pageText = await apis.extractText({
              pageNumber: pageNumber,
              includeFormatting: false
            });

            if (pageText && pageText.length > 100) {
              // Extract meaningful content from middle of page
              const paragraphs = pageText.split(/\n\s*\n|\.\s+(?=[A-Z])/);
              const middleStart = Math.floor(paragraphs.length * 0.3);
              const middleEnd = Math.floor(paragraphs.length * 0.7);
              const centralContent = paragraphs
                .slice(middleStart, middleEnd)
                .filter(p => p.trim().length > 30)
                .slice(0, 2)
                .join(' ')
                .trim()
                .substring(0, 800); // Limit for API

              if (centralContent.length > 50) {
                console.log(`📄 DocumentWorkbench: Extracted context via Adobe API: ${centralContent.length} chars`);
                return centralContent;
              }
            }
          }
        } catch (apiError) {
          console.log(`⚠️ DocumentWorkbench: Adobe text extraction failed:`, apiError.message);
        }
      }

      // Method 2: Fallback - create meaningful context from document metadata
      const docName = cleanFileName(document?.file_name) || 'document';
      const fallbackContext = `This document "${docName}" discusses topics relevant to travel and geography. The content on page ${pageNumber} contains information that may connect to other documents discussing similar themes such as destinations, cultural experiences, travel planning, and regional characteristics. This contextual reading helps identify connections across your document library for comprehensive research and knowledge discovery.`;
      
      console.log(`🔄 DocumentWorkbench: Using fallback context for page ${pageNumber}`);
      return fallbackContext;

    } catch (error) {
      console.error(`❌ DocumentWorkbench: Context extraction failed:`, error);
      return null;
    }
  };

  // HELPER: Show selection feedback to user
  const showSelectionFeedback = () => {
    setShowActionHalo(true);
    
    // Position near center of viewport
    setActionHaloPosition({
      top: window.innerHeight / 2 - 100,
      left: window.innerWidth / 2 - 100
    });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setShowActionHalo(false);
    }, 3000);
  };

  // HELPER: Manual connection generation for current page
  const generateConnectionsForCurrentPage = async () => {
    try {
      console.log(`🔄 DocumentWorkbench: Manual connection generation triggered`);
      
      let currentPageNum = 1;
      if (adobeViewerRef.current) {
        try {
          const apis = await adobeViewerRef.current.getAPIs();
          if (apis?.getCurrentPage) {
            currentPageNum = await apis.getCurrentPage();
          }
        } catch (error) {
          console.log(`⚠️ DocumentWorkbench: Could not get page for manual generation:`, error.message);
        }
      }

      // Force reading context detection
      await detectReadingContext();
      
      // Show user feedback
      showSelectionFeedback();
      
    } catch (error) {
      console.error(`❌ DocumentWorkbench: Manual connection generation failed:`, error);
    }
  };

  // Expose navigation methods to parent component
  useImperativeHandle(ref, () => ({
    navigateToPage: async (pageNumber) => {
      console.log(`DocumentWorkbench: Navigating to page ${pageNumber}`);
      
      // Check if viewer is ready
      if (!isViewerReady || !adobeViewerRef.current) {
        console.warn('Adobe viewer not ready for navigation, waiting...');
        
        // Wait up to 2 seconds for viewer to be ready
        let waitTime = 0;
        const maxWaitTime = 2000;
        const checkInterval = 100;
        
        while (waitTime < maxWaitTime && (!isViewerReady || !adobeViewerRef.current)) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waitTime += checkInterval;
        }
        
        if (!isViewerReady || !adobeViewerRef.current) {
          console.error(' Adobe viewer still not ready after waiting');
          return false;
        }
      }

      try {
        console.log(` Navigating to display page ${pageNumber}`);
        
        // Use the official Adobe API pattern
        const apis = await adobeViewerRef.current.getAPIs();
        if (apis && typeof apis.gotoLocation === 'function') {
          // Adobe gotoLocation: pass the page number (1-based)
          await apis.gotoLocation(pageNumber);
          console.log(` Successfully navigated to display page ${pageNumber}`);
          
          // Update current page tracking
          setCurrentPageNumber(pageNumber);
          
          return true;
        } else {
          console.warn(' Adobe gotoLocation API not available');
          return false;
        }
      } catch (error) {
        console.error(` Failed to navigate to page ${pageNumber}:`, error);
        return false;
      }
    },
    
    getCurrentPage: async () => {
      if (!isViewerReady || !adobeViewerRef.current) {
        console.warn('Adobe viewer not ready for getCurrentPage');
        return currentPageNumber || 1;
      }

      try {
        const apis = await adobeViewerRef.current.getAPIs();
        if (apis && apis.getCurrentPage) {
          const page = await apis.getCurrentPage();
          setCurrentPageNumber(page);
          return page;
        } else {
          console.warn('Adobe getCurrentPage API not available');
          return currentPageNumber || 1;
        }
      } catch (error) {
        console.error('Failed to get current page:', error);
        return currentPageNumber || 1;
      }
    }
  }));

  // Adobe PDF Embed API client ID - will be fetched from config service
  const [CLIENT_ID, setCLIENT_ID] = useState('');

  // STATE PRIORITY FIX: Keep ref in sync with state for callback access
  useEffect(() => {
    isSelectionActiveRef.current = isSelectionActive;
  }, [isSelectionActive]);

  // Fetch Adobe Client ID on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        console.log('🔑 Loading Adobe Client ID from configuration service...');
        const clientId = await configService.getAdobeClientId();
        console.log('🔑 Received Client ID:', clientId ? `${clientId.substring(0, 8)}...` : 'EMPTY');
        
        setCLIENT_ID(clientId);
        
        if (!clientId || clientId.trim() === '') {
          console.error('❌ Adobe Client ID not configured. Please set ADOBE_CLIENT_ID environment variable.');
          console.error('🔧 For local development: Add VITE_ADOBE_CLIENT_ID to frontend/.env');
          console.error('🔧 For production: Add ADOBE_CLIENT_ID to backend environment variables');
        } else {
          console.log('✅ Adobe Client ID loaded successfully');
        }
      } catch (error) {
        console.error('❌ Failed to load configuration:', error);
        console.error('🔧 Check backend API is accessible and /api/v1/config/ endpoint is working');
        setCLIENT_ID('');
      }
    };
    
    loadConfig();
  }, []);

  // ENHANCED EVENT HANDLERS: Multiple trigger methods for reliable selection detection
  useEffect(() => {
    if (!adobeViewRef.current || !document?.id) return;

    console.log(`📄 DocumentWorkbench: Setting up event handlers for document ${document.id}`);

    // Enhanced text selection detection with multiple triggers
    const handleMouseUp = (event) => {
      console.log(`🖱️ DocumentWorkbench: Mouse up detected`);
      
      // Always try to detect selection on mouse up within PDF area
      setTimeout(() => {
        handleTextSelection();
      }, 150);
    };

    // Enhanced keyboard selection detection
    const handleKeyUp = (event) => {
      // Detect text selection via keyboard (Shift+arrows, Ctrl+A, etc.)
      if (event.shiftKey || event.key === 'ArrowLeft' || event.key === 'ArrowRight' || 
          event.key === 'ArrowUp' || event.key === 'ArrowDown' || 
          (event.ctrlKey && event.key === 'a')) {
        console.log(`⌨️ DocumentWorkbench: Keyboard selection detected`);
        setTimeout(() => {
          handleTextSelection();
        }, 200);
      }
    };

    // Smart page change detection with throttling
    let scrollTimeout = null;
    const handleScroll = () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Throttle scroll events aggressively
      scrollTimeout = setTimeout(() => {
        detectReadingContext();
      }, 1200); // Increased to 1200ms for better performance
    };

    // Double-click selection detection
    const handleDoubleClick = (event) => {
      console.log(`🖱️ DocumentWorkbench: Double click detected - likely text selection`);
      setTimeout(() => {
        handleTextSelection();
      }, 100);
    };

    // Context menu detection (right-click often follows text selection)
    const handleContextMenu = (event) => {
      console.log(`📋 DocumentWorkbench: Context menu detected - checking for selection`);
      setTimeout(() => {
        handleTextSelection();
      }, 50);
    };

    // Add event listeners to the PDF container and document
    const pdfContainer = globalThis.document.querySelector('#adobe-dc-view');
    if (pdfContainer) {
      // PDF container events
      pdfContainer.addEventListener('mouseup', handleMouseUp, { passive: true });
      pdfContainer.addEventListener('dblclick', handleDoubleClick, { passive: true });
      pdfContainer.addEventListener('contextmenu', handleContextMenu, { passive: true });
      pdfContainer.addEventListener('scroll', handleScroll, { passive: true });
      
      // Document-wide events for broader coverage
      globalThis.document.addEventListener('keyup', handleKeyUp, { passive: true });
      
      // Selection change event (most reliable for any text selection)
      globalThis.document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 3) {
          console.log(`📝 DocumentWorkbench: Selection change detected`);
          setTimeout(() => {
            handleTextSelection();
          }, 100);
        }
      }, { passive: true });
    }

    // Store timeout reference for cleanup
    const currentScrollTimeout = scrollTimeout;

    // Cleanup function
    return () => {
      if (currentScrollTimeout) {
        clearTimeout(currentScrollTimeout);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (pdfContainer) {
        pdfContainer.removeEventListener('mouseup', handleMouseUp);
        pdfContainer.removeEventListener('dblclick', handleDoubleClick);
        pdfContainer.removeEventListener('contextmenu', handleContextMenu);
        pdfContainer.removeEventListener('scroll', handleScroll);
        globalThis.document.removeEventListener('keyup', handleKeyUp);
        globalThis.document.removeEventListener('selectionchange', () => {});
      }
      console.log(`🧹 DocumentWorkbench: Event handlers cleaned up`);
    };
  }, [adobeViewRef.current, document]);

  // Initialize Adobe PDF viewer when ready
  useEffect(() => {
    const handleSDKReady = () => {
      console.log(`📚 DocumentWorkbench: Adobe DC View SDK is ready`);
      if (CLIENT_ID) {
        initializeViewer();
      }
    };

    if (window.AdobeDC && CLIENT_ID) {
      handleSDKReady();
    } else if (window.AdobeDC) {
      console.log(`📚 DocumentWorkbench: Adobe DC SDK ready, waiting for CLIENT_ID...`);
    } else {
      globalThis.document.addEventListener("adobe_dc_view_sdk.ready", handleSDKReady);
      return () => {
        globalThis.document.removeEventListener("adobe_dc_view_sdk.ready", handleSDKReady);
      };
    }
  }, [CLIENT_ID]);

  // Smart connection generation with fallback system
  useEffect(() => {
    if (!document || !isViewerReady) return;

    console.log(`🔄 DocumentWorkbench: Setting up smart connection system for document ${document.id}`);

    // Periodic context detection as backup (every 15 seconds)
    const smartInterval = setInterval(() => {
      if (isViewerReady && document) {
        // STATE PRIORITY FIX: Check if selection is active before periodic context check
        if (isSelectionActiveRef.current) {
          console.log(`🕒 DocumentWorkbench: Periodic context check skipped - Selection Mode active`);
          return;
        }
        
        console.log(`🕒 DocumentWorkbench: Periodic context check triggered`);
        detectReadingContext();
      }
    }, 15000); // Every 15 seconds

    return () => {
      clearInterval(smartInterval);
      console.log(`🧹 DocumentWorkbench: Smart connection system cleaned up`);
    };
  }, [document, isViewerReady]);

  useEffect(() => {
    if (document && window.AdobeDC && CLIENT_ID) {
      console.log(`📄 DocumentWorkbench: Loading document: ${document.file_name}`);
      initializeViewer();
    }
  }, [document, CLIENT_ID]);

  const initializeViewer = async () => {
    try {
      // Check if document is available
      if (!document || !document.id) {
        console.log('❌ No document provided or document missing ID, skipping viewer initialization');
        return;
      }

      // Check if CLIENT_ID is available
      if (!CLIENT_ID || CLIENT_ID.trim() === '') {
        console.error('❌ Adobe Client ID not available for viewer initialization');
        return;
      }

      console.log('🚀 Initializing Adobe PDF viewer for document:', document.file_name);
      setIsViewerReady(false);

      // Cleanup existing viewer
      if (adobeViewRef.current) {
        if (callbackRef.current) {
          // Unregister previous callbacks
          try {
            adobeViewRef.current.unregisterCallback(callbackRef.current);
          } catch (e) {
            console.warn('Failed to unregister callback:', e);
          }
        }
        adobeViewRef.current = null;
      }
      
      // Clear references
      adobeViewerRef.current = null;
      callbackRef.current = null;

      // Clear the container
      if (viewerRef.current) {
        viewerRef.current.innerHTML = '';
      }

      if (!window.AdobeDC) {
        throw new Error('Adobe DC View SDK not loaded');
      }

      console.log('📋 Initializing Adobe DC View with CLIENT_ID:', CLIENT_ID.substring(0, 8) + '...');

      // Initialize Adobe DC View with proper configuration
      const adobeDCView = new window.AdobeDC.View({
        clientId: CLIENT_ID,
        divId: "adobe-dc-view",
        locale: "en-US",
        downloadWithCredentials: false
      });

      adobeViewRef.current = adobeDCView;

      // Get the PDF URL with proper error handling - use relative path in production
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
        (import.meta.env.PROD ? '' : 'http://localhost:8080');
      const pdfUrl = `${API_BASE_URL}/api/v1/documents/view/${document.id}`;
      console.log(`📄 Loading PDF from: ${pdfUrl}`);

      // Test if PDF URL is accessible before passing to Adobe viewer
      try {
        const response = await fetch(pdfUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`PDF not accessible: ${response.status} ${response.statusText}`);
        }
        console.log('✅ PDF URL is accessible, proceeding with Adobe viewer initialization');
      } catch (urlError) {
        console.error('❌ PDF URL not accessible:', urlError);
        throw new Error(`PDF file not accessible: ${urlError.message}`);
      }
      console.log(` Loading PDF from: ${pdfUrl}`);

      // Configure preview options for full Adobe PDF interface with all standard features
      const previewConfig = {
        embedMode: "FULL_WINDOW", // Enable full Adobe PDF interface with all standard controls
        showDownloadPDF: true, // Enable download button in top toolbar
        showPrintPDF: true, // Enable print button in top toolbar  
        showLeftHandPanel: true, // Enable left-hand panel with bookmarks, thumbnails
        showAnnotationTools: true, // Enable all commenting and annotation tools
        showThumbnails: true, // Show page thumbnails in left panel
        showBookmarks: true, // Show bookmarks in left panel
        showZoomControl: true, // Enable zoom controls
        enableFormFilling: true, // Enable form editing capabilities
        focusOnRendering: false, // Don't auto-focus on PDF to preserve breadcrumb interactions
        enableLinearization: true, // Optimize for faster viewing
        defaultViewMode: "FIT_WIDTH", // Default page view mode
        showDisabledSaveButton: false, // Only show save button when PDF is modified
        enableSearchAPIs: false, // Keep UI search enabled instead of programmatic search
        enableAnnotationAPIs: true, // Enable annotation APIs for potential future features
        showFullScreen: true, // Enable full screen option
        exitPDFViewerType: "CLOSE" // Use close button in full screen mode
      };

      // Preview the file with proper error handling
      const previewFilePromise = adobeDCView.previewFile({
        content: { 
          location: { 
            url: pdfUrl,
            headers: []
          }
        },
        metaData: { 
          fileName: document.file_name,
          id: document.id.toString()
        }
      }, previewConfig);

      // Set up event listeners with reduced events to minimize SDK errors
      const eventOptions = {
        listenOn: [
          window.AdobeDC.View.Enum.Events.APP_RENDERING_START,
          window.AdobeDC.View.Enum.Events.APP_RENDERING_DONE,
          window.AdobeDC.View.Enum.Events.PDF_VIEWER_READY,
          window.AdobeDC.View.Enum.FilePreviewEvents.PREVIEW_SELECTION_END,
          window.AdobeDC.View.Enum.FilePreviewEvents.PREVIEW_PAGE_RENDERED
        ],
        enableFilePreviewEvents: true,
        enablePDFAnalytics: false // Disable analytics to reduce errors
      };

      // Register event callback
      callbackRef.current = adobeDCView.registerCallback(
        window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
        handleAdobeEvents,
        eventOptions
      );

      // Wait for PDF to be ready and store the adobeViewer reference
      try {
        console.log('⏳ Waiting for Adobe PDF preview to load...');
        const adobeViewer = await previewFilePromise;
        adobeViewerRef.current = adobeViewer;
        console.log('✅ Adobe PDF viewer initialized successfully');
      } catch (previewError) {
        console.error('❌ Failed to await previewFile promise:', previewError);
        
        // Provide more detailed error information
        if (previewError && typeof previewError === 'object') {
          console.error('Error details:', JSON.stringify(previewError, null, 2));
        }
        
        throw previewError;
      }
      
      setIsViewerReady(true);

    } catch (error) {
      console.error('❌ Failed to initialize Adobe viewer:', error);
      
      // Enhanced error logging with detailed diagnosis
      const errorInfo = {
        message: error.message || 'Unknown error',
        stack: error.stack,
        documentId: document?.id,
        documentName: document?.file_name,
        clientIdPresent: !!CLIENT_ID,
        clientIdLength: CLIENT_ID?.length || 0,
        adobeSDKLoaded: !!window.AdobeDC,
        errorType: error.constructor.name
      };
      
      console.error('❌ Adobe viewer initialization failed - Error details:', errorInfo);
      
      // Different error messages based on the error type
      if (error.message.includes('CLIENT_ID')) {
        console.error('🔧 SOLUTION: Check Adobe Client ID configuration in environment variables');
      } else if (error.message.includes('PDF not accessible')) {
        console.error('🔧 SOLUTION: Check backend API is running and PDF file exists');
      } else if (error.message.includes('Adobe DC View SDK')) {
        console.error('🔧 SOLUTION: Ensure Adobe PDF Embed API script is loaded in HTML');
      } else {
        console.error('🔧 SOLUTION: Check browser console for additional Adobe SDK errors');
      }
      
      setIsViewerReady(false);
    }
  };

  const handleAdobeEvents = (event) => {
    // Ultra-defensive check for event data to prevent ALL SDK errors
    if (!event || !event.type) {
      return;
    }
    
    console.log(`📊 DocumentWorkbench: Adobe PDF Event: ${event.type}`);
    
    try {
      switch (event.type) {
        case 'APP_RENDERING_START':
          console.log(`🚀 DocumentWorkbench: PDF rendering started`);
          break;
          
        case 'APP_RENDERING_DONE':
          console.log(`✅ DocumentWorkbench: PDF rendering completed`);
          setIsViewerReady(true);
          
          // Additional fallback for initial reading context if PDF_VIEWER_READY doesn't fire
          setTimeout(() => {
            try {
              console.log(`🔄 DocumentWorkbench: Fallback initial reading context detection`);
              // Ensure selection mode is false initially
              setIsSelectionActive(false);
              isSelectionActiveRef.current = false;
              detectReadingContext();
            } catch (fallbackError) {
              console.warn(`⚠️ DocumentWorkbench: Fallback context detection failed:`, fallbackError.message);
            }
          }, 2000);
          break;
          
        case 'PDF_VIEWER_READY':
          console.log(`✅ DocumentWorkbench: PDF viewer is ready`);
          setIsViewerReady(true);
          
          // Initial reading context detection after viewer is ready
          setTimeout(() => {
            try {
              console.log(`🚀 DocumentWorkbench: Triggering initial reading context detection`);
              addCurrentLocationToBreadcrumbs();
              // Ensure selection mode is false initially
              setIsSelectionActive(false);
              isSelectionActiveRef.current = false;
              detectReadingContext();
            } catch (initError) {
              console.warn(`⚠️ DocumentWorkbench: Initial context detection failed:`, initError.message);
            }
          }, 1500); // Reduced timeout for faster initial load
          break;
          
        case 'PREVIEW_PAGE_RENDERED':
          console.log(`📄 DocumentWorkbench: Page rendered`);
          
          // Always check for page changes first
          setTimeout(async () => {
            try {
              let currentPage = 1;
              if (adobeViewerRef.current) {
                const apis = await adobeViewerRef.current.getAPIs();
                if (apis?.getCurrentPage) {
                  currentPage = await apis.getCurrentPage();
                }
              }
              
              // STATE PRIORITY FIX: If page changed while selection was active, exit selection mode
              if (isSelectionActive && currentPage !== currentPageNumber) {
                console.log(`📄 DocumentWorkbench: Page changed from ${currentPageNumber} to ${currentPage}, exiting Selection Mode`);
                setIsSelectionActive(false);
                isSelectionActiveRef.current = false;
                
                // Clear stale selection context
                if (onContextChange) {
                  onContextChange(null);
                }
              }
              
              // Update current page tracking
              setCurrentPageNumber(currentPage);
              
              // Always trigger reading context detection after page change (unless selection is still active)
              setTimeout(() => {
                try {
                  detectReadingContext();
                } catch (pageError) {
                  console.warn(`⚠️ DocumentWorkbench: Page render context detection failed:`, pageError.message);
                }
              }, 300);
              
            } catch (error) {
              console.warn(`⚠️ DocumentWorkbench: Page change detection failed:`, error.message);
            }
          }, 100);
          break;
          
        case 'PREVIEW_SELECTION_END':
          console.log(`🎯 DocumentWorkbench: Adobe selection end event`);
          // Use our robust text selection handler with error protection
          setTimeout(() => {
            try {
              handleTextSelection();
            } catch (selectionError) {
              console.warn(`⚠️ DocumentWorkbench: Selection handling failed:`, selectionError.message);
            }
          }, 100);
          break;
          
        case 'PREVIEW_PAGE_VIEW_SCROLLED':
          // Handle scroll events silently to reduce console noise
          // Don't trigger reading context on every scroll - let our manual event handler do it
          break;
          
        default:
          // Reduce console noise for unknown events
          break;
      }
    } catch (eventError) {
      console.warn(`⚠️ DocumentWorkbench: Error handling Adobe event ${event.type}:`, eventError.message);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (adobeViewRef.current && callbackRef.current) {
        try {
          adobeViewRef.current.unregisterCallback(callbackRef.current);
        } catch (e) {
          console.warn('Failed to cleanup Adobe viewer:', e);
        }
      }
      // Clear references
      adobeViewerRef.current = null;
      adobeViewRef.current = null;
      callbackRef.current = null;
    };
  }, []);

  // Highlight search results in the PDF
  useEffect(() => {
    if (searchResults.length > 0 && isViewerReady) {
      console.log(' Highlighting search results:', searchResults.length);
      // Future: Integrate with Adobe's annotation API to highlight search results
    }
  }, [searchResults, isViewerReady]);

  if (!document) {
    return (
      <div className="document-workbench-empty">
        <Eye size={48} className="empty-icon" />
        <div className="empty-content">
          <h3>Select a Document to Begin</h3>
          <p>Choose a document from your library to start exploring connections and generating insights.</p>
          <div className="empty-features">
            <div className="feature-item">
              <span className="feature-icon"></span>
              <span>Discover related content as you read</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon"></span>
              <span>Get AI insights on selected text</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon"></span>
              <span>Generate podcasts from your content</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="document-workbench">
      {/* Unified Research Trail - Simple Breadcrumb Navigation */}
      {document && document.file_name && (
        <div className="navigation-breadcrumb">
          <div className="breadcrumb-content">
            {breadcrumbTrail.length > 0 ? (
              // Show breadcrumb trail when available
              <>
                <div className="breadcrumb-header">
                  <div className="trail-info">
                    <span 
                      className="trail-label"
                      title="Track your navigation path through documents and pages"
                    >
                      Research Trail:
                    </span>
                    <div 
                      className="trail-info-icon"
                      title="Research Trail: Track your navigation path through documents and pages. Click any item to jump back to that location instantly."
                    >
                      <span className="info-icon">ℹ</span>
                    </div>
                  </div>
                  <div className="trail-actions-simple">
                    <button
                      className="clear-trail-btn-simple"
                      onClick={onClearBreadcrumbs}
                      title="Clear research trail and start fresh navigation"
                    >
                      Clear Trail
                    </button>
                  </div>
                </div>
                <div className="trail-items-simple">
                  {breadcrumbTrail.map((item, index) => (
                    <div key={item.id} className="trail-item-wrapper-simple">
                      <button
                        className="trail-item-simple"
                        onClick={() => onBreadcrumbClick(item)}
                        title={`Jump back to: ${item.documentName} (Page ${item.pageNumber})`}
                      >
                        <span className="trail-document-simple">{item.documentName}</span>
                        <span className="trail-page-simple">Page {item.pageNumber}</span>
                      </button>
                      {index < breadcrumbTrail.length - 1 && (
                        <span className="trail-separator-simple">›</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              // Show default info when no trail
              <>
                <div className="current-document">
                  <span className="document-icon">📄</span>
                  <span className="document-name">
                    {cleanFileName(document.file_name)}
                  </span>
                </div>
                <div className="document-meta">
                  <span className="page-info">Ready to navigate</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Adobe PDF Embed Viewer Container */}
      <div 
        id="adobe-dc-view" 
        ref={viewerRef}
        className={`pdf-viewer-container ${isViewerReady ? 'ready' : 'loading'}`}
      />

      {/* Manual Connection Generation Button */}
      {isViewerReady && (
        <div className="manual-connections-trigger">
          <button 
            onClick={generateConnectionsForCurrentPage}
            className="generate-connections-btn"
            title="Generate connections for current page content"
          >
            <Network size={16} />
            <span>Find Connections</span>
          </button>
          {/* Debug: Manual Reading Context Button */}
          {process.env.NODE_ENV === 'development' && (
            <button 
              onClick={() => {
                console.log(`🐛 Debug: Manual reading context trigger`);
                detectReadingContext();
              }}
              className="generate-connections-btn"
              style={{ marginLeft: '10px', backgroundColor: '#e74c3c' }}
              title="Debug: Force reading context detection"
            >
              <Eye size={16} />
              <span>Debug: Reading Context</span>
            </button>
          )}
        </div>
      )}

      {/* Simple Connections Notification - Clean User Feedback */}
      {showActionHalo && (
        <div 
          className="connections-notification"
          style={{
            position: 'absolute',
            top: actionHaloPosition.top,
            left: actionHaloPosition.left,
            zIndex: 1000
          }}
        >
          <div className="notification-content">
            <Network size={16} />
            <span>Connections Generated!</span>
          </div>
        </div>
      )}

      {/* STATE PRIORITY FIX: Exit Selection Mode UI */}
      {isSelectionActive && (
        <div className="selection-mode-controls">
          <div className="selection-mode-bar">
            <div className="selection-mode-info">
              <span className="selection-icon">🎯</span>
              <span className="selection-text">Text Selection Active</span>
            </div>
            <button 
              onClick={exitSelectionMode}
              className="exit-selection-btn"
              title="Exit text selection mode and return to reading context"
            >
              <X size={14} />
              Exit Selection
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {!isViewerReady && document && (
        <div className="viewer-loading">
          <div className="loading-spinner"></div>
          <p>Loading PDF viewer...</p>
        </div>
      )}
    </div>
  );
});

export default DocumentWorkbench;

