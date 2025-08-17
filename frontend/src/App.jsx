/**
 * Main Application Component - Synapse-Docs "Conversational Intelligence" UI
 * 
 * Implements the three-panel "Cockpit" design:
 * - Left Panel: The Workspace (Document Library)
 * - Center Panel: The Workbench (PDF Viewer with Context Lens & Action Halo)
 * - Right Panel: The Synapse (Connections & Insights)
 * 
 * TWO-STAGE WORKFLOW ARCHITECTURE:
 * 
 * STAGE 1: Connections Workflow (Real-time & Automatic)
 * - Trigger: Scroll-based reading detection in DocumentWorkbench
 * - Action: Automatically finds related content across document library
 * - UI: Updates connections panel seamlessly in background
 * - User Experience: "Magical" discovery without any user action
 * 
 * STAGE 2: Insights Workflow (On-Demand & Explicit)  
 * - Trigger: User text selection + explicit button clicks (Action Halo)
 * - Action: Generates AI-powered insights using selected text + Stage 1 connections as context
 * - UI: Shows Action Halo, then insights panel with rich analysis
 * - User Experience: Deliberate, high-value analysis on user request
 * 
 * This separation ensures optimal performance and clear user intent distinction.
 */
import { useState, useRef, useEffect } from 'react';
import { Network } from 'lucide-react';
import DocumentLibrary from './components/DocumentLibrary';
import DocumentWorkbench from './components/DocumentWorkbench';
import SynapsePanel from './components/SynapsePanel';
import QuickStartGuide from './components/QuickStartGuide';
import { documentAPI, searchAPI, insightsAPI } from './api';
import './App.css';

function App() {
  // Document Management State
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  
  // Context & Search State
  const [currentContext, setCurrentContext] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [connectionResults, setConnectionResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Navigation Breadcrumb State
  const [breadcrumbTrail, setBreadcrumbTrail] = useState([]);
  
  // UI State
  const [viewerError, setViewerError] = useState(null);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [hasInsights, setHasInsights] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Component References
  const synapsePanelRef = useRef(null);
  const documentWorkbenchRef = useRef(null);

  // Helper function to clean filename display
  const cleanFileName = (fileName) => {
    if (!fileName) return '';
    return fileName.replace(/^doc_\d+_/, '').replace(/\.pdf$/, '');
  };

  // Breadcrumb Trail Management Functions
  const addToBreadcrumbTrail = (document, pageNumber, context = '') => {
    const newTrailItem = {
      id: `${document.id}-${pageNumber}-${Date.now()}`, // Unique ID for each trail item
      documentId: document.id,
      documentName: cleanFileName(document.file_name),
      pageNumber: pageNumber,
      context: context.substring(0, 100), // Store context preview for tooltip
      timestamp: Date.now()
    };

    setBreadcrumbTrail(prevTrail => {
      // Check if the last item in trail is the same location to avoid duplicates
      const lastItem = prevTrail[prevTrail.length - 1];
      if (lastItem && 
          lastItem.documentId === document.id && 
          lastItem.pageNumber === pageNumber) {
        console.log('🍞 Skipping duplicate breadcrumb entry');
        return prevTrail;
      }

      const newTrail = [...prevTrail, newTrailItem];
      console.log(`🍞 Added to breadcrumb trail: ${newTrailItem.documentName} (Page ${pageNumber})`);
      console.log(`🍞 Trail now has ${newTrail.length} items`);
      return newTrail;
    });
  };

  const navigateToBreadcrumbItem = async (trailItem) => {
    console.log(`🍞 Navigating to breadcrumb: ${trailItem.documentName} (Page ${trailItem.pageNumber})`);
    
    // Find the target document
    const targetDoc = documents.find(doc => doc.id === trailItem.documentId);
    if (!targetDoc) {
      console.error('🍞 Target document not found for breadcrumb navigation');
      return;
    }

    // Check if we need to switch documents
    const isDocumentSwitch = targetDoc.id !== selectedDocument?.id;
    
    if (isDocumentSwitch) {
      console.log('🍞 Switching to different document');
      setSelectedDocument(targetDoc);
    }

    // Navigate to the specific page
    if (trailItem.pageNumber !== undefined && trailItem.pageNumber !== null) {
      const targetPageNumber = trailItem.pageNumber;
      console.log(`🍞 Navigating to page ${targetPageNumber}`);
      
      // Smart timing based on operation type
      const navigationDelay = isDocumentSwitch ? 1500 : 50;
      
      setTimeout(async () => {
        if (documentWorkbenchRef.current && documentWorkbenchRef.current.navigateToPage) {
          const success = await documentWorkbenchRef.current.navigateToPage(targetPageNumber);
          if (success) {
            console.log(`🍞 Successfully navigated to breadcrumb location`);
            
            // Truncate trail to this point (remove items after the clicked item)
            setBreadcrumbTrail(prevTrail => {
              const clickedIndex = prevTrail.findIndex(item => item.id === trailItem.id);
              if (clickedIndex !== -1) {
                const truncatedTrail = prevTrail.slice(0, clickedIndex + 1);
                console.log(`🍞 Truncated trail to ${truncatedTrail.length} items`);
                return truncatedTrail;
              }
              return prevTrail;
            });
          } else {
            console.error('🍞 Failed to navigate to breadcrumb location');
          }
        }
      }, navigationDelay);
    }
  };

  const clearBreadcrumbTrail = () => {
    console.log('🍞 Clearing breadcrumb trail');
    setBreadcrumbTrail([]);
  };

  const addCurrentLocationToBreadcrumbs = async (context = '') => {
    if (!selectedDocument) return;
    
    // Get current page from DocumentWorkbench
    let currentPage = 1; // Default fallback
    if (documentWorkbenchRef.current && documentWorkbenchRef.current.getCurrentPage) {
      try {
        currentPage = await documentWorkbenchRef.current.getCurrentPage();
      } catch (error) {
        console.log('🍞 Could not get current page, using default page 1');
      }
    }
    
    addToBreadcrumbTrail(selectedDocument, currentPage, context);
  };

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    if (isLoadingDocuments) return;
    
    setIsLoadingDocuments(true);
    try {
      console.log('Loading documents from API...');
      const docs = await documentAPI.list();
      console.log('Loaded documents:', docs);
      
      setDocuments(docs);
      
      // Show quick start guide for first-time users
      if (docs.length === 0) {
        // Check if user has seen the guide before
        const hasSeenQuickStart = localStorage.getItem('synapse_quickstart_seen');
        if (!hasSeenQuickStart) {
          setShowQuickStart(true);
        }
      }
      
      // Auto-select first ready document if none selected
      if (!selectedDocument && docs.length > 0) {
        const readyDoc = docs.find(doc => doc.status === 'ready');
        if (readyDoc) {
          console.log('Auto-selecting first ready document:', readyDoc.file_name);
          setSelectedDocument(readyDoc);
          
          // Add initial document to breadcrumb trail as starting point
          setTimeout(() => {
            console.log('🍞 Adding auto-selected initial document to breadcrumb trail');
            addToBreadcrumbTrail(readyDoc, 1, 'Auto-selected starting document');
          }, 1000); // Longer delay for auto-selection to ensure viewer is ready
        }
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleDocumentSelect = (document) => {
    console.log('Selected document:', document);
    setSelectedDocument(document);
    setCurrentContext(''); // Clear context when switching documents
    setSearchResults([]); // Clear search results
    setConnectionResults([]); // Clear connections when switching documents
    setHasInsights(false); // Reset insights state
    
    // Clear breadcrumb trail when manually selecting a new document
    // This ensures fresh navigation context
    clearBreadcrumbTrail();
    
    // Add the initial document to breadcrumb trail as the starting point
    // Use a small delay to ensure the document is loaded
    setTimeout(() => {
      if (document && document.id) {
        console.log('🍞 Adding initial document to breadcrumb trail as starting point');
        addToBreadcrumbTrail(document, 1, 'Starting document'); // Page 1 as starting point
      }
    }, 500);
    
    // Clear any insights and reset Synapse panel state
    if (synapsePanelRef.current && synapsePanelRef.current.resetPanelState) {
      synapsePanelRef.current.resetPanelState();
    }
  };

  // STAGE 1: Connections Workflow (Real-time & Automatic)
  // Triggered by scroll-based reading detection in DocumentWorkbench
  const handleContextChange = (context) => {
    console.log('STAGE 1 - Automatic Connections Workflow triggered:', context);
    setCurrentContext(context);
    // This will automatically trigger connections search in SynapsePanel
    // NO insights generation - that's Stage 2
  };

  // STAGE 2: Insights Workflow (On-Demand & Explicit)  
  // Triggered by explicit user actions (text selection + button clicks)
  const handleInsightsRequest = async (context) => {
    console.log('STAGE 2 - Explicit Insights Workflow triggered:', context);
    if (synapsePanelRef.current) {
      try {
        // Generate insights using the selected text + current connections as context
        await synapsePanelRef.current.generateInsights(context, connectionResults);
        setHasInsights(true);
      } catch (error) {
        console.error('Failed to generate insights:', error);
      }
    }
  };

  const handlePodcastRequest = async (context) => {
    console.log('Generating podcast for:', context);
    if (synapsePanelRef.current) {
      try {
        await synapsePanelRef.current.generatePodcast(context);
      } catch (error) {
        console.error('Failed to generate podcast:', error);
      }
    }
  };

  const handleConnectionSelect = (connection) => {
    console.log('Connection selected:', connection);
    
    // Find the document for this connection
    const targetDoc = documents.find(doc => doc.id === connection.document_id);
    const isDocumentSwitch = targetDoc && targetDoc.id !== selectedDocument?.id;
    
    // Add current location to breadcrumb trail BEFORE navigation
    if (selectedDocument && connection.page_number !== undefined) {
      // Get the CURRENT page the user is viewing (not just page 1)
      console.log('🍞 Getting current page before navigation for breadcrumb trail...');
      
      const addCurrentPageToBreadcrumbs = async () => {
        let currentPage = 1; // Default fallback
        
        // Try to get the actual current page from DocumentWorkbench
        if (documentWorkbenchRef.current && documentWorkbenchRef.current.getCurrentPage) {
          try {
            const actualCurrentPage = await documentWorkbenchRef.current.getCurrentPage();
            if (actualCurrentPage && actualCurrentPage > 0) {
              currentPage = actualCurrentPage;
              console.log(`🍞 Got actual current page: ${currentPage}`);
            }
          } catch (error) {
            console.log('🍞 Could not get current page, using default page 1');
          }
        }
        
        // Add the current location to breadcrumb trail with the actual page
        const contextPreview = `Viewing content before jumping to connection`;
        addToBreadcrumbTrail(selectedDocument, currentPage, contextPreview);
        console.log(`🍞 Added current location to breadcrumb: ${cleanFileName(selectedDocument.file_name)} (Page ${currentPage})`);
      };
      
      // Add current location immediately
      addCurrentPageToBreadcrumbs();
    }
    
    if (isDocumentSwitch) {
      setSelectedDocument(targetDoc);
    }
    
    // Navigate to specific page in the PDF using the exposed DocumentWorkbench method
    if (connection.page_number !== undefined && connection.page_number !== null) {
      const targetPageNumber = connection.page_number + 1; // Convert from 0-based to 1-based for display
      console.log(`Attempting to navigate to page ${targetPageNumber}`);
      
      // Smart timing based on operation type
      let navigationDelay;
      if (isDocumentSwitch) {
        // Document switching: Wait for new document to load but not too long
        navigationDelay = 1500; // Reduced from 3500ms to 1500ms
        console.log('Document switch detected, using 1500ms delay');
      } else {
        // Same document navigation: Very quick
        navigationDelay = 50; // Reduced from 100ms to 50ms  
        console.log('Same document navigation, using 50ms delay');
      }
      
      // Enhanced navigation with retry logic
      const attemptNavigation = async (attempt = 1) => {
        if (documentWorkbenchRef.current && documentWorkbenchRef.current.navigateToPage) {
          const success = await documentWorkbenchRef.current.navigateToPage(targetPageNumber);
          if (success) {
            console.log(` Successfully navigated to page ${targetPageNumber} (attempt ${attempt})`);
            
            // Add DESTINATION to breadcrumb trail after successful navigation
            const contextPreview = connection.text_chunk ? connection.text_chunk.substring(0, 100) : '';
            addToBreadcrumbTrail(targetDoc, targetPageNumber, contextPreview);
            console.log(`🍞 Added destination to breadcrumb: ${cleanFileName(targetDoc.file_name)} (Page ${targetPageNumber})`);
            
          } else if (attempt < 3 && isDocumentSwitch) {
            // Retry for document switches if first attempt fails
            console.log(` Navigation failed, retrying in 500ms (attempt ${attempt + 1})`);
            setTimeout(() => attemptNavigation(attempt + 1), 500);
          } else {
            console.error(` Failed to navigate to page ${targetPageNumber} after ${attempt} attempts`);
          }
        } else {
          console.warn(' DocumentWorkbench ref not available for navigation');
        }
      };
      
      setTimeout(() => attemptNavigation(), navigationDelay);
    } else {
      console.warn(' Connection does not have a valid page number for navigation');
    }
  };

  const handleQuickStartDismiss = () => {
    setShowQuickStart(false);
    localStorage.setItem('synapse_quickstart_seen', 'true');
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="app">
      {showQuickStart && (
        <QuickStartGuide onDismiss={handleQuickStartDismiss} />
      )}
      
      <div className="app-layout">
        {/* External Synapse View Button (visible when sidebar is collapsed) */}
        {isSidebarCollapsed && documents.length >= 2 && (
          <div className="external-synapse-view">
            <button
              onClick={() => {
                // You'll need to access the knowledge graph handler from DocumentLibrary
                // For now, let's expand the sidebar to access it
                setIsSidebarCollapsed(false);
              }}
              className="external-synapse-button"
              title="Open Synapse View - See how your documents connect"
            >
              <Network size={16} />
            </button>
          </div>
        )}
        
        {/* Left Panel: The Workspace */}
        <div className={`panel panel-left ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <DocumentLibrary
            documents={documents}
            selectedDocument={selectedDocument}
            onDocumentSelect={handleDocumentSelect}
            onDocumentsUpdate={loadDocuments}
            connectionsCount={connectionResults.length}
            hasInsights={hasInsights}
            isLoadingConnections={isSearching}
            currentContext={currentContext}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebar}
          />
        </div>

        {/* Center Panel: The Workbench */}
        <div className="panel panel-center">
          <DocumentWorkbench
            ref={documentWorkbenchRef}
            document={selectedDocument}
            currentContext={currentContext}
            onContextChange={handleContextChange}
            onInsightsRequest={handleInsightsRequest}
            onPodcastRequest={handlePodcastRequest}
            searchResults={searchResults}
            connectionResults={connectionResults}
            breadcrumbTrail={breadcrumbTrail}
            onBreadcrumbClick={navigateToBreadcrumbItem}
            onClearBreadcrumbs={clearBreadcrumbTrail}
            onAddCurrentLocation={addCurrentLocationToBreadcrumbs}
          />
        </div>

        {/* Right Panel: The Synapse */}
        <div className="panel panel-right">
          <SynapsePanel
            ref={synapsePanelRef}
            currentContext={currentContext}
            selectedDocument={selectedDocument}
            onConnectionSelect={handleConnectionSelect}
            onConnectionsUpdate={setConnectionResults}
            onInsightsGenerated={setHasInsights}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
