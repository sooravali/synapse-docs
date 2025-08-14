/**
 * Main Application Component - Synapse-Docs "Conversational Intelligence" UI
 * 
 * Implements the three-panel "Cockpit" design:
 * - Left Panel: The Knowledge Base (Document Library)
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
  
  // UI State
  const [viewerError, setViewerError] = useState(null);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [hasInsights, setHasInsights] = useState(false);
  
  // Component References
  const synapsePanelRef = useRef(null);
  const documentWorkbenchRef = useRef(null);

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    if (isLoadingDocuments) return;
    
    setIsLoadingDocuments(true);
    try {
      console.log('📥 Loading documents from API...');
      const docs = await documentAPI.list();
      console.log('📋 Loaded documents:', docs);
      
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
          setSelectedDocument(readyDoc);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load documents:', error);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleDocumentSelect = (document) => {
    console.log('📄 Selected document:', document);
    setSelectedDocument(document);
    setCurrentContext(''); // Clear context when switching documents
    setSearchResults([]); // Clear search results
    setConnectionResults([]); // Clear connections when switching documents
    setHasInsights(false); // Reset insights state
    
    // Clear any insights and reset Synapse panel state
    if (synapsePanelRef.current && synapsePanelRef.current.resetPanelState) {
      synapsePanelRef.current.resetPanelState();
    }
  };

  // STAGE 1: Connections Workflow (Real-time & Automatic)
  // Triggered by scroll-based reading detection in DocumentWorkbench
  const handleContextChange = (context) => {
    console.log('🔄 STAGE 1 - Automatic Connections Workflow triggered:', context);
    setCurrentContext(context);
    // This will automatically trigger connections search in SynapsePanel
    // NO insights generation - that's Stage 2
  };

  // STAGE 2: Insights Workflow (On-Demand & Explicit)  
  // Triggered by explicit user actions (text selection + button clicks)
  const handleInsightsRequest = async (context) => {
    console.log('💡 STAGE 2 - Explicit Insights Workflow triggered:', context);
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
    console.log('🎙️ Generating podcast for:', context);
    if (synapsePanelRef.current) {
      try {
        await synapsePanelRef.current.generatePodcast(context);
      } catch (error) {
        console.error('Failed to generate podcast:', error);
      }
    }
  };

  const handleConnectionSelect = (connection) => {
    console.log('🔗 Connection selected:', connection);
    
    // Find the document for this connection
    const targetDoc = documents.find(doc => doc.id === connection.document_id);
    const isDocumentSwitch = targetDoc && targetDoc.id !== selectedDocument?.id;
    
    if (isDocumentSwitch) {
      setSelectedDocument(targetDoc);
    }
    
    // Navigate to specific page in the PDF using the exposed DocumentWorkbench method
    if (connection.page_number !== undefined && connection.page_number !== null) {
      const targetPageNumber = connection.page_number + 1; // Convert from 0-based to 1-based for display
      console.log(`🚀 Attempting to navigate to page ${targetPageNumber}`);
      
      // Smart timing based on operation type
      let navigationDelay;
      if (isDocumentSwitch) {
        // Document switching: Wait for new document to load but not too long
        navigationDelay = 1500; // Reduced from 3500ms to 1500ms
        console.log('📄 Document switch detected, using 1500ms delay');
      } else {
        // Same document navigation: Very quick
        navigationDelay = 50; // Reduced from 100ms to 50ms  
        console.log('🔗 Same document navigation, using 50ms delay');
      }
      
      // Enhanced navigation with retry logic
      const attemptNavigation = async (attempt = 1) => {
        if (documentWorkbenchRef.current && documentWorkbenchRef.current.navigateToPage) {
          const success = await documentWorkbenchRef.current.navigateToPage(targetPageNumber);
          if (success) {
            console.log(`✅ Successfully navigated to page ${targetPageNumber} (attempt ${attempt})`);
          } else if (attempt < 3 && isDocumentSwitch) {
            // Retry for document switches if first attempt fails
            console.log(`⚠️ Navigation failed, retrying in 500ms (attempt ${attempt + 1})`);
            setTimeout(() => attemptNavigation(attempt + 1), 500);
          } else {
            console.error(`❌ Failed to navigate to page ${targetPageNumber} after ${attempt} attempts`);
          }
        } else {
          console.warn('⚠️ DocumentWorkbench ref not available for navigation');
        }
      };
      
      setTimeout(() => attemptNavigation(), navigationDelay);
    } else {
      console.warn('⚠️ Connection does not have a valid page number for navigation');
    }
  };

  const handleQuickStartDismiss = () => {
    setShowQuickStart(false);
    localStorage.setItem('synapse_quickstart_seen', 'true');
  };

  return (
    <div className="app">
      {showQuickStart && (
        <QuickStartGuide onDismiss={handleQuickStartDismiss} />
      )}
      
      <div className="app-layout">
        {/* Left Panel: The Knowledge Base */}
        <div className="panel panel-left">
          <DocumentLibrary
            documents={documents}
            selectedDocument={selectedDocument}
            onDocumentSelect={handleDocumentSelect}
            onDocumentsUpdate={loadDocuments}
            connectionsCount={connectionResults.length}
            hasInsights={hasInsights}
            isLoadingConnections={isSearching}
            currentContext={currentContext}
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
          />
        </div>
      </div>
    </div>
  );
}

export default App;
