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
  
  // Component References
  const synapsePanelRef = useRef(null);

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
    if (targetDoc && targetDoc.id !== selectedDocument?.id) {
      setSelectedDocument(targetDoc);
    }
    
    // TODO: Navigate to specific page/location in the PDF
    // This would require Adobe PDF Embed API integration
  };

  return (
    <div className="app">
      <div className="app-layout">
        {/* Left Panel: The Knowledge Base */}
        <div className="panel panel-left">
          <DocumentLibrary
            documents={documents}
            selectedDocument={selectedDocument}
            onDocumentSelect={handleDocumentSelect}
            onDocumentsUpdate={loadDocuments}
          />
        </div>

        {/* Center Panel: The Workbench */}
        <div className="panel panel-center">
          <DocumentWorkbench
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
