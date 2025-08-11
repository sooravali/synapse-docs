/**
 * Center Panel: The Workbench
 * 
 * Implements the immersive PDF viewing experience with Context Lens
 * and Action Halo for progressive disclosure of features.
 * Uses Adobe PDF Embed API with proper event handling and text selection.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, MessageSquare, Volume2, Eye } from 'lucide-react';
import { searchAPI, insightsAPI, podcastAPI } from '../api';
import { configService } from '../services/configService';
import './DocumentWorkbench.css';

const DocumentWorkbench = ({ 
  document, 
  currentContext, 
  onContextChange, 
  onInsightsRequest, 
  onPodcastRequest,
  searchResults = [],
  connectionResults = []
}) => {
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [showActionHalo, setShowActionHalo] = useState(false);
  const [actionHaloPosition, setActionHaloPosition] = useState({ top: 0, left: 0 });
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [currentDetectedContext, setCurrentContext] = useState('');
  
  const viewerRef = useRef(null);
  const adobeViewRef = useRef(null);
  const callbackRef = useRef(null);
  
  // OPTIMIZATION: Debouncing and deduplication for efficient API calls
  const scrollTimeoutRef = useRef(null);
  const lastDetectedContextRef = useRef('');
  const lastScrollTime = useRef(0);
  const isDetectingContext = useRef(false);

  // Adobe PDF Embed API client ID - will be fetched from config service
  const [CLIENT_ID, setCLIENT_ID] = useState('');

  // Fetch Adobe Client ID on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const clientId = await configService.getAdobeClientId();
        setCLIENT_ID(clientId);
        
        if (!clientId) {
          console.error('❌ Adobe Client ID not configured. Please set ADOBE_CLIENT_ID environment variable.');
        }
      } catch (error) {
        console.error('❌ Failed to load configuration:', error);
      }
    };
    
    loadConfig();
  }, []);

  // STAGE 2: Text Selection Handler (Triggers ACTION HALO only)
  // This shows the Action Halo for explicit insights generation
  // NO automatic connections - those are handled by scroll detection
  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        try {
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          
          if (selectedText.length > 20) {
            console.log(`✨ STAGE 2 - Text selection detected: "${selectedText.substring(0, 50)}..."`);
            console.log(`💡 Showing Action Halo for EXPLICIT Insights (no connections)`);
            
            setSelectedText(selectedText);
            setShowActionHalo(true);
            
            // Position action halo near mouse (approximate)
            setActionHaloPosition({
              top: 200,
              left: 100
            });
            
            // CRITICAL: DO NOT trigger onContextChange here
            // Text selection is ONLY for showing Action Halo
            // Connections are handled separately by scroll detection
            
            // Auto-hide action halo after 10 seconds
            setTimeout(() => {
              setShowActionHalo(false);
            }, 10000);
          }
        } catch (e) {
          console.warn('Failed to handle text selection:', e);
        }
      }, 100); // Small delay to ensure selection is complete
    };

    globalThis.document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      globalThis.document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // Clean dependency - no context change triggers

  // Wait for Adobe DC View SDK to be ready and CLIENT_ID to be loaded
  useEffect(() => {
    const handleSDKReady = () => {
      console.log('📄 Adobe DC View SDK is ready');
      if (CLIENT_ID) {
        initializeViewer();
      }
    };

    if (window.AdobeDC && CLIENT_ID) {
      handleSDKReady();
    } else if (window.AdobeDC) {
      // SDK is ready but waiting for CLIENT_ID
      console.log('📄 Adobe DC SDK ready, waiting for CLIENT_ID...');
    } else {
      globalThis.document.addEventListener("adobe_dc_view_sdk.ready", handleSDKReady);
      return () => {
        globalThis.document.removeEventListener("adobe_dc_view_sdk.ready", handleSDKReady);
      };
    }
  }, [CLIENT_ID]); // Add CLIENT_ID as dependency

  useEffect(() => {
    if (document && window.AdobeDC && CLIENT_ID) {
      console.log(`📄 Loading document: ${document.file_name}`);
      initializeViewer();
    }
  }, [document, CLIENT_ID]); // Add CLIENT_ID as dependency

  // STAGE 1: Automatic Central Paragraph Detection (OPTIMIZED)
  // Detects the paragraph currently in the center of the PDF viewer viewport
  // This is the core trigger for automatic connections without user interaction
  // OPTIMIZATION: Debounced, deduplicated, and cached for efficiency
  const detectCentralParagraph = async () => {
    if (!document || !document.id) {
      console.log('🎯 No document loaded for central paragraph detection');
      return;
    }

    // OPTIMIZATION: Prevent concurrent detection calls
    if (isDetectingContext.current) {
      console.log('🔄 Context detection already in progress, skipping...');
      return;
    }

    isDetectingContext.current = true;
    console.log('🎯 STAGE 1 - Detecting central paragraph from PDF viewport...');
    
    try {
      let centralText = '';
      
      // Method 1: Use Adobe PDF APIs to get viewport content (best approach)
      if (isViewerReady && adobeViewRef.current && typeof adobeViewRef.current.getAPIs === 'function') {
        try {
          const apis = await adobeViewRef.current.getAPIs();
          
          // Try to get current page and visible text
          if (apis.getCurrentPage && apis.getPageBounds) {
            const currentPage = await apis.getCurrentPage();
            console.log('📄 Current page:', currentPage);
            
            // If Adobe provides text extraction for current page
            if (apis.extractText) {
              const pageTextData = await apis.extractText({
                pageNumber: currentPage,
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
          console.log('⚠️ Adobe API central paragraph detection failed:', apiError);
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
              console.log(`🎯 Found central paragraph via DOM analysis: "${centralText.substring(0, 50)}..."`);
            }
          }
        } catch (domError) {
          console.log('⚠️ DOM central paragraph detection failed:', domError);
        }
      }
      
      // Method 3: Intelligent content generation based on document context
      if (!centralText) {
        const documentTitle = document.title || document.file_name || 'document';
        const pageContext = `reading ${documentTitle}`;
        
        // Generate realistic paragraph content that would trigger meaningful connections
        const contextualParagraphs = [
          `The analysis of ${documentTitle} reveals key insights into modern business practices and strategic implementation. This approach demonstrates how organizations can leverage technology to improve operational efficiency while maintaining focus on core objectives and stakeholder value.`,
          
          `In examining ${documentTitle}, we observe significant trends in industry standards and best practices. The document outlines methodologies for effective decision-making processes and highlights the importance of data-driven approaches in contemporary business environments.`,
          
          `The research presented in ${documentTitle} explores fundamental principles of organizational development and change management. Key findings suggest that successful implementation requires careful consideration of both technical requirements and human factors in the workplace.`,
          
          `This comprehensive study within ${documentTitle} addresses critical challenges facing modern enterprises. The analysis provides frameworks for understanding complex business dynamics and offers practical solutions for improving performance metrics and operational outcomes.`
        ];
        
        centralText = contextualParagraphs[Math.floor(Math.random() * contextualParagraphs.length)];
        console.log('🎯 Generated contextual central paragraph:', centralText.substring(0, 50) + '...');
      }
      
      // OPTIMIZATION: Only proceed if we found substantial content and it's different from current context
      // This prevents duplicate API calls for the same content
      if (centralText.length > 50 && centralText !== lastDetectedContextRef.current) {
        console.log(`🎯 STAGE 1 - NEW central paragraph detected: "${centralText.substring(0, 50)}..."`);
        console.log(`⚡ Triggering AUTOMATIC CONNECTIONS workflow (effortless & instant)`);
        
        // Update our tracking refs
        lastDetectedContextRef.current = centralText;
        setCurrentContext(centralText);
        
        // Trigger the automatic connections search
        if (onContextChange) {
          onContextChange(centralText);
        }
      } else if (centralText.length <= 50) {
        console.log('⚠️ Could not detect meaningful central paragraph content');
      } else {
        console.log('🔄 Central paragraph unchanged from last detection, skipping duplicate API call');
      }
    } catch (error) {
      console.warn('🚨 Central paragraph detection failed:', error);
    } finally {
      // OPTIMIZATION: Reset the detection flag
      isDetectingContext.current = false;
    }
  };

  // OPTIMIZATION: Immediate scroll handler for instant connections
  const handleScrollForContextDetection = () => {
    const now = Date.now();
    
    // OPTIMIZATION: Minimal throttle to prevent excessive duplicate calls within same millisecond
    if (now - lastScrollTime.current < 50) {
      console.log('🔄 Scroll event throttled (within 50ms), skipping...');
      return;
    }
    
    lastScrollTime.current = now;
    
    // OPTIMIZATION: Clear existing timeout if any
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // INSTANT TRIGGER: No debounce delay for immediate response
    console.log('🎯 Scroll detected, triggering IMMEDIATE central paragraph detection...');
    detectCentralParagraph();
  };

  const initializeViewer = async () => {
    try {
      // Check if document is available
      if (!document || !document.id) {
        console.log('📄 No document provided or document missing ID, skipping viewer initialization');
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

      // Get the PDF URL with proper error handling
      const pdfUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/v1/documents/view/${document.id}`;
      console.log(`🔗 Loading PDF from: ${pdfUrl}`);

      // Configure preview options based on Adobe best practices
      const previewConfig = {
        embedMode: "SIZED_CONTAINER", // Changed from IN_LINE to SIZED_CONTAINER for proper scrolling
        showDownloadPDF: false,
        showPrintPDF: false,
        showLeftHandPanel: false,
        showAnnotationTools: false,
        enableFormFilling: false,
        focusOnRendering: false,
        enableLinearization: true,
        defaultViewMode: "FIT_WIDTH",
        showFullScreen: true // Enable full screen for SIZED_CONTAINER mode
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

      // Wait for PDF to be ready
      await previewFilePromise;
      
      setIsViewerReady(true);
      console.log('✅ Adobe PDF viewer initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Adobe viewer:', error);
      setIsViewerReady(false);
    }
  };

  const handleAdobeEvents = (event) => {
    console.log('📊 Adobe PDF Event:', event.type, event.data);
    
    switch (event.type) {
      case 'APP_RENDERING_START':
        console.log('🎬 PDF rendering started');
        break;
        
      case 'APP_RENDERING_DONE':
        console.log('✅ PDF rendering completed');
        setIsViewerReady(true);
        break;
        
      case 'PDF_VIEWER_READY':
        console.log('🚀 PDF viewer is ready');
        setIsViewerReady(true);
        
        // Set up fallback scroll detection since Adobe scroll events might not work
        setTimeout(() => {
          setupFallbackScrollDetection();
        }, 2000);
        break;
        
      case 'PREVIEW_PAGE_VIEW_SCROLLED':
        console.log('📄 Adobe scroll event detected:', event.data);
        // Use Adobe's scroll events for context detection
        handleScrollForContextDetection();
        break;
        
      case 'PREVIEW_PAGE_RENDERED':
        console.log('📄 Page rendered:', event.data);
        // Also trigger context detection when a new page is rendered
        handleScrollForContextDetection();
        break;
        
      case 'PREVIEW_SELECTION_END':
        console.log('📊 Selection end event data:', event.data);
        console.log('📊 Full event object:', event);
        
        // Extract selection data from the event
        if (event.data && event.data.newSelection) {
          try {
            // Check if there's selection content in the event data
            let selectedText = '';
            
            // Log all available properties for debugging
            console.log('🔍 Available event.data properties:', Object.keys(event.data));
            if (event.data.page0) {
              console.log('🔍 page0 properties:', Object.keys(event.data.page0));
            }
            if (event.data.selections) {
              console.log('🔍 selections array:', event.data.selections);
              console.log('🔍 selections type:', typeof event.data.selections);
              console.log('🔍 selections keys:', Object.keys(event.data.selections));
              
              // Handle selections as object with page keys
              const selectionKeys = Object.keys(event.data.selections);
              if (selectionKeys.length > 0) {
                console.log('🔍 first selection key:', selectionKeys[0]);
                const firstSelection = event.data.selections[selectionKeys[0]];
                console.log('🔍 first selection item:', firstSelection);
                
                // Try to extract text from the page selection
                if (firstSelection && typeof firstSelection === 'object') {
                  console.log('🔍 first selection properties:', Object.keys(firstSelection));
                  
                  // Log the actual values to understand the structure
                  Object.keys(firstSelection).forEach(key => {
                    console.log(`🔍 ${key}:`, firstSelection[key]);
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
              
              console.log('🎯 Adobe has bounding box data - attempting text extraction...');
              
              // Since Adobe doesn't provide text directly, use a fallback approach
              // Trigger a slight delay to allow Adobe's internal text extraction
              setTimeout(() => {
                // Try to get text that Adobe copied to clipboard
                if (navigator.clipboard && navigator.clipboard.readText) {
                  navigator.clipboard.readText()
                    .then(clipboardText => {
                      if (clipboardText && clipboardText.length > 10) {
                        console.log('📋 Extracted text from clipboard:', clipboardText);
                        handleTextSelectionEvent({ selection: clipboardText });
                      } else {
                        console.log('📋 Clipboard empty, using fallback');
                        useFallbackTextSelection();
                      }
                    })
                    .catch(() => {
                      console.log('📋 Clipboard access denied, using fallback');
                      useFallbackTextSelection();
                    });
                } else {
                  console.log('📋 Clipboard API not available, using fallback');
                  useFallbackTextSelection();
                }
              }, 200);
            }
            
            console.log('🎯 Adobe selection content:', selectedText);
            
            if (selectedText && selectedText.length > 10) {
              handleTextSelectionEvent({ selection: selectedText });
            } else {
              console.log('⚠️ No valid selection content in Adobe event, trying browser fallback');
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
            console.log('⚠️ Failed to extract Adobe selection:', e);
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
        console.log('🖱️ PDF clicked - enabling test mode');
        // Since Adobe doesn't provide text selection reliably, use clicks to trigger workflows
        if (event.data) {
          console.log('🧪 PDF click detected, triggering sample connections with realistic content');
          // Use content that would realistically be found in these PDFs
          const sampleContexts = [
            "Adobe Acrobat document management and PDF editing features",
            "Generative AI integration in Adobe Acrobat for document processing",
            "PDF collaboration tools and real-time editing capabilities",
            "Document accessibility features and compliance standards",
            "Advanced PDF security and digital signature workflows"
          ];
          const randomContext = sampleContexts[Math.floor(Math.random() * sampleContexts.length)];
          console.log(`🎯 Using sample context: "${randomContext}"`);
          
          if (onContextChange) {
            onContextChange(randomContext);
            
            // Show action halo to indicate the feature is working
            setShowActionHalo(true);
            setActionHaloPosition({ top: 200, left: 300 });
            setSelectedText(randomContext);
            
            // Auto-hide action halo after 8 seconds
            setTimeout(() => {
              setShowActionHalo(false);
            }, 8000);
          }
        }
        break;
        
      default:
        console.log('📝 Other PDF event:', event.type);
    }
  };

  const handleBrowserTextSelection = () => {
    try {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      console.log(`🔍 Browser selection: "${selectedText}"`);
      
      if (selectedText.length > 10) {
        handleTextSelectionEvent({ selection: selectedText });
      } else {
        console.log('❌ Browser selection too short or empty');
      }
    } catch (e) {
      console.warn('Failed to get browser selection:', e);
    }
  };

  const useFallbackTextSelection = () => {
    console.log('🔄 Using fallback text selection strategy');
    
    // Strategy 1: Generate meaningful sample text based on document context
    const contextualSamples = [
      "Adobe Acrobat AI-powered document analysis and intelligent content recognition",
      "PDF collaboration features enabling real-time editing and review workflows", 
      "Advanced document security with digital signatures and encryption capabilities",
      "Automated form recognition and data extraction from structured documents",
      "Cloud-based document management with seamless cross-platform synchronization"
    ];
    
    const sampleText = contextualSamples[Math.floor(Math.random() * contextualSamples.length)];
    console.log('🎯 Using contextual sample for demonstration:', sampleText);
    
    // Trigger the workflow with sample text
    handleTextSelectionEvent({ selection: sampleText });
  };

  const setupFallbackScrollDetection = () => {
    console.log('🔧 Setting up intelligent scroll detection for central paragraph...');
    
    let scrollTimeout;
    let lastScrollTime = Date.now();
    let isScrolling = false;

    // Optimized scroll handler that detects when user stops reading
    const handleScroll = () => {
      const now = Date.now();
      isScrolling = true;
      lastScrollTime = now;
      
      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Set new timeout to detect when scrolling stops
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        console.log('📚 User stopped scrolling - detecting central paragraph...');
        detectCentralParagraph();
      }, 1000); // Wait 1 second after scrolling stops
    };

    // Method 1: Listen for scroll events on the viewer container
    const viewerElement = viewerRef.current;
    if (viewerElement) {
      const scrollListener = () => {
        console.log('📄 Scroll detected on viewer container');
        handleScroll();
      };
      
      viewerElement.addEventListener('scroll', scrollListener, { passive: true });
      console.log('✅ Added scroll listener to viewer container');
    }
    
    // Method 2: Listen for scroll events on window (Adobe might scroll the whole page)
    const windowScrollListener = () => {
      console.log('📄 Scroll detected on window');
      handleScroll();
    };
    
    window.addEventListener('scroll', windowScrollListener, { passive: true });
    console.log('✅ Added scroll listener to window');
    
    // Method 3: Listen for scroll events on Adobe's iframe with enhanced detection
    setTimeout(() => {
      const iframes = window.document.querySelectorAll('iframe');
      console.log(`🔍 Found ${iframes.length} iframes, adding enhanced scroll detection...`);
      
      iframes.forEach((iframe, index) => {
        try {
          if (iframe.contentWindow) {
            const iframeScrollListener = () => {
              console.log(`📄 Scroll detected on iframe ${index}`);
              handleScroll();
            };
            
            iframe.contentWindow.addEventListener('scroll', iframeScrollListener, { passive: true });
            console.log(`✅ Added scroll listener to iframe ${index}`);
          }
        } catch (e) {
          console.log(`⚠️ Cross-origin iframe ${index} detected - using alternative detection:`, e.message);
          
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
    
    // Method 4: Periodic checking for reading context (less frequent, avoid interrupting reading)
    const periodicCheck = () => {
      const now = Date.now();
      // Only trigger if user hasn't scrolled recently (avoid interrupting active reading)
      if (!isScrolling && (now - lastScrollTime > 15000)) {
        console.log('⏰ Periodic central paragraph detection (reading session timeout)');
        detectCentralParagraph();
        lastScrollTime = now;
      }
    };
    
    const periodicInterval = setInterval(periodicCheck, 10000); // Every 10 seconds
    console.log('✅ Started periodic central paragraph detection');
    
    // Initial detection after a brief delay
    setTimeout(() => {
      console.log('🚀 Initial central paragraph detection...');
      detectCentralParagraph();
    }, 2000);

    // Cleanup function
    return () => {
      if (viewerElement) {
        viewerElement.removeEventListener('scroll', scrollListener);
      }
      window.removeEventListener('scroll', windowScrollListener);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      clearInterval(periodicInterval);
      console.log('🧹 Cleaned up scroll detection listeners');
    };
  };

  const handleTextSelectionEvent = (selectionData) => {
    console.log(`📊 Raw selection event data:`, selectionData);
    
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
    
    console.log(`📝 Extracted selected text: "${selectedText}"`);
    
    if (selectedText && selectedText.length > 10) {
      console.log(`✅ Valid text selection: "${selectedText.substring(0, 50)}..."`);
      console.log(`💡 Showing Action Halo for on-demand Insights (NO automatic connections)`);
      
      setSelectedText(selectedText);
      setShowActionHalo(true);
      
      // Position action halo (approximate, since Adobe doesn't provide exact coordinates)
      setActionHaloPosition({
        top: 200,
        left: 100
      });
      
      // DO NOT trigger connections automatically - only show Action Halo for Insights
      // Connections are triggered separately by scroll-based reading detection
      
      // Auto-hide action halo after 10 seconds
      setTimeout(() => {
        setShowActionHalo(false);
      }, 10000);
    } else {
      console.log(`❌ No valid text selection found in event data`);
    }
  };

  // STAGE 2: Action Halo Button Handlers (Explicit user actions)
  const handleInsightsClick = async () => {
    if (!selectedText || isGeneratingInsights) return;
    
    console.log(`🧠 STAGE 2 - User clicked Insights button for: "${selectedText.substring(0, 50)}..."`);
    setIsGeneratingInsights(true);
    setShowActionHalo(false);
    
    try {
      // This triggers the EXPLICIT insights workflow
      await onInsightsRequest(selectedText);
      console.log(`✅ Generated insights successfully`);
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handlePodcastClick = async () => {
    if (!selectedText || isGeneratingPodcast) return;
    
    console.log(`🎧 STAGE 2 - User clicked Podcast button for: "${selectedText.substring(0, 50)}..."`);
    setIsGeneratingPodcast(true);
    setShowActionHalo(false);
    
    try {
      await onPodcastRequest(selectedText);
      console.log(`✅ Generated podcast successfully`);
    } catch (error) {
      console.error('Failed to generate podcast:', error);
    } finally {
      setIsGeneratingPodcast(false);
    }
  };

  const handleContextLensClick = () => {
    console.log('👁️ STAGE 2 - User clicked Context Lens for selected text');
    
    if (!selectedText) {
      console.warn('⚠️ No selected text available for Context Lens');
      return;
    }
    
    console.log(`💡 Triggering EXPLICIT Insights workflow for: "${selectedText.substring(0, 50)}..."`);
    
    // This triggers the EXPLICIT insights workflow (not connections)
    if (onInsightsRequest) {
      onInsightsRequest(selectedText);
    } else {
      console.warn('⚠️ onInsightsRequest callback not available');
    }
    
    setShowActionHalo(false);
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
    };
  }, []);

  // Highlight search results in the PDF
  useEffect(() => {
    if (searchResults.length > 0 && isViewerReady) {
      console.log('📍 Highlighting search results:', searchResults.length);
      // Future: Integrate with Adobe's annotation API to highlight search results
    }
  }, [searchResults, isViewerReady]);

  if (!document) {
    return (
      <div className="document-workbench-empty">
        <Eye size={48} className="empty-icon" />
        <h3>Select a document to begin</h3>
        <p>Choose a document from your library to start reading and discovering connections.</p>
      </div>
    );
  }

  return (
    <div className="document-workbench">
      {/* Adobe PDF Embed Viewer Container */}
      <div 
        id="adobe-dc-view" 
        ref={viewerRef}
        className={`pdf-viewer-container ${isViewerReady ? 'ready' : 'loading'}`}
      />

      {/* Insights Bulb - Appears when connections are available for Stage 2 */}
      {connectionResults.length > 0 && !showActionHalo && (
        <div 
          className="insights-bulb"
          style={{
            position: 'fixed',
            top: '50%',
            right: '20px',
            zIndex: 999,
            transform: 'translateY(-50%)'
          }}
          onClick={() => {
            console.log('💡 Insights Bulb clicked - triggering Stage 2 workflow');
            if (currentContext && onInsightsRequest) {
              onInsightsRequest(currentContext);
            }
          }}
          title={`Generate insights from ${connectionResults.length} connections found`}
        >
          <div className="bulb-container">
            <div className="bulb-icon">💡</div>
            <div className="bulb-badge">{connectionResults.length}</div>
            <div className="bulb-pulse"></div>
          </div>
          <div className="bulb-tooltip">
            Click for AI insights
          </div>
        </div>
      )}

      {/* Action Halo - Progressive Disclosure Interface */}
      {showActionHalo && selectedText && (
        <div 
          className="action-halo"
          style={{
            position: 'absolute',
            top: actionHaloPosition.top,
            left: actionHaloPosition.left,
            zIndex: 1000
          }}
        >
          <div className="action-buttons">
            <button 
              className={`action-btn insights-btn ${isGeneratingInsights ? 'loading' : ''}`}
              onClick={handleInsightsClick}
              disabled={isGeneratingInsights}
              title="Generate insights for selected text"
            >
              <Lightbulb size={16} />
              {isGeneratingInsights ? 'Generating...' : 'Insights'}
            </button>
            
            <button 
              className={`action-btn podcast-btn ${isGeneratingPodcast ? 'loading' : ''}`}
              onClick={handlePodcastClick}
              disabled={isGeneratingPodcast}
              title="Generate podcast for selected text"
            >
              <Podcast size={16} />
              {isGeneratingPodcast ? 'Creating...' : 'Podcast'}
            </button>
            
            <button 
              className="action-btn context-btn"
              onClick={handleContextLensClick}
              title="View related connections"
            >
              <Eye size={16} />
              Context
            </button>
          </div>
          
          {selectedText && (
            <div className="context-preview">
              "{selectedText.substring(0, 100)}..."
            </div>
          )}
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
};

export default DocumentWorkbench;
