# Synapse Frontend Documentation

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Component Structure](#component-structure)
- [Core Features](#core-features)
- [User Interface Design](#user-interface-design)
- [State Management](#state-management)
- [API Integration](#api-integration)
- [Adobe PDF Embed Integration](#adobe-pdf-embed-integration)
- [Development Guide](#development-guide)
- [Build and Deployment](#build-and-deployment)

## Overview

The Synapse frontend is a React-based single-page application that provides an immersive, intelligent document reading experience. Built specifically for the Adobe Hackathon 2025 "Connecting the Dots" challenge, it implements a sophisticated three-panel interface that transforms traditional PDF viewing into an interactive, AI-powered knowledge exploration platform.

### Key Capabilities

- **Immersive PDF Viewing**: High-fidelity PDF rendering using Adobe PDF Embed API
- **Intelligent Context Detection**: Automatic reading progress tracking and context extraction
- **Real-time Connections**: Instant discovery of related content across document libraries
- **AI-Powered Insights**: On-demand generation of contextual insights and analysis
- **Multi-Speaker Podcasts**: Audio content generation with natural dialogue between speakers
- **Interactive Navigation**: Breadcrumb-based trail system for exploration tracking

## Architecture

### Two-Stage Workflow Architecture

The frontend implements a sophisticated two-stage workflow designed for optimal user experience and performance:

#### Stage 1: Connections Workflow (Real-time & Automatic)
- **Trigger**: Scroll-based reading detection in DocumentWorkbench
- **Action**: Automatically finds related content across document library
- **UI**: Updates connections panel seamlessly in background
- **User Experience**: "Magical" discovery without any user action

#### Stage 2: Insights Workflow (On-Demand & Explicit)
- **Trigger**: User text selection + explicit button clicks (Action Halo)
- **Action**: Generates AI-powered insights using selected text + Stage 1 connections as context
- **UI**: Shows Action Halo, then insights panel with rich analysis
- **User Experience**: Deliberate, high-value analysis on user request

### Three-Panel "Cockpit" Design

```
┌─────────────────┬─────────────────┬─────────────────┐
│   The Workspace │ The Workbench   │   The Synapse   │
│   (Left Panel)  │ (Center Panel)  │  (Right Panel)  │
│                 │                 │                 │
│ • Document      │ • PDF Viewer    │ • Connections   │
│   Library       │ • Context Lens  │ • Insights      │
│ • Flow Status   │ • Action Halo   │ • Podcast Gen   │
│ • Quick Start   │ • Breadcrumbs   │ • Audio Player  │
│                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

## Component Structure

### Core Components

#### App.jsx - Main Application Orchestrator

**Location**: `src/App.jsx`

The central component that orchestrates the entire application state and workflow:

```jsx
/**
 * Two-Stage Workflow Implementation:
 * 
 * STAGE 1: Connections (Automatic)
 * - handleContextChange() - Triggered by reading detection
 * - Updates connectionResults seamlessly
 * 
 * STAGE 2: Insights (Explicit)  
 * - handleInsightsRequest() - Triggered by user selection
 * - handlePodcastRequest() - Triggered by audio generation
 */
function App() {
  // Document Management State
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  
  // Context & Search State
  const [currentContext, setCurrentContext] = useState('');
  const [connectionResults, setConnectionResults] = useState([]);
  
  // Navigation Breadcrumb State
  const [breadcrumbTrail, setBreadcrumbTrail] = useState([]);
```

**Key Features**:
- **Breadcrumb Trail Management**: Tracks user navigation path across documents and pages
- **Global Keyboard Shortcuts**: Cmd+K for Knowledge Graph modal
- **Session Management**: Handles document selection and context switching
- **Two-Stage Workflow Coordination**: Orchestrates automatic connections and explicit insights

#### DocumentLibrary.jsx - The Workspace (Left Panel)

**Location**: `src/components/DocumentLibrary.jsx`

Provides document management and workspace overview:

```jsx
/**
 * Features:
 * - Drag-and-drop upload with visual feedback
 * - Multi-file selection and batch upload
 * - Document status tracking (processing/ready/error)
 * - Real-time processing progress
 * - Session-based document filtering
 */
```

**Component Capabilities**:
- **Upload Interface**: Intuitive drag-and-drop with progress tracking
- **Status Monitoring**: Real-time processing status with visual indicators
- **Document Organization**: Session-based document library management
- **Quick Actions**: Document selection, deletion, and status refresh

#### DocumentWorkbench.jsx - The Workbench (Center Panel)

**Location**: `src/components/DocumentWorkbench.jsx`

The heart of the PDF viewing experience with advanced interaction capabilities:

```jsx
/**
 * Advanced Features:
 * - Adobe PDF Embed API integration
 * - Context Lens for reading detection
 * - Action Halo for user interactions
 * - Breadcrumb navigation integration
 * - Multi-method text selection
 */
```

**Core Functionality**:

##### Context Lens Technology
- **Reading Detection**: Monitors scroll position and viewport
- **Content Analysis**: Extracts current reading context automatically
- **Real-time Updates**: Triggers Stage 1 connections workflow seamlessly

##### Action Halo Interface
- **Smart Positioning**: Appears near text selections with optimal placement
- **Progressive Disclosure**: Shows relevant actions based on context
- **Visual Feedback**: Clear visual indicators for available actions

##### Adobe PDF Embed Integration
```jsx
// Advanced PDF viewer setup with comprehensive event handling
useEffect(() => {
  if (!document || !isConfigLoaded) return;

  const initializeViewer = async () => {
    try {
      const adobeDC = window.AdobeDC;
      const adobeView = adobeDC.View({
        clientId: adobeConfig.clientId,
        divId: "adobe-dc-view"
      });

      // Enhanced PDF viewing configuration
      const viewerConfig = {
        embedMode: "SIZED_CONTAINER",
        showAnnotationTools: false,
        showLeftHandPanel: false,
        showDownloadPDF: false,
        showPrintPDF: false,
        showDisabledSaveButton: false,
        enableFormFilling: false,
        includePDFAnnotations: false
      };

      // Register comprehensive event handlers
      adobeView.registerCallback(
        AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
        handleAdobeEvents,
        { enablePDFAnalytics: false }
      );
    }
  };
}, [document, isConfigLoaded]);
```

##### Text Selection Strategies
The component implements multiple fallback strategies for robust text selection:

1. **Adobe API Selection**: Primary method using PDF Embed API
2. **Browser Selection**: Fallback for text outside PDF viewer
3. **DOM Query Selection**: Alternative detection for iframe content
4. **Synthetic Selection**: Context generation when no text selected

#### SynapsePanel.jsx - The Synapse (Right Panel)

**Location**: `src/components/SynapsePanel.jsx`

Implements the AI conversation interface with sophisticated state management:

```jsx
/**
 * Tabbed Interface:
 * - Connections Tab: Real-time related content discovery
 * - Insights Tab: AI-powered analysis and insights
 * - Audio Integration: Podcast generation and playback
 */
```

**Advanced Features**:

##### Intelligent Caching System
```jsx
// Page-based cache with content similarity detection
const connectionsCache = useRef(new Map());

const cacheKey = `${selectedDocument?.id}:${extractedPage}`;
const contentHash = btoa(queryText).slice(0, 16);

// Cache hit detection with content validation
if (cached && cached.contentHash === contentHash) {
  console.log('📋 Using cached connections results');
  setConnections(cached.results);
  return;
}
```

##### Insights Generation Workflow
```jsx
// Sophisticated insights generation with context awareness
const generateInsights = async (selectedText, connectionResults) => {
  // 1. Validate context and connections
  // 2. Prepare structured LLM prompt
  // 3. Generate insights with citations
  // 4. Parse and format results
  // 5. Update UI with structured data
};
```

##### Multi-Speaker Podcast Generation
```jsx
// Advanced podcast generation with speaker differentiation
const generatePodcast = async (context) => {
  // 1. Generate structured script with speaker roles
  // 2. Process audio generation for each speaker
  // 3. Handle audio concatenation and playback
  // 4. Provide download and sharing options
};
```

### Specialized Components

#### FlowStatusBar.jsx - Workflow Progress Indicator

**Location**: `src/components/FlowStatusBar.jsx`

Provides visual feedback for the three-stage user workflow:

```jsx
/**
 * Workflow Stages:
 * 1. Upload - Document library building
 * 2. Connect - Automatic connections discovery  
 * 3. Generate - Explicit insights and audio generation
 */
```

**Visual Design**:
- **Completed Steps**: Solid blue circles with white icons
- **Active Step**: Blue outline with blue icon (prominent)
- **Pending Steps**: Gray outline with gray icon
- **Responsive Layout**: Adapts to horizontal and vertical orientations

#### QuickStartGuide.jsx - User Onboarding

**Location**: `src/components/QuickStartGuide.jsx`

Interactive tutorial for first-time users:

```jsx
/**
 * Onboarding Flow:
 * 1. Welcome and feature overview
 * 2. Document upload demonstration
 * 3. Reading and connections explanation
 * 4. Insights and audio features tour
 */
```

#### KnowledgeGraphModal.jsx - Visual Knowledge Representation

**Location**: `src/components/KnowledgeGraphModal.jsx`

Advanced knowledge graph visualization using react-force-graph-2d:

```jsx
/**
 * Features:
 * - Interactive node and link visualization
 * - Document relationship mapping
 * - Zoom and pan navigation
 * - Contextual node information
 * - Export and sharing capabilities
 */
```

## Core Features

### Intelligent Reading Detection

The frontend implements sophisticated reading detection that automatically triggers the connections workflow:

#### Scroll-Based Context Extraction
```jsx
// Optimized scroll handler with debouncing
const handleScroll = useCallback(
  debounce(async () => {
    if (!isViewerReady || !selectedDocument) return;
    
    try {
      // Extract current reading context from viewport
      const apis = await adobeViewerRef.current.getAPIs();
      const currentPage = await apis.getCurrentPage();
      const viewportText = await extractViewportText();
      
      // Trigger Stage 1 connections workflow
      onContextChange({
        text: viewportText,
        page: currentPage,
        document: selectedDocument
      });
    } catch (error) {
      console.log('Context extraction failed:', error);
    }
  }, 800),
  [isViewerReady, selectedDocument, onContextChange]
);
```

### Breadcrumb Trail System

A unique navigation feature that tracks user exploration paths:

#### Trail Management
```jsx
const addToBreadcrumbTrail = (document, pageNumber, context = '') => {
  const newTrailItem = {
    id: `${document.id}-${pageNumber}-${Date.now()}`,
    documentId: document.id,
    documentName: cleanFileName(document.file_name),
    pageNumber: pageNumber,
    context: context.substring(0, 100),
    timestamp: Date.now()
  };

  setBreadcrumbTrail(prevTrail => {
    // Prevent duplicate consecutive entries
    const lastItem = prevTrail[prevTrail.length - 1];
    if (lastItem?.documentId === document.id && 
        lastItem?.pageNumber === pageNumber) {
      return prevTrail;
    }
    
    return [...prevTrail, newTrailItem];
  });
};
```

#### Smart Navigation
```jsx
const navigateToBreadcrumbItem = async (trailItem) => {
  const targetDoc = documents.find(doc => doc.id === trailItem.documentId);
  const isDocumentSwitch = targetDoc.id !== selectedDocument?.id;
  
  if (isDocumentSwitch) {
    setSelectedDocument(targetDoc);
  }
  
  // Navigate with appropriate timing based on operation type
  const navigationDelay = isDocumentSwitch ? 1500 : 50;
  
  setTimeout(async () => {
    const success = await documentWorkbenchRef.current.navigateToPage(
      trailItem.pageNumber
    );
    
    if (success) {
      // Truncate trail to this point (remove future items)
      setBreadcrumbTrail(prevTrail => 
        prevTrail.slice(0, prevTrail.findIndex(item => 
          item.id === trailItem.id
        ) + 1)
      );
    }
  }, navigationDelay);
};
```

### Action Halo Interface

The Action Halo provides contextual actions that appear when users select text:

#### Dynamic Positioning
```jsx
const showActionHalo = (selectionBounds) => {
  // Calculate optimal position avoiding viewport edges
  const haloPosition = {
    top: selectionBounds.bottom + 10,
    left: Math.max(50, selectionBounds.left - 100)
  };
  
  // Adjust for viewport boundaries
  if (haloPosition.top + 60 > window.innerHeight) {
    haloPosition.top = selectionBounds.top - 70;
  }
  
  setActionHaloPosition(haloPosition);
  setShowActionHalo(true);
};
```

#### Progressive Disclosure
```jsx
// Action Halo renders contextually relevant buttons
<div className="action-halo" style={actionHaloPosition}>
  <button onClick={() => generateInsights(selectedText)}>
    <Lightbulb /> Insights
  </button>
  <button onClick={() => generatePodcast(selectedText)}>
    <Radio /> Podcast
  </button>
  <button onClick={() => addToConnections(selectedText)}>
    <Network /> Connect
  </button>
</div>
```

### Real-Time Connection Discovery

The connections system automatically finds related content as users read:

#### Semantic Search Integration
```jsx
const findConnections = async (context) => {
  try {
    setIsLoadingConnections(true);
    
    const searchResponse = await searchAPI.semantic({
      query_text: context.text,
      top_k: 8,
      similarity_threshold: 0.65,
      document_ids: documents
        .filter(doc => doc.id !== selectedDocument?.id)
        .map(doc => doc.id)
    });
    
    const connections = searchResponse.results.map(result => ({
      ...result,
      explanation: generateConnectionExplanation(result, context),
      relevanceScore: calculateRelevanceScore(result, context)
    }));
    
    setConnectionResults(connections);
    onConnectionsUpdate?.(connections);
  } catch (error) {
    console.error('Connection discovery failed:', error);
  } finally {
    setIsLoadingConnections(false);
  }
};
```

## User Interface Design

### Design System

The frontend implements a professional design system optimized for document reading and analysis:

#### Color Palette
```css
:root {
  /* Primary Colors */
  --primary-blue: #2563eb;
  --primary-blue-light: #3b82f6;
  --primary-blue-dark: #1d4ed8;
  
  /* Semantic Colors */
  --success-green: #10b981;
  --warning-orange: #f59e0b;
  --error-red: #ef4444;
  
  /* Neutral Grays */
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-600: #4b5563;
  --gray-900: #111827;
  
  /* Background Colors */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-panel: #ffffff;
}
```

#### Typography
```css
.typography {
  /* Headings */
  --font-heading: 'Inter', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
  
  /* Scale */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
}
```

#### Layout System
```css
.layout {
  /* Panel Widths */
  --panel-sidebar: 320px;
  --panel-workbench: 1fr;
  --panel-synapse: 400px;
  
  /* Spacing Scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  
  /* Borders and Shadows */
  --border-radius: 8px;
  --border-radius-lg: 12px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
```

### Responsive Design

The interface adapts seamlessly across different screen sizes:

#### Breakpoints
```css
/* Mobile First Approach */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

#### Panel Behavior
- **Large Screens**: Full three-panel layout
- **Medium Screens**: Collapsible sidebar with two-panel view
- **Small Screens**: Single-panel view with navigation tabs

### Accessibility Features

#### Keyboard Navigation
```jsx
// Global keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (event) => {
    // Cmd+K or Ctrl+K for Knowledge Graph
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      setShowKnowledgeGraph(prev => !prev);
    }
    
    // Escape to close modals
    if (event.key === 'Escape') {
      closeActiveModals();
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

#### ARIA Labels and Semantic HTML
```jsx
// Semantic structure with proper ARIA labels
<nav aria-label="Document navigation">
  <ol className="breadcrumb-trail" role="list">
    {breadcrumbTrail.map(item => (
      <li key={item.id} role="listitem">
        <button
          aria-label={`Navigate to ${item.documentName} page ${item.pageNumber}`}
          onClick={() => navigateToBreadcrumbItem(item)}
        >
          {item.documentName}
        </button>
      </li>
    ))}
  </ol>
</nav>
```

## State Management

### Application State Architecture

The frontend uses a carefully designed state management system that balances simplicity with scalability:

#### Core State Categories

```jsx
// Document Management State
const [documents, setDocuments] = useState([]);
const [selectedDocument, setSelectedDocument] = useState(null);
const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

// Context & Search State  
const [currentContext, setCurrentContext] = useState('');
const [searchResults, setSearchResults] = useState([]);
const [connectionResults, setConnectionResults] = useState([]);
const [isSearching, setIsSearching] = useState(false);

// Navigation & UI State
const [breadcrumbTrail, setBreadcrumbTrail] = useState([]);
const [viewerError, setViewerError] = useState(null);
const [showQuickStart, setShowQuickStart] = useState(false);
const [hasInsights, setHasInsights] = useState(false);
```

### Component Communication Patterns

#### Parent-Child Props Flow
```jsx
// App.jsx orchestrates data flow to child components
<DocumentWorkbench
  document={selectedDocument}
  currentContext={currentContext}
  onContextChange={handleContextChange}
  onInsightsRequest={handleInsightsRequest}
  onPodcastRequest={handlePodcastRequest}
  breadcrumbTrail={breadcrumbTrail}
  onBreadcrumbClick={navigateToBreadcrumbItem}
  onAddCurrentLocation={addCurrentLocationToBreadcrumbs}
/>

<SynapsePanel
  ref={synapsePanelRef}
  contextInfo={currentContext}
  selectedDocument={selectedDocument}
  onConnectionSelect={handleConnectionSelect}
  onConnectionsUpdate={setConnectionResults}
  onInsightsGenerated={setHasInsights}
/>
```

#### Ref-Based Imperative Actions
```jsx
// Using refs for imperative operations that need direct control
const synapsePanelRef = useRef(null);
const documentWorkbenchRef = useRef(null);

// Expose methods through useImperativeHandle
useImperativeHandle(ref, () => ({
  generateInsights: async (context, connections) => {
    // Implementation
  },
  resetPanelState: () => {
    // Reset state
  },
  navigateToPage: async (pageNumber) => {
    // Navigation logic
  }
}));
```

### State Persistence

#### Local Storage Integration
```jsx
// Persist user preferences and session data
const persistUserPreferences = () => {
  const preferences = {
    hasSeenQuickStart: true,
    lastSelectedDocument: selectedDocument?.id,
    uiPreferences: {
      isSidebarCollapsed,
      preferredPanelSizes
    }
  };
  
  localStorage.setItem('synapse_preferences', JSON.stringify(preferences));
};

// Restore user preferences on app load
useEffect(() => {
  const saved = localStorage.getItem('synapse_preferences');
  if (saved) {
    const preferences = JSON.parse(saved);
    applyUserPreferences(preferences);
  }
}, []);
```

#### Session Management
```jsx
// Generate and manage session IDs for backend communication
const sessionId = useMemo(() => {
  let stored = sessionStorage.getItem('synapse_session_id');
  if (!stored) {
    stored = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('synapse_session_id', stored);
  }
  return stored;
}, []);

// Include session ID in all API calls
const apiConfig = {
  headers: {
    'X-Session-ID': sessionId,
    'Content-Type': 'application/json'
  }
};
```

## API Integration

### API Service Architecture

**Location**: `src/api/index.js`

The frontend implements a comprehensive API service layer with proper error handling and response processing:

```javascript
// Centralized API configuration
const API_BASE_URL = window.location.origin;

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for session management
apiClient.interceptors.request.use(config => {
  const sessionId = sessionStorage.getItem('synapse_session_id');
  if (sessionId) {
    config.headers['X-Session-ID'] = sessionId;
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    if (error.response?.status === 401) {
      // Handle authentication errors
      window.location.reload();
    }
    throw error;
  }
);
```

### Service Modules

#### Document API
```javascript
export const documentAPI = {
  async list() {
    const response = await apiClient.get('/documents/');
    return response.data;
  },

  async upload(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    });
    
    return response.data;
  },

  async uploadMultiple(files) {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const response = await apiClient.post('/documents/upload-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    return response.data;
  },

  async delete(documentId) {
    await apiClient.delete(`/documents/${documentId}`);
  },

  getPdfUrl(documentId) {
    const sessionId = sessionStorage.getItem('synapse_session_id');
    return `${API_BASE_URL}/api/v1/documents/${documentId}/pdf?session_id=${sessionId}`;
  }
};
```

#### Search API
```javascript
export const searchAPI = {
  async semantic(query) {
    const response = await apiClient.post('/search/semantic', query);
    return response.data;
  },

  async text(query, documentIds = null, limit = 10) {
    const params = new URLSearchParams({ 
      query, 
      limit: limit.toString() 
    });
    
    if (documentIds) {
      documentIds.forEach(id => params.append('document_ids', id.toString()));
    }

    const response = await apiClient.get(`/search/text?${params}`);
    return response.data;
  }
};
```

#### Insights API
```javascript
export const insightsAPI = {
  async generate(text, context = '') {
    const response = await apiClient.post('/insights/generate', {
      text,
      context
    });
    return response.data;
  },

  async generateForDocument(documentId, analysisType = 'comprehensive') {
    const response = await apiClient.post(`/insights/document/${documentId}`, {
      analysis_type: analysisType
    });
    return response.data;
  }
};
```

#### Podcast API
```javascript
export const podcastAPI = {
  async generate(content, relatedContent = '', generateAudio = true, insights = null) {
    const response = await apiClient.post('/podcast/generate', {
      content,
      related_content: relatedContent,
      generate_audio: generateAudio,
      insights
    });
    return response.data;
  },

  getAudioUrl(filename) {
    return `${API_BASE_URL}/api/v1/podcast/audio/${filename}`;
  }
};
```

### Error Handling Strategy

#### Component-Level Error Handling
```jsx
const [error, setError] = useState(null);
const [isLoading, setIsLoading] = useState(false);

const handleApiCall = async (apiFunction, ...args) => {
  setError(null);
  setIsLoading(true);
  
  try {
    const result = await apiFunction(...args);
    return result;
  } catch (error) {
    const errorMessage = error.response?.data?.detail || 
                        error.message || 
                        'An unexpected error occurred';
    setError(errorMessage);
    console.error('API call failed:', error);
    throw error;
  } finally {
    setIsLoading(false);
  }
};
```

#### User-Friendly Error Display
```jsx
const ErrorDisplay = ({ error, onRetry }) => (
  <div className="error-container">
    <div className="error-content">
      <h3>Something went wrong</h3>
      <p>{error}</p>
      {onRetry && (
        <button onClick={onRetry} className="retry-button">
          Try Again
        </button>
      )}
    </div>
  </div>
);
```

## Adobe PDF Embed Integration

### Configuration and Setup

**Location**: `src/services/configService.js`

The frontend integrates deeply with Adobe PDF Embed API for high-fidelity PDF viewing:

```javascript
class ConfigService {
  constructor() {
    this.config = null;
    this.isLoaded = false;
  }

  async loadConfig() {
    if (this.isLoaded) return this.config;

    try {
      const response = await fetch('/api/v1/config/client');
      const config = await response.json();
      
      this.config = {
        adobe: {
          clientId: config.adobe_client_id,
          isAvailable: !!config.adobe_client_id
        },
        features: config.features || {}
      };
      
      this.isLoaded = true;
      return this.config;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      this.config = { adobe: { isAvailable: false }, features: {} };
      this.isLoaded = true;
      return this.config;
    }
  }
}

export const configService = new ConfigService();
```

### PDF Viewer Implementation

#### Advanced Viewer Configuration
```jsx
const initializeViewer = async () => {
  try {
    const adobeDC = window.AdobeDC;
    const adobeView = adobeDC.View({
      clientId: adobeConfig.clientId,
      divId: "adobe-dc-view"
    });

    // Sophisticated viewer configuration for document analysis
    const viewerConfig = {
      embedMode: "SIZED_CONTAINER",
      showAnnotationTools: false,
      showLeftHandPanel: false,
      showDownloadPDF: false,
      showPrintPDF: false,
      showDisabledSaveButton: false,
      enableFormFilling: false,
      includePDFAnnotations: false,
      showPageControls: true,
      showZoomControl: true,
      enableLinearization: true,
      enablePDFAnalytics: false
    };

    // Event handler registration for comprehensive interaction tracking
    adobeView.registerCallback(
      AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
      handleAdobeEvents,
      { enablePDFAnalytics: false }
    );

    // PDF loading and viewer initialization
    const previewPromise = adobeView.previewFile({
      content: { location: { url: pdfUrl } },
      metaData: { fileName: cleanFileName(document.file_name) }
    }, viewerConfig);

    // Store viewer reference for API access
    adobeViewerRef.current = await previewPromise;
    setIsViewerReady(true);
    
  } catch (error) {
    console.error('Adobe PDF Embed initialization failed:', error);
    setViewerError(`PDF viewer initialization failed: ${error.message}`);
  }
};
```

#### Event Handling System
```jsx
const handleAdobeEvents = (event) => {
  console.log(`📚 Adobe Event: ${event.type}`, event);

  switch (event.type) {
    case 'DOCUMENT_LOADED':
      handleDocumentLoaded(event);
      break;
      
    case 'PAGE_VIEW_CHANGED':
      handlePageViewChanged(event);
      break;
      
    case 'TEXT_SELECTION_CHANGED':
      handleTextSelectionChanged(event);
      break;
      
    case 'DOCUMENT_CLICK':
      handleDocumentClick(event);
      break;
      
    case 'ZOOM_CHANGED':
      handleZoomChanged(event);
      break;
      
    default:
      console.log(`📚 Unhandled Adobe event: ${event.type}`);
  }
};
```

#### Advanced Text Selection
```jsx
const handleTextSelection = async () => {
  try {
    let selectedText = '';
    let currentPageNum = 1;

    // Method 1: Adobe API selection (most accurate)
    if (adobeViewerRef.current) {
      const apis = await adobeViewerRef.current.getAPIs();
      
      if (apis?.getCurrentPage) {
        currentPageNum = await apis.getCurrentPage();
      }
      
      if (apis?.getSelectedContent) {
        const selectionData = await apis.getSelectedContent();
        
        // Comprehensive response parsing
        if (selectionData?.data?.selectedContent) {
          selectedText = selectionData.data.selectedContent.trim();
        } else if (selectionData?.selectedText) {
          selectedText = selectionData.selectedText.trim();
        } else if (typeof selectionData === 'string') {
          selectedText = selectionData.trim();
        }
      }
    }

    // Method 2: Browser selection fallback
    if (!selectedText) {
      const browserSelection = window.getSelection();
      if (browserSelection && browserSelection.toString().trim()) {
        selectedText = browserSelection.toString().trim();
      }
    }

    // Method 3: Context-based synthetic selection
    if (!selectedText && currentPageNum > 0) {
      selectedText = `Selected content from page ${currentPageNum} of "${cleanFileName(document?.file_name)}"`;
    }

    if (selectedText && selectedText.length >= 5) {
      // Trigger Stage 2 workflow with Action Halo
      setCurrentSelection(selectedText);
      setIsSelectionActive(true);
      showActionHalo();
    }
    
  } catch (error) {
    console.error('Text selection processing failed:', error);
  }
};
```

### Navigation API Integration
```jsx
// Expose navigation methods for breadcrumb integration
useImperativeHandle(ref, () => ({
  async navigateToPage(pageNumber) {
    if (!adobeViewerRef.current) return false;
    
    try {
      const apis = await adobeViewerRef.current.getAPIs();
      if (apis?.gotoLocation) {
        await apis.gotoLocation({ pageNumber });
        setCurrentPageNumber(pageNumber);
        return true;
      }
    } catch (error) {
      console.error('Page navigation failed:', error);
    }
    
    return false;
  },

  async getCurrentPage() {
    if (!adobeViewerRef.current) return 1;
    
    try {
      const apis = await adobeViewerRef.current.getAPIs();
      if (apis?.getCurrentPage) {
        return await apis.getCurrentPage();
      }
    } catch (error) {
      console.error('Failed to get current page:', error);
    }
    
    return 1;
  }
}));
```

## Development Guide

### Environment Setup

#### Prerequisites
```bash
Node.js 18+
npm or yarn package manager
Modern web browser with ES6+ support
```

#### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# The application will be available at http://localhost:5173
```

#### Environment Configuration
```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
```

### Development Workflow

#### Component Development
```jsx
// Follow this pattern for new components
import React, { useState, useEffect, useRef } from 'react';
import { ComponentIcon } from 'lucide-react';
import './ComponentName.css';

const ComponentName = ({ prop1, prop2, onAction }) => {
  // State management
  const [localState, setLocalState] = useState(null);
  
  // Refs for DOM access
  const elementRef = useRef(null);
  
  // Effects for lifecycle management
  useEffect(() => {
    // Initialization logic
    return () => {
      // Cleanup logic
    };
  }, [dependencies]);
  
  // Event handlers
  const handleAction = (data) => {
    // Process data
    onAction?.(data);
  };
  
  // Render with proper accessibility
  return (
    <div className="component-name" ref={elementRef}>
      <h2>Component Title</h2>
      <button 
        onClick={handleAction}
        aria-label="Descriptive action label"
      >
        <ComponentIcon />
        Action
      </button>
    </div>
  );
};

export default ComponentName;
```

#### CSS Organization
```css
/* Follow BEM methodology for CSS classes */
.component-name {
  /* Container styles */
}

.component-name__element {
  /* Element styles */
}

.component-name__element--modifier {
  /* Modifier styles */
}

.component-name--state {
  /* State variations */
}
```

### Testing Strategy

#### Component Testing
```jsx
// Example test structure
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComponentName from './ComponentName';

describe('ComponentName', () => {
  it('renders correctly with props', () => {
    render(<ComponentName prop1="value1" />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interactions', async () => {
    const mockAction = jest.fn();
    render(<ComponentName onAction={mockAction} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith(expectedData);
    });
  });
});
```

#### Integration Testing
```jsx
// Test component interactions
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Integration', () => {
  it('coordinates two-stage workflow', async () => {
    render(<App />);
    
    // Test Stage 1: Automatic connections
    // Test Stage 2: Explicit insights
    // Verify state coordination
  });
});
```

### Performance Optimization

#### React.memo Usage
```jsx
// Optimize expensive components
const ExpensiveComponent = React.memo(({ data, onAction }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison logic
  return prevProps.data.id === nextProps.data.id;
});
```

#### useCallback Optimization
```jsx
// Optimize callback functions
const handleExpensiveOperation = useCallback(
  debounce(async (data) => {
    // Expensive operation
  }, 500),
  [dependencies]
);
```

#### Lazy Loading
```jsx
// Lazy load heavy components
const KnowledgeGraphModal = lazy(() => import('./components/KnowledgeGraphModal'));

// Use with Suspense
<Suspense fallback={<div>Loading graph...</div>}>
  <KnowledgeGraphModal />
</Suspense>
```

## Build and Deployment

### Production Build

#### Build Configuration
```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

#### Build Optimization
```javascript
// vite.config.js - Production optimizations
export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          adobe: ['@adobe/dc-view-sdk'],
          charts: ['react-force-graph-2d']
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

### Docker Integration

The frontend is built as part of the multi-stage Docker process:

```dockerfile
# Frontend build stage
FROM node:18-alpine AS frontend
WORKDIR /frontend

# Copy package files for dependency resolution
COPY frontend/package.json frontend/package-lock.json ./

# Fast, reliable install using committed lock file
RUN npm ci --silent

# Copy source and build
COPY frontend/ ./
RUN npm run build

# Output: /frontend/dist ready for serving
```

### Static File Serving

The built frontend is served by the FastAPI backend:

```python
# backend/app/main.py
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

### Performance Monitoring

#### Metrics Collection
```javascript
// Performance monitoring setup
const performanceMonitor = {
  trackPageLoad: () => {
    window.addEventListener('load', () => {
      const loadTime = performance.now();
      console.log(`Page loaded in ${loadTime}ms`);
    });
  },
  
  trackUserInteraction: (action, duration) => {
    console.log(`${action} completed in ${duration}ms`);
  }
};
```

#### Error Tracking
```javascript
// Global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // Send to monitoring service
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Send to monitoring service
});
```

---

This comprehensive frontend documentation covers all aspects of the Synapse user interface, from high-level architecture to detailed implementation specifics. The frontend successfully implements the Adobe Hackathon 2025 requirements while providing an intuitive, powerful document analysis experience.
