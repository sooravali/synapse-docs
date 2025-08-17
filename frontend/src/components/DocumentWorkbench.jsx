/**
 * Center Panel: The Workbench
 * 
 * Implements the immersive PDF viewing experience with Context Lens
 * and Action Halo for progressive disclosure of features.
 * Uses Adobe PDF Embed API with proper event handling and text selection.
 */
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, MessageSquare, Volume2, Eye, Lightbulb, Radio, Network } from 'lucide-react';
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
  const [selectedText, setSelectedText] = useState('');
  const [currentDetectedContext, setCurrentContext] = useState('');
  const [isTextSelectionActive, setIsTextSelectionActive] = useState(false); // Track if text selection is active
  const [textSelectionContext, setTextSelectionContext] = useState(''); // Store text selection context
  const [currentPageNumber, setCurrentPageNumber] = useState(null); // Track current page for breadcrumbs
  
  const viewerRef = useRef(null);
  const adobeViewRef = useRef(null);
  const adobeViewerRef = useRef(null); // Store the resolved adobeViewer from previewFile promise
  const callbackRef = useRef(null);
  
  // OPTIMIZATION: Debouncing and deduplication for efficient API calls
  const scrollTimeoutRef = useRef(null);
  const lastDetectedContextRef = useRef('');
  const lastScrollTime = useRef(0);
  const isDetectingContext = useRef(false);
  const isTextSelectionActiveRef = useRef(false); // Ref for periodic checks to access current state

  // CONTEXT PRIORITY: Helper function to determine effective current context
  // Text selection ALWAYS takes priority over reading context
  const getEffectiveContext = () => {
    if (textSelectionContext && textSelectionContext.length > 0) {
      console.log(`Using TEXT SELECTION context: "${textSelectionContext.substring(0, 50)}..."`);
      return textSelectionContext;
    } else {
      console.log(`Using READING context: "${currentContext.substring(0, 50)}..."`);
      return currentContext;
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

  // Fetch Adobe Client ID on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const clientId = await configService.getAdobeClientId();
        setCLIENT_ID(clientId);
        
        if (!clientId) {
          console.error(' Adobe Client ID not configured. Please set ADOBE_CLIENT_ID environment variable.');
        }
      } catch (error) {
        console.error(' Failed to load configuration:', error);
      }
    };
    
    loadConfig();
  }, []);

  // UNIFIED WORKFLOW: Text Selection Handler (Triggers CONNECTIONS + Simple Notification)
  // This immediately generates connections from selected text and shows a simple confirmation
  useEffect(() => {
    const handleMouseUp = async () => {
      setTimeout(async () => {
        try {
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          
          if (selectedText.length > 20) {
            console.log(` UNIFIED WORKFLOW - Text selection detected: "${selectedText.substring(0, 50)}..."`);
            console.log(` Step 1: Generating CONNECTIONS from selected text (overrides reading connections)`);
            
            setSelectedText(selectedText);
            
            // Get current page for enhanced context
            let pageInfo = '';
            try {
              if (adobeViewerRef.current) {
                const apis = await adobeViewerRef.current.getAPIs();
                if (apis && apis.getCurrentPage) {
                  const currentPageNum = await apis.getCurrentPage();
                  pageInfo = ` (Page ${currentPageNum})`;
                }
              }
            } catch (error) {
              console.log(' Could not get current page:', error);
            }
            
            // Step 1: Mark text selection as active and store context
            const enrichedContext = `[Selected Text from ${cleanFileName(document?.file_name) || 'document'}${pageInfo}]\n${selectedText}`;
            setIsTextSelectionActive(true);
            setTextSelectionContext(enrichedContext);
            
            // This will override any reading-based connections
            if (onContextChange) {
              onContextChange(enrichedContext);
            }
            
            // Step 2: Show simple "connections generated" notification
            setShowActionHalo(true);
            
            // Position notification near selection
            try {
              const rect = selection.getRangeAt(0).getBoundingClientRect();
              setActionHaloPosition({
                top: rect.top + window.scrollY - 40,
                left: rect.left + window.scrollX + (rect.width / 2) - 75
              });
            } catch (e) {
              // Fallback position
              setActionHaloPosition({ top: 200, left: 100 });
            }
            
            // Auto-hide notification after 3 seconds
            setTimeout(() => {
              setShowActionHalo(false);
            }, 3000);
          } else {
            // If no valid text is selected, deactivate text selection mode BUT KEEP CONNECTIONS
            const selection = window.getSelection();
            if (!selection || selection.toString().trim().length === 0) {
              console.log(` Text deselected - marking as inactive but preserving connections`);
              setIsTextSelectionActive(false);
              setSelectedText('');
              // NOTE: Keep textSelectionContext to preserve connections in SynapsePanel
              // Reading context will take over only on scroll/page change
            }
          }
        } catch (e) {
          console.warn('Failed to handle text selection:', e);
        }
      }, 100); // Small delay to ensure selection is complete
    };

    // Handle clicks to detect text deselection (DISABLED - too aggressive with Adobe PDF)
    const handleClick = (e) => {
      // Adobe PDF manages its own selection state, so don't try to detect deselection via clicks
      // Let the user explicitly take actions like scrolling or navigation to change context
      console.log('� Click detected - but preserving text selection context');
    };

    // Handle focus events that might indicate deselection (DISABLED - too aggressive with Adobe PDF)
    const handleFocusChange = (e) => {
      // Adobe PDF manages its own selection state, so don't try to detect deselection via focus
      // Let the user explicitly take actions like scrolling or navigation to change context
      console.log('� Focus change detected - but preserving text selection context');
    };

    // Handle selection change events (DISABLED - too aggressive with Adobe PDF)
    const handleSelectionChange = () => {
      // Adobe PDF manages its own selection state, so don't try to detect deselection via selectionchange
      // This event fires too frequently and causes false positives
      console.log('� Selection change detected - but preserving text selection context');
    };

    // Handle escape key to deselect text
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isTextSelectionActive) {
        console.log(` Escape pressed - deselecting text but preserving connections`);
        window.getSelection()?.removeAllRanges();
        setIsTextSelectionActive(false);
        setSelectedText('');
        // NOTE: Keep textSelectionContext to preserve connections
        // Reading context will take over on scroll/page change
      }
    };

    globalThis.document.addEventListener('mouseup', handleMouseUp);
    globalThis.document.addEventListener('click', handleClick);
    globalThis.document.addEventListener('keydown', handleKeyDown);
    globalThis.document.addEventListener('focusin', handleFocusChange);
    globalThis.document.addEventListener('focusout', handleFocusChange);
    globalThis.document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      globalThis.document.removeEventListener('mouseup', handleMouseUp);
      globalThis.document.removeEventListener('click', handleClick);
      globalThis.document.removeEventListener('keydown', handleKeyDown);
      globalThis.document.removeEventListener('focusin', handleFocusChange);
      globalThis.document.removeEventListener('focusout', handleFocusChange);
      globalThis.document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [document, onContextChange, isTextSelectionActive]);

  // Sync the ref with the state for periodic checks to access current value
  useEffect(() => {
    isTextSelectionActiveRef.current = isTextSelectionActive;
  }, [isTextSelectionActive]);

  // ROBUST DESELECTION DETECTION: Poll for text deselection when selection is active
  useEffect(() => {
    if (!isTextSelectionActive) return;

    console.log(' Starting text selection monitoring...');
    
    const checkForDeselection = () => {
      if (!isTextSelectionActiveRef.current) return; // Stop if already deactivated
      
      // IMPROVED: Don't rely on window.getSelection() for Adobe PDF
      // Instead, rely on explicit user actions (scroll, click, navigation)
      // The polling should be much more conservative
      console.log('� Text selection still active - monitoring for explicit deselection actions');
    };

    // Check much less frequently and be more conservative
    const deselectionInterval = setInterval(checkForDeselection, 5000);
    
    return () => {
      console.log(' Stopping text selection monitoring...');
      clearInterval(deselectionInterval);
    };
  }, [isTextSelectionActive]);

  // Wait for Adobe DC View SDK to be ready and CLIENT_ID to be loaded
  useEffect(() => {
    const handleSDKReady = () => {
      console.log(' Adobe DC View SDK is ready');
      if (CLIENT_ID) {
        initializeViewer();
      }
    };

    if (window.AdobeDC && CLIENT_ID) {
      handleSDKReady();
    } else if (window.AdobeDC) {
      // SDK is ready but waiting for CLIENT_ID
      console.log(' Adobe DC SDK ready, waiting for CLIENT_ID...');
    } else {
      globalThis.document.addEventListener("adobe_dc_view_sdk.ready", handleSDKReady);
      return () => {
        globalThis.document.removeEventListener("adobe_dc_view_sdk.ready", handleSDKReady);
      };
    }
  }, [CLIENT_ID]); // Add CLIENT_ID as dependency

  useEffect(() => {
    if (document && window.AdobeDC && CLIENT_ID) {
      console.log(` Loading document: ${document.file_name}`);
      initializeViewer();
    }
  }, [document, CLIENT_ID]); // Add CLIENT_ID as dependency

  // STAGE 1: Automatic Central Paragraph Detection (OPTIMIZED)
  // Detects the paragraph currently in the center of the PDF viewer viewport
  // This is the core trigger for automatic connections without user interaction
  // OPTIMIZATION: Debounced, deduplicated, and cached for efficiency
  const detectCentralParagraph = async () => {
    if (!document || !document.id) {
      console.log(' No document loaded for central paragraph detection');
      return;
    }

    // PRIORITY CHECK: Don't override text selection context
    if (isTextSelectionActiveRef.current) {
      console.log(' Text selection active - skipping reading context detection to preserve selected text connections');
      return;
    }

    // OPTIMIZATION: Prevent concurrent detection calls
    if (isDetectingContext.current) {
      console.log(' Context detection already in progress, skipping...');
      return;
    }

    isDetectingContext.current = true;
    console.log(' STAGE 1 - Detecting central paragraph from PDF viewport (reading context)...');
    
    try {
      let centralText = '';
      let currentPageNum = null; // Track the current page for context
      
      // Method 1: Use Adobe PDF APIs to get viewport content (best approach)
      if (isViewerReady && adobeViewRef.current && typeof adobeViewRef.current.getAPIs === 'function') {
        try {
          const apis = await adobeViewRef.current.getAPIs();
          
          // Try to get current page and visible text
          if (apis.getCurrentPage && apis.getPageBounds) {
            currentPageNum = await apis.getCurrentPage();
            console.log(' Current page:', currentPageNum);
            
            // If Adobe provides text extraction for current page
            if (apis.extractText) {
              const pageTextData = await apis.extractText({
                pageNumber: currentPageNum,
                includeFormatting: false
              });
              
              if (pageTextData && pageTextData.length > 100) {
                // Extract a meaningful paragraph from the middle of the page content
                const paragraphs = pageTextData.split(/\n\s*\n|\.\s+(?=[A-Z])/);
                const middleIndex = Math.floor(paragraphs.length / 2);
                const centralParagraph = paragraphs[middleIndex] || paragraphs[0];
                
                if (centralParagraph && centralParagraph.length > 50) {
                  centralText = centralParagraph.trim().substring(0, 300);
                  console.log('� Extracted central paragraph from Adobe API:', centralText.substring(0, 50) + '...');
                }
              }
            }
          }
        } catch (apiError) {
          console.log(' Adobe API central paragraph detection failed:', apiError);
        }
      }
      
      // Method 2: Advanced DOM analysis to find text in viewport center
      if (!centralText) {
        try {
          const viewerElement = viewerRef.current;
          if (viewerElement) {
            const viewerRect = viewerElement.getBoundingClientRect();
            const centerY = viewerRect.top + (viewerRect.height / 2);
            const centerX = viewerRect.left + (viewerRect.width / 2);
            
            // Find text elements that are closest to the center of the viewport
            const textElements = viewerElement.querySelectorAll(
              'span[data-text], div[data-text], .textLayer span, .textLayer div, p, div[role="text"], [class*="text"], span, div'
            );
            
            let closestElement = null;
            let minDistance = Infinity;
            
            for (let element of textElements) {
              const text = element.textContent?.trim();
              if (!text || text.length < 20) continue;
              
              // Skip development/UI content
              if (text.includes('chunk-') || text.includes('DevTools') || 
                  text.includes('adobe.com') || text.includes('loading')) continue;
              
              const elementRect = element.getBoundingClientRect();
              const elementCenterY = elementRect.top + (elementRect.height / 2);
              const elementCenterX = elementRect.left + (elementRect.width / 2);
              
              // Calculate distance from viewport center
              const distance = Math.sqrt(
                Math.pow(elementCenterX - centerX, 2) + 
                Math.pow(elementCenterY - centerY, 2)
              );
              
              if (distance < minDistance) {
                minDistance = distance;
                closestElement = element;
              }
            }
            
            if (closestElement) {
              const elementText = closestElement.textContent.trim();
              
              // Try to get a fuller paragraph by looking at parent elements
              let fullParagraph = elementText;
              let parent = closestElement.parentElement;
              
              while (parent && fullParagraph.length < 150) {
                const parentText = parent.textContent?.trim();
                if (parentText && parentText.length > fullParagraph.length && parentText.length < 500) {
                  // Ensure we're not getting too much content or navigation text
                  if (!parentText.includes('navigation') && !parentText.includes('menu')) {
                    fullParagraph = parentText;
                  }
                }
                parent = parent.parentElement;
              }
              
              centralText = fullParagraph.substring(0, 300);
              console.log(` Found central paragraph via DOM analysis: "${centralText.substring(0, 50)}..."`);
            }
          }
        } catch (domError) {
          console.log(' DOM central paragraph detection failed:', domError);
        }
      }
      
      // Method 3: Enhanced fallback content detection using document structure
      if (!centralText) {
        console.log(' Primary content detection failed - trying enhanced fallback approaches...');
        
        try {
          // First, try to get content from our backend document data
          if (document && document.id) {
            // Request the first chunk of document content from our backend
            console.log(' Requesting document content from backend for context...');
            try {
              const response = await fetch(`/api/v1/documents/${document.id}/chunks?limit=1`);
              if (response.ok) {
                const data = await response.json();
                if (data.chunks && data.chunks.length > 0) {
                  const firstChunk = data.chunks[0];
                  if (firstChunk.text_chunk && firstChunk.text_chunk.length > 50) {
                    centralText = firstChunk.text_chunk.substring(0, 300);
                    console.log(' Using backend document content as context:', centralText.substring(0, 50) + '...');
                  }
                }
              }
            } catch (apiError) {
              console.warn(' Failed to fetch document content from backend:', apiError);
            }
          }
          
          // Fallback: Try to get any text content from the viewer container
          if (!centralText) {
            const viewerElement = viewerRef.current;
            if (viewerElement) {
              // Look for any text content in the PDF viewer
              const allTextElements = viewerElement.querySelectorAll('*');
              let textContent = '';
              
              for (let element of allTextElements) {
                const text = element.textContent?.trim();
                if (text && text.length > 30 && 
                    !text.includes('adobe.com') && 
                    !text.includes('loading') && 
                    !text.includes('DevTools') &&
                    !text.includes('chunk-')) {
                  textContent = text.substring(0, 300);
                  break;
                }
              }
              
              if (textContent) {
                centralText = textContent;
                console.log(' Found content via enhanced text extraction:', centralText.substring(0, 50) + '...');
              }
            }
          }
          
          // If still no content, create meaningful context from document metadata
          if (!centralText && document) {
            // Create context from document metadata that's meaningful for search
            const docTitle = document.file_name?.replace(/\.pdf$/i, '').replace(/^doc_\d+_/, '') || 'Unknown Document';
            const sections = document.section_count ? `${document.section_count} sections` : 'multiple sections';
            const pages = document.page_count ? `${document.page_count} pages` : 'several pages';
            
            centralText = `This document "${docTitle}" contains ${sections} across ${pages}. `;
            if (document.file_size_mb) {
              centralText += `File size: ${document.file_size_mb}MB. `;
            }
            centralText += `Analyzing content to find relevant information and connections.`;
            
            console.log(' Using enhanced document metadata as context for search functionality:', centralText);
          }
        } catch (error) {
          console.warn(' Enhanced fallback content detection failed:', error);
          
          // Absolute fallback to enable search functionality with meaningful context
          if (document) {
            const docTitle = document.file_name?.replace(/\.pdf$/i, '').replace(/^doc_\d+_/, '') || 'Document';
            centralText = `Analyzing document "${docTitle}" for relevant content and connections. This document contains information that may be related to other documents in the library.`;
            console.log(' Using absolute fallback context with enhanced metadata for search functionality');
          }
        }
      }
      
      // OPTIMIZATION: Only proceed if we found substantial content and it's different from current context
      // This prevents duplicate API calls for the same content
      if (centralText.length > 50 && centralText !== lastDetectedContextRef.current?.split('\n')[1]) {
        console.log(` STAGE 1 - NEW central paragraph detected: "${centralText.substring(0, 50)}..."`);
        
        // Track page changes for breadcrumbs
        if (currentPageNum && currentPageNum !== currentPageNumber) {
          console.log(`🍞 Page change detected: ${currentPageNumber} → ${currentPageNum}`);
          setCurrentPageNumber(currentPageNum);
          
          // Add to breadcrumbs if user has moved to a significantly different page (not just scrolling within same page)
          if (currentPageNumber && Math.abs(currentPageNum - currentPageNumber) >= 2) {
            console.log('🍞 Significant page jump detected, adding to breadcrumbs');
            addCurrentLocationToBreadcrumbs();
          }
        }
        
        // CRITICAL: Only switch to reading context if NO text selection is active
        if (textSelectionContext && textSelectionContext.length > 0) {
          console.log(' Text selection context active - preserving connections, ignoring reading context');
          return; // Keep text selection connections
        }
        
        console.log(` Triggering AUTOMATIC CONNECTIONS workflow (effortless & instant)`);
        
        // Clear any previous text selection context when switching to reading
        if (textSelectionContext) {
          console.log(' Clearing previous text selection context - switching to reading mode');
          setTextSelectionContext('');
        }
        
        // Update our tracking refs with enhanced context that includes page information
        const pageInfo = currentPageNum ? ` (Page ${currentPageNum})` : '';
        const enhancedContext = `[Reading context from ${cleanFileName(document?.file_name) || 'document'}${pageInfo}]\n${centralText}`;
        
        lastDetectedContextRef.current = enhancedContext;
        setCurrentContext(enhancedContext);
        
        // Trigger the automatic connections search
        if (onContextChange) {
          onContextChange(enhancedContext);
        }
      } else if (centralText.length <= 50) {
        console.log(' Could not detect meaningful central paragraph content');
      } else {
        console.log(' Central paragraph unchanged from last detection, skipping duplicate API call');
      }
    } catch (error) {
      console.warn(' Central paragraph detection failed:', error);
    } finally {
      // OPTIMIZATION: Reset the detection flag
      isDetectingContext.current = false;
    }
  };

  // OPTIMIZATION: Page-based context detection instead of scroll-based
  const handleScrollForContextDetection = async () => {
    // PRIORITY CHECK: Don't trigger reading context if text selection is active
    if (isTextSelectionActiveRef.current) {
      console.log(' Text selection active - ignoring scroll for context detection to preserve selected text connections');
      return;
    }
    
    const now = Date.now();
    
    // OPTIMIZATION: Minimal throttle to prevent excessive duplicate calls within same millisecond
    if (now - lastScrollTime.current < 200) {
      console.log(' Scroll event throttled (within 200ms), skipping...');
      return;
    }
    
    lastScrollTime.current = now;
    
    // PAGE-BASED DETECTION: Only trigger context detection on actual page changes
    try {
      if (isViewerReady && adobeViewerRef.current) {
        const apis = await adobeViewerRef.current.getAPIs();
        if (apis && apis.getCurrentPage) {
          const currentPage = await apis.getCurrentPage();
          
          // Only trigger context detection if page has actually changed
          if (currentPage !== currentPageNumber) {
            console.log(` Page change detected: ${currentPageNumber} → ${currentPage}, triggering context detection...`);
            setCurrentPageNumber(currentPage);
            
            // OPTIMIZATION: Clear existing timeout if any
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
            }
            
            // Use a short debounce for page changes to allow page rendering to complete
            scrollTimeoutRef.current = setTimeout(() => {
              detectCentralParagraph();
            }, 300);
          } else {
            console.log(` Scroll within same page ${currentPage}, ignoring for context detection`);
          }
        }
      }
    } catch (error) {
      console.warn(' Error checking page number during scroll:', error);
      // Fallback: only trigger if significant time has passed since last detection
      if (now - lastScrollTime.current > 2000) {
        console.log(' Fallback: triggering context detection after 2s cooldown');
        detectCentralParagraph();
      }
    }
  };

  const initializeViewer = async () => {
    try {
      // Check if document is available
      if (!document || !document.id) {
        console.log(' No document provided or document missing ID, skipping viewer initialization');
        return;
      }

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

      // Set up event listeners using Adobe's recommended approach
      const eventOptions = {
        listenOn: [
          window.AdobeDC.View.Enum.Events.APP_RENDERING_START,
          window.AdobeDC.View.Enum.Events.APP_RENDERING_DONE,
          window.AdobeDC.View.Enum.Events.DOCUMENT_FRAGMENT_LOADED,
          window.AdobeDC.View.Enum.Events.PDF_VIEWER_READY,
          window.AdobeDC.View.Enum.FilePreviewEvents.PREVIEW_PAGE_VIEW_SCROLLED,
          window.AdobeDC.View.Enum.FilePreviewEvents.PREVIEW_SELECTION_END,
          window.AdobeDC.View.Enum.FilePreviewEvents.PREVIEW_PAGE_RENDERED
        ],
        enableFilePreviewEvents: true,
        enablePDFAnalytics: true
      };

      // Register event callback
      callbackRef.current = adobeDCView.registerCallback(
        window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
        handleAdobeEvents,
        eventOptions
      );

      // Wait for PDF to be ready and store the adobeViewer reference
      try {
        const adobeViewer = await previewFilePromise;
        adobeViewerRef.current = adobeViewer;
        console.log(' Adobe PDF viewer initialized successfully');
      } catch (previewError) {
        console.error(' Failed to await previewFile promise:', previewError);
        throw previewError;
      }
      
      setIsViewerReady(true);

    } catch (error) {
      console.error(' Failed to initialize Adobe viewer:', error);
      setIsViewerReady(false);
    }
  };

  const handleAdobeEvents = (event) => {
    console.log(' Adobe PDF Event:', event.type, event.data);
    
    switch (event.type) {
      case 'APP_RENDERING_START':
        console.log(' PDF rendering started');
        break;
        
      case 'APP_RENDERING_DONE':
        console.log(' PDF rendering completed');
        setIsViewerReady(true);
        break;
        
      case 'PDF_VIEWER_READY':
        console.log(' PDF viewer is ready');
        setIsViewerReady(true);
        
        // Add initial reading location to breadcrumbs after a short delay
        setTimeout(() => {
          addCurrentLocationToBreadcrumbs();
          
          // Set up fallback scroll detection since Adobe scroll events might not work
          setupFallbackScrollDetection();
        }, 2000);
        break;
        
      case 'PREVIEW_PAGE_VIEW_SCROLLED':
        console.log(' Adobe scroll event detected - ignoring for context detection (using page render instead)');
        // No longer trigger context detection on scroll events - only on page changes
        break;
        
      case 'PREVIEW_PAGE_RENDERED':
        console.log(' Page rendered:', event.data);
        // Perfect event for page-based context detection
        console.log(' Page render event - checking for page change before context detection');
        handleScrollForContextDetection();
        break;
        
      case 'PREVIEW_SELECTION_END':
        console.log(' Selection end event data:', event.data);
        console.log(' Full event object:', event);
        
        // Check if this is a deselection event (no new selection)
        if (!event.data || !event.data.newSelection || Object.keys(event.data.selections || {}).length === 0) {
          if (isTextSelectionActiveRef.current) {
            console.log(' Adobe PDF deselection detected - returning to reading context');
            setIsTextSelectionActive(false);
            setTextSelectionContext('');
            setSelectedText('');
            
            setTimeout(() => {
              detectCentralParagraph();
            }, 500);
            return;
          }
        }
        
        // Extract selection data from the event
        if (event.data && event.data.newSelection) {
          try {
            // Check if there's selection content in the event data
            let selectedText = '';
            
            // Log all available properties for debugging
            console.log(' Available event.data properties:', Object.keys(event.data));
            if (event.data.page0) {
              console.log(' page0 properties:', Object.keys(event.data.page0));
            }
            if (event.data.selections) {
              console.log(' selections array:', event.data.selections);
              console.log(' selections type:', typeof event.data.selections);
              console.log(' selections keys:', Object.keys(event.data.selections));
              
              // Handle selections as object with page keys
              const selectionKeys = Object.keys(event.data.selections);
              if (selectionKeys.length > 0) {
                console.log(' first selection key:', selectionKeys[0]);
                const firstSelection = event.data.selections[selectionKeys[0]];
                console.log(' first selection item:', firstSelection);
                
                // Try to extract text from the page selection
                if (firstSelection && typeof firstSelection === 'object') {
                  console.log(' first selection properties:', Object.keys(firstSelection));
                  
                  // Log the actual values to understand the structure
                  Object.keys(firstSelection).forEach(key => {
                    console.log(` ${key}:`, firstSelection[key]);
                  });
                  
                  if (firstSelection.text) {
                    selectedText = firstSelection.text;
                  } else if (firstSelection.content) {
                    selectedText = firstSelection.content;
                  } else if (firstSelection.selectedText) {
                    selectedText = firstSelection.selectedText;
                  } else if (firstSelection.textContent) {
                    selectedText = firstSelection.textContent;
                  } else if (firstSelection.value) {
                    selectedText = firstSelection.value;
                  } else if (firstSelection.innerHTML) {
                    selectedText = firstSelection.innerHTML;
                  } else if (firstSelection.innerText) {
                    selectedText = firstSelection.innerText;
                  }
                }
              }
            }
            
            // Adobe provides selection data in different formats
            if (event.data.selectedContent) {
              selectedText = event.data.selectedContent;
            } else if (event.data.selection && event.data.selection.content) {
              selectedText = event.data.selection.content;
            } else if (event.data.content) {
              selectedText = event.data.content;
            } else if (event.data.page0 && event.data.page0.text) {
              selectedText = event.data.page0.text;
            } else if (event.data.page0 && event.data.page0.selectedText) {
              selectedText = event.data.page0.selectedText;
            } else if (event.data.selections && Object.keys(event.data.selections).length > 0) {
              // Adobe provides bounding boxes but not text content directly
              // Try to extract text using the coordinates
              const selectionKeys = Object.keys(event.data.selections);
              const firstSelection = event.data.selections[selectionKeys[0]];
              
              console.log(' Adobe has bounding box data - attempting text extraction...');
              
              // Since Adobe doesn't provide text directly, use a fallback approach
              // Trigger a slight delay to allow Adobe's internal text extraction
              setTimeout(() => {
                // Try to get text that Adobe copied to clipboard
                if (navigator.clipboard && navigator.clipboard.readText) {
                  navigator.clipboard.readText()
                    .then(clipboardText => {
                      if (clipboardText && clipboardText.length > 10) {
                        console.log(' Extracted text from clipboard:', clipboardText);
                        handleTextSelectionEvent({ selection: clipboardText });
                      } else {
                        console.log(' Clipboard empty, using fallback');
                        useFallbackTextSelection();
                      }
                    })
                    .catch(() => {
                      console.log(' Clipboard access denied, using fallback');
                      useFallbackTextSelection();
                    });
                } else {
                  console.log(' Clipboard API not available, using fallback');
                  useFallbackTextSelection();
                }
              }, 200);
            }
            
            console.log(' Adobe selection content:', selectedText);
            
            if (selectedText && selectedText.length > 10) {
              handleTextSelectionEvent({ selection: selectedText });
            } else {
              console.log(' No valid selection content in Adobe event, trying browser fallback');
              // Fallback to browser selection with a small delay to ensure selection is ready
              setTimeout(() => {
                handleBrowserTextSelection();
                // If browser selection also fails, use contextual fallback
                setTimeout(() => {
                  if (!selectedText) {
                    useFallbackTextSelection();
                  }
                }, 300);
              }, 100);
            }
          } catch (e) {
            console.log(' Failed to extract Adobe selection:', e);
            // Fallback to browser selection
            setTimeout(() => {
              handleBrowserTextSelection();
            }, 100);
          }
        } else {
          // Fallback to browser selection
          handleBrowserTextSelection();
        }
        break;
      
      case 'PDF_VIEWER_CLICK':
      case 'PREVIEW_CLICK':
        console.log(' PDF clicked - click events not used for content extraction');
        // Do not generate fake content on clicks - let real text selection handle content
        break;
        
      default:
        console.log(' Other PDF event:', event.type);
    }
  };

  const handleBrowserTextSelection = () => {
    try {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      console.log(` Browser selection: "${selectedText}"`);
      
      if (selectedText.length > 10) {
        handleTextSelectionEvent({ selection: selectedText });
      } else {
        console.log(' Browser selection too short or empty');
      }
    } catch (e) {
      console.warn('Failed to get browser selection:', e);
    }
  };

  const useFallbackTextSelection = () => {
    console.log(' Text selection failed - no fallback content generated');
    console.log(' Real text selection is required for meaningful content analysis');
    // Do not generate fake content - require actual text selection from PDF
  };

  const setupFallbackScrollDetection = () => {
    console.log(' Setting up page-based scroll detection for central paragraph...');
    
    let scrollTimeout;
    let lastScrollTime = Date.now();
    let isScrolling = false;
    let lastCheckedPage = currentPageNumber;

    // Page-based scroll handler that only detects context on page changes
    const handleScroll = async () => {
      // PRIORITY CHECK: Don't trigger reading context if text selection is active
      if (isTextSelectionActiveRef.current) {
        console.log(' Text selection active - ignoring scroll events to preserve selected text connections');
        return;
      }
      
      const now = Date.now();
      isScrolling = true;
      lastScrollTime = now;
      
      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Set new timeout to check page after scrolling stops
      scrollTimeout = setTimeout(async () => {
        // Double-check text selection before triggering
        if (!isTextSelectionActiveRef.current) {
          isScrolling = false;
          
          // PAGE-BASED DETECTION: Check if page has changed
          try {
            if (isViewerReady && adobeViewerRef.current) {
              const apis = await adobeViewerRef.current.getAPIs();
              if (apis && apis.getCurrentPage) {
                const currentPage = await apis.getCurrentPage();
                
                // Only trigger context detection if page has actually changed
                if (currentPage !== lastCheckedPage) {
                  console.log(` Page change detected in fallback: ${lastCheckedPage} → ${currentPage}, detecting context...`);
                  lastCheckedPage = currentPage;
                  setCurrentPageNumber(currentPage);
                  detectCentralParagraph();
                } else {
                  console.log(` Scroll within same page ${currentPage}, ignoring in fallback detection`);
                }
              }
            } else {
              // Fallback for when Adobe APIs are not available
              console.log(' Adobe APIs not available - using time-based fallback with longer interval');
              // Only trigger if significant time has passed (5 seconds instead of 1)
              if (now - lastScrollTime > 5000) {
                detectCentralParagraph();
              }
            }
          } catch (error) {
            console.warn(' Error checking page in fallback scroll handler:', error);
          }
        } else {
          console.log(' Text selection still active - skipping reading context detection');
        }
      }, 800); // Wait 800ms after scrolling stops to allow page change detection
    };

    // Method 1: Listen for scroll events on the viewer container
    const viewerElement = viewerRef.current;
    let scrollListener = null;
    
    if (viewerElement) {
      scrollListener = () => {
        console.log(' Scroll detected on viewer container');
        handleScroll();
      };
      
      viewerElement.addEventListener('scroll', scrollListener, { passive: true });
      console.log(' Added scroll listener to viewer container');
    }
    
    // Method 2: Listen for scroll events on window (Adobe might scroll the whole page)
    const windowScrollListener = () => {
      console.log(' Scroll detected on window');
      handleScroll();
    };
    
    window.addEventListener('scroll', windowScrollListener, { passive: true });
    console.log(' Added scroll listener to window');
    
    // Method 3: Listen for scroll events on Adobe's iframe with enhanced detection
    setTimeout(() => {
      const iframes = window.document.querySelectorAll('iframe');
      console.log(` Found ${iframes.length} iframes, adding enhanced scroll detection...`);
      
      iframes.forEach((iframe, index) => {
        try {
          if (iframe.contentWindow) {
            const iframeScrollListener = () => {
              console.log(` Scroll detected on iframe ${index}`);
              handleScroll();
            };
            
            iframe.contentWindow.addEventListener('scroll', iframeScrollListener, { passive: true });
            console.log(` Added scroll listener to iframe ${index}`);
          }
        } catch (e) {
          console.log(` Cross-origin iframe ${index} detected - using alternative detection:`, e.message);
          
          // Use MutationObserver to detect visual changes that indicate scrolling
          const observer = new MutationObserver(() => {
            handleScroll();
          });
          
          observer.observe(iframe, {
            attributes: true,
            attributeFilter: ['style', 'class'],
            subtree: false
          });
        }
      });
    }, 1000);
    
    // Method 4: Less aggressive periodic checking (longer intervals since we use page-based detection)
    const periodicCheck = async () => {
      // PRIORITY CHECK: Don't trigger reading context if text selection is active
      if (isTextSelectionActiveRef.current) {
        console.log(' Text selection active - skipping periodic reading context detection');
        return;
      }
      
      const now = Date.now();
      // Only trigger if user hasn't scrolled recently and sufficient time has passed
      if (!isScrolling && (now - lastScrollTime > 30000)) {
        console.log(' Periodic central paragraph detection (30s reading session timeout)');
        
        // Check if page has changed before triggering
        try {
          if (isViewerReady && adobeViewerRef.current) {
            const apis = await adobeViewerRef.current.getAPIs();
            if (apis && apis.getCurrentPage) {
              const currentPage = await apis.getCurrentPage();
              if (currentPage !== lastCheckedPage) {
                console.log(` Periodic page change detected: ${lastCheckedPage} → ${currentPage}`);
                lastCheckedPage = currentPage;
                setCurrentPageNumber(currentPage);
                detectCentralParagraph();
              }
            }
          } else {
            // Fallback periodic detection when APIs unavailable
            detectCentralParagraph();
          }
        } catch (error) {
          console.warn(' Error in periodic page check:', error);
        }
        
        lastScrollTime = now;
      }
    };
    
    const periodicInterval = setInterval(periodicCheck, 15000); // Every 15 seconds (less aggressive)
    console.log(' Started periodic central paragraph detection with page tracking');
    
    // Initial detection after a brief delay with proper page setup
    setTimeout(async () => {
      console.log(' Initial central paragraph detection with page setup...');
      
      // Initialize page tracking
      try {
        if (isViewerReady && adobeViewerRef.current) {
          const apis = await adobeViewerRef.current.getAPIs();
          if (apis && apis.getCurrentPage) {
            const initialPage = await apis.getCurrentPage();
            lastCheckedPage = initialPage;
            setCurrentPageNumber(initialPage);
            console.log(` Initial page set to: ${initialPage}`);
          }
        }
      } catch (error) {
        console.warn(' Error setting initial page:', error);
      }
      
      detectCentralParagraph();
    }, 2000);

    // Cleanup function
    return () => {
      if (viewerElement && scrollListener) {
        viewerElement.removeEventListener('scroll', scrollListener);
      }
      window.removeEventListener('scroll', windowScrollListener);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      clearInterval(periodicInterval);
      lastCheckedPage = null; // Clear page tracking
      console.log(' Cleaned up page-based scroll detection listeners');
    };
  };

  const handleTextSelectionEvent = async (selectionData) => {
    console.log(` Raw selection event data:`, selectionData);
    
    // Extract text from various possible Adobe selection formats
    let selectedText = '';
    
    if (selectionData && selectionData.data) {
      // Check data.selection first
      if (selectionData.data.selection && selectionData.data.selection.length > 10) {
        selectedText = selectionData.data.selection.trim();
      }
      // Check data.selectedText 
      else if (selectionData.data.selectedText && selectionData.data.selectedText.length > 10) {
        selectedText = selectionData.data.selectedText.trim();
      }
    }
    // Check direct selection property
    else if (selectionData && selectionData.selection && selectionData.selection.length > 10) {
      selectedText = selectionData.selection.trim();
    }
    // Check selectedText property
    else if (selectionData && selectionData.selectedText && selectionData.selectedText.length > 10) {
      selectedText = selectionData.selectedText.trim();
    }
    
    console.log(` Extracted selected text: "${selectedText}"`);
    
    if (selectedText && selectedText.length > 10) {
      console.log(` Valid text selection: "${selectedText.substring(0, 50)}..."`);
      console.log(` UNIFIED WORKFLOW - Adobe PDF text selection detected: "${selectedText.substring(0, 50)}..."`);
      console.log(` Step 1: Generating CONNECTIONS from selected text (overrides reading connections)`);
      
      setSelectedText(selectedText);
      
      // Get current page for enhanced context
      let pageInfo = '';
      try {
        if (adobeViewerRef.current) {
          const apis = await adobeViewerRef.current.getAPIs();
          if (apis && apis.getCurrentPage) {
            const currentPageNum = await apis.getCurrentPage();
            pageInfo = ` (Page ${currentPageNum})`;
          }
        }
      } catch (error) {
        console.log(' Could not get current page:', error);
      }
      
      // Step 1: Mark text selection as active and store context
      const enrichedContext = `[Selected Text from ${cleanFileName(document?.file_name) || 'document'}${pageInfo}]\n${selectedText}`;
      setIsTextSelectionActive(true);
      setTextSelectionContext(enrichedContext);
      
      // This will override any reading-based connections
      if (onContextChange) {
        onContextChange(enrichedContext);
      }
      
      // Step 2: Show simple "connections generated" notification
      setShowActionHalo(true);
      
      // Position notification (approximate, since Adobe doesn't provide exact coordinates)
      setActionHaloPosition({
        top: 200,
        left: 100
      });
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => {
        setShowActionHalo(false);
      }, 3000);
    } else {
      console.log(` No valid text selection found in event data`);
    }
  };

  // UNIFIED WORKFLOW: Action Halo Button Handlers (Step 2: Optional insights/podcast)
  const handleInsightsClick = async () => {
    if (!selectedText || isGeneratingInsights) return;
    
    console.log(` UNIFIED WORKFLOW - Step 2: User clicked Insights for: "${selectedText.substring(0, 50)}..."`);
    setIsGeneratingInsights(true);
    setShowActionHalo(false);
    
    try {
      // Get current page number for context
      let currentPageNum = null;
      if (isViewerReady && adobeViewerRef.current) {
        try {
          const apis = await adobeViewerRef.current.getAPIs();
          if (apis && apis.getCurrentPage) {
            currentPageNum = await apis.getCurrentPage();
          }
        } catch (pageError) {
          console.warn('Could not get current page:', pageError);
        }
      }
      
      // Create enriched context with clear source information including page number
      const pageInfo = currentPageNum ? ` (Page ${currentPageNum})` : '';
      const enrichedContext = `[Selected Text from ${cleanFileName(document?.file_name) || 'document'}${pageInfo}]\n${selectedText}`;
      
      // This triggers insights generation using the already-generated connections as context
      await onInsightsRequest(enrichedContext);
      console.log(` Generated insights successfully from selected text`);
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handlePodcastClick = async () => {
    if (!selectedText || isGeneratingPodcast) return;
    
    console.log(` UNIFIED WORKFLOW - Step 2: User clicked Podcast for: "${selectedText.substring(0, 50)}..."`);
    setIsGeneratingPodcast(true);
    setShowActionHalo(false);
    
    try {
      // Get current page number for context
      let currentPageNum = null;
      if (isViewerReady && adobeViewerRef.current) {
        try {
          const apis = await adobeViewerRef.current.getAPIs();
          if (apis && apis.getCurrentPage) {
            currentPageNum = await apis.getCurrentPage();
          }
        } catch (pageError) {
          console.warn('Could not get current page:', pageError);
        }
      }
      
      // Create enriched context with clear source information including page number
      const pageInfo = currentPageNum ? ` (Page ${currentPageNum})` : '';
      const enrichedContext = `[Selected Text from ${cleanFileName(document?.file_name) || 'document'}${pageInfo}]\n${selectedText}`;
      
      await onPodcastRequest(enrichedContext);
      console.log(` Generated podcast successfully from selected text`);
    } catch (error) {
      console.error('Failed to generate podcast:', error);
    } finally {
      setIsGeneratingPodcast(false);
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

      {/* Text Selection Mode Indicator & Manual Deselect */}
      {isTextSelectionActive && (
        <div className="text-selection-indicator">
          <div className="selection-status">
            <span className="status-icon"></span>
            <span className="status-text">Text Selection Active</span>
            <button 
              className="deselect-btn"
              onClick={() => {
                console.log(' Manual deselect button clicked - returning to reading context');
                window.getSelection()?.removeAllRanges();
                setIsTextSelectionActive(false);
                setTextSelectionContext('');
                setSelectedText('');
                setTimeout(() => {
                  detectCentralParagraph();
                }, 500);
              }}
              title="Exit text selection mode and return to reading context"
            >
               Exit
            </button>
          </div>
        </div>
      )}

      {/* Simple Connections Notification - Text Selection Feedback */}
      {showActionHalo && selectedText && (
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

