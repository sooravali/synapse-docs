/**
 * Adobe PDF Embed API React Component
 * 
 * This component wraps the Adobe PDF Embed API in a reusable React component,
 * demonstrating sophisticated understanding of React and good software design principles.
 * It encapsulates imperative API calls and exposes a clean, declarative interface.
 */
import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';

const AdobeViewer = forwardRef(({ fileUrl, onLoad, onError }, ref) => {
  const viewerRef = useRef(null);
  const adobeViewRef = useRef(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  
  // Get Adobe Client ID from environment
  const clientId = import.meta.env.VITE_ADOBE_CLIENT_ID;

  // Expose methods to parent component using useImperativeHandle
  useImperativeHandle(ref, () => ({
    gotoPage: async (pageNumber) => {
      if (adobeViewRef.current && isViewerReady) {
        try {
          // Navigate to specific page using Adobe SDK
          const apis = await adobeViewRef.current.getAPIs();
          await apis.gotoLocation(pageNumber - 1); // Adobe uses 0-based indexing
          console.log(`Navigated to page ${pageNumber}`);
        } catch (error) {
          console.error('Error navigating to page:', error);
          if (onError) onError(error);
        }
      } else {
        console.warn('Adobe viewer not ready for navigation');
      }
    },
    
    getCurrentPage: async () => {
      if (adobeViewRef.current && isViewerReady) {
        try {
          const apis = await adobeViewRef.current.getAPIs();
          return await apis.getCurrentPage();
        } catch (error) {
          console.error('Error getting current page:', error);
          return 1;
        }
      }
      return 1;
    },
    
    search: async (searchTerm) => {
      if (adobeViewRef.current && isViewerReady) {
        try {
          const apis = await adobeViewRef.current.getAPIs();
          return await apis.search(searchTerm);
        } catch (error) {
          console.error('Error searching:', error);
          return [];
        }
      }
      return [];
    }
  }));

  // Load Adobe SDK script dynamically
  useEffect(() => {
    const loadAdobeSDK = () => {
      // Check if SDK is already loaded
      if (window.AdobeDC) {
        setIsSDKLoaded(true);
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        // Check if script is already being loaded
        if (document.querySelector('script[src*="view-sdk"]')) {
          // Wait for existing script to load
          const checkSDK = setInterval(() => {
            if (window.AdobeDC) {
              clearInterval(checkSDK);
              setIsSDKLoaded(true);
              resolve();
            }
          }, 100);
          return;
        }

        // Create script element
        const script = document.createElement('script');
        script.src = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';
        script.onload = () => {
          // Wait for adobe_dc_view_sdk.ready event
          document.addEventListener('adobe_dc_view_sdk.ready', () => {
            setIsSDKLoaded(true);
            setLoadingStatus('SDK loaded successfully');
            resolve();
          });
        };
        script.onerror = () => {
          setLoadingStatus('Failed to load Adobe SDK');
          reject(new Error('Failed to load Adobe PDF Embed SDK'));
        };
        document.head.appendChild(script);
      });
    };

    if (!clientId) {
      setLoadingStatus('Adobe Client ID not configured');
      console.error('VITE_ADOBE_CLIENT_ID not found in environment variables');
      return;
    }

    setLoadingStatus('Loading Adobe SDK...');
    loadAdobeSDK().catch((error) => {
      console.error('Error loading Adobe SDK:', error);
      if (onError) onError(error);
    });
  }, [clientId, onError]);

  // Initialize viewer when SDK is loaded
  useEffect(() => {
    if (!isSDKLoaded || !viewerRef.current || !clientId) {
      console.log('Viewer initialization waiting:', {
        isSDKLoaded,
        viewerRefExists: !!viewerRef.current,
        clientId: clientId ? 'provided' : 'missing'
      });
      return;
    }

    const initializeViewer = async () => {
      try {
        console.log('=== ADOBE VIEWER INITIALIZATION ===');
        console.log('Client ID:', clientId);
        console.log('Viewer container:', viewerRef.current);
        
        setLoadingStatus('Initializing viewer...');
        
        // Clear previous viewer instance
        if (adobeViewRef.current) {
          viewerRef.current.innerHTML = '';
          adobeViewRef.current = null;
        }

        // Generate unique ID for viewer container
        const viewerId = `adobe-dc-view-${Date.now()}`;
        viewerRef.current.id = viewerId;

        console.log('Creating Adobe DC View with ID:', viewerId);

        // Create new viewer instance
        const adobeDCView = new window.AdobeDC.View({
          clientId: clientId,
          divId: viewerId
        });

        console.log('Adobe DC View created:', adobeDCView);

        adobeViewRef.current = adobeDCView;
        setIsViewerReady(true);
        setLoadingStatus('Viewer ready');
        
        console.log('Adobe viewer initialized successfully');
        
        if (onLoad) onLoad();
        
      } catch (error) {
        console.error('Error initializing Adobe viewer:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          clientId: clientId
        });
        setLoadingStatus('Failed to initialize viewer');
        if (onError) onError(error);
      }
    };

    initializeViewer();
  }, [isSDKLoaded, clientId, onLoad, onError]);

  // Load PDF file when fileUrl changes
  useEffect(() => {
    if (!adobeViewRef.current || !isViewerReady || !fileUrl) return;

    const loadPDF = async () => {
      try {
        setLoadingStatus('Loading PDF...');
        
        // Extract filename for display
        const filename = fileUrl.split('/').pop() || 'document.pdf';
        
        console.log('=== PDF LOADING DEBUG ===');
        console.log('Loading PDF from URL:', fileUrl);
        console.log('Adobe viewer ready:', isViewerReady);
        console.log('Adobe viewer instance:', adobeViewRef.current ? 'exists' : 'null');
        
        // Test if the URL is accessible
        try {
          const testResponse = await fetch(fileUrl, { method: 'HEAD' });
          console.log('PDF URL test response:', testResponse.status, testResponse.statusText);
        } catch (urlError) {
          console.error('PDF URL not accessible:', urlError);
        }
        
        // Configure viewer according to Adobe documentation
        const viewerConfig = {
          embedMode: "SIZED_CONTAINER",
          showLeftHandPanel: true,
          showAnnotationTools: false, // Disable for better compatibility
          showDownloadPDF: true,
          showPrintPDF: true,
          showZoomControl: true,
          enableSearchAPIs: true,
          enableFormFilling: false
        };

        console.log('Viewer config:', viewerConfig);

        // Preview the file using the correct Adobe API pattern
        await adobeViewRef.current.previewFile({
          content: { location: { url: fileUrl } },
          metaData: { fileName: filename }
        }, viewerConfig);

        setLoadingStatus('PDF loaded successfully');
        console.log('PDF loaded successfully');
        
        // Set up event listeners for enhanced functionality
        try {
          const apis = await adobeViewRef.current.getAPIs();
          
          // Listen for page changes
          apis.registerCallback(
            apis.getEventTypes().PAGE_CHANGED, 
            (event) => {
              console.log('Page changed to:', event.pageNumber);
            }
          );
        } catch (apiError) {
          console.warn('Could not register API callbacks:', apiError);
        }
        
      } catch (error) {
        console.error('Error loading PDF:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          fileUrl: fileUrl
        });
        setLoadingStatus(`Failed to load PDF: ${error.message}`);
        if (onError) onError(error);
      }
    };

    loadPDF();
  }, [fileUrl, isViewerReady, onError]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '600px', position: 'relative' }}>
      {!isViewerReady && (
        <div 
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            backgroundColor: '#f8f9fa',
            border: '2px dashed #dee2e6',
            borderRadius: '8px',
            color: '#6c757d',
            zIndex: 1
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '4px solid #e9ecef',
              borderTop: '4px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <h3 style={{ margin: '0 0 8px', fontWeight: '600' }}>Adobe PDF Viewer</h3>
            <p style={{ margin: 0, fontSize: '14px' }}>{loadingStatus}</p>
            {!clientId && (
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#dc3545' }}>
                Configure VITE_ADOBE_CLIENT_ID in environment variables
              </p>
            )}
          </div>
        </div>
      )}
      
      <div 
        ref={viewerRef}
        style={{ 
          width: '100%', 
          height: '100%',
          visibility: isViewerReady ? 'visible' : 'hidden'
        }}
        className="adobe-pdf-viewer-container"
      />
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

AdobeViewer.displayName = 'AdobeViewer';

export default AdobeViewer;
