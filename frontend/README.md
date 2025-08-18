# Synapse-Docs Frontend

> A modern React application delivering an immersive PDF reading experience with real-time semantic connections, AI-powered insights, and interactive knowledge graph visualization.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Core Components](#core-components)
- [User Experience Features](#user-experience-features)
- [State Management](#state-management)
- [API Integration](#api-integration)
- [Development Setup](#development-setup)
- [Component Documentation](#component-documentation)
- [Performance Optimization](#performance-optimization)

## Overview

The Synapse-Docs frontend is a sophisticated React application that transforms traditional PDF reading into an interactive, intelligent document experience. Built specifically for the Adobe Hackathon 2025, it implements advanced UI/UX patterns including progressive disclosure, context-aware interfaces, and real-time semantic connections across multiple documents.

### Key Capabilities

- **Immersive PDF Experience**: High-fidelity document rendering with Adobe PDF Embed API
- **Real-time Semantic Search**: Instant cross-document connections on text selection
- **Progressive Disclosure**: Context Lens and Action Halo for clean, focused interactions
- **Interactive Visualization**: Force-directed knowledge graphs with document relationships
- **Multi-Modal Output**: Integrated audio player for AI-generated podcast content
- **Session Persistence**: Intelligent state management with browser storage integration

## Architecture

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           App.jsx                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │ Document    │  │ Document        │  │ Synapse Panel       │  │
│  │ Library     │  │ Workbench       │  │                     │  │
│  │             │  │                 │  │ ┌─────────────────┐ │  │
│  │ • Upload    │  │ • PDF Embed     │  │ │ Connections Tab │ │  │
│  │ • Management│  │ • Text Selection│  │ │ • Search Results│ │  │
│  │ • Status    │  │ • Context Lens  │  │ │ • Snippets      │ │  │
│  │             │  │ • Action Halo   │  │ └─────────────────┘ │  │
│  │             │  │ • Breadcrumbs   │  │ ┌─────────────────┐ │  │
│  │             │  │                 │  │ │ Insights Tab    │ │  │
│  │             │  │                 │  │ │ • AI Analysis   │ │  │
│  │             │  │                 │  │ │ • Audio Player  │ │  │
│  │             │  │                 │  │ └─────────────────┘ │  │
│  └─────────────┘  └─────────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────────────────┐   │
│  │ Flow Status Bar │  │ Knowledge Graph Modal              │   │
│  │ • Step Tracking │  │ • Force-Directed Graph             │   │
│  │ • Progress      │  │ • Interactive Navigation           │   │
│  └─────────────────┘  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
User Interaction → Component State → API Service → Backend → Response → UI Update
       ↓               ↓               ↓            ↓         ↓         ↓
Text Selection → Context Object → Semantic Search → FAISS → Results → Live Display
```

### State Management Flow

```
Browser Storage ←→ Session Management ←→ Component State ←→ Real-time Updates
       ↓                    ↓                   ↓               ↓
Persistence ←→ User Isolation ←→ Local State ←→ WebSocket Events
```

## Technology Stack

### Core Framework
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Framework** | React | 18.2+ | Modern component-based UI with concurrent features |
| **Build Tool** | Vite | 5.0+ | Lightning-fast development with HMR and optimized builds |
| **Language** | JavaScript ES2022 | Latest | Modern syntax with async/await and optional chaining |
| **Package Manager** | npm | 9.0+ | Dependency management with lock file integrity |

### UI/UX Libraries
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **PDF Rendering** | Adobe PDF Embed API | 2024 | High-fidelity document display with annotation support |
| **Graph Visualization** | react-force-graph-2d | 1.25+ | Interactive force-directed graphs with D3.js backend |
| **Icons** | Lucide React | 0.294+ | Consistent, customizable SVG icons |
| **Styling** | CSS Modules | Built-in | Component-scoped styling with optimal performance |

### API & Services
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **HTTP Client** | Axios | 1.6+ | Promise-based HTTP requests with interceptors |
| **Session Management** | Custom Service | - | User isolation with persistent storage |
| **Configuration** | Environment Variables | - | Runtime configuration management |

### Development Tools
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Dev Server** | Vite Dev Server | 5.0+ | Hot module replacement with instant updates |
| **Linting** | ESLint | 8.0+ | Code quality and consistency enforcement |
| **Formatting** | Prettier | 3.0+ | Automated code formatting |

## Core Components

### Document Workbench
**Location**: `src/components/DocumentWorkbench.jsx`

**Purpose**: The central PDF viewing interface with advanced interaction capabilities

**Key Features**:
- **Adobe PDF Embed Integration**: High-fidelity document rendering with zoom, search, and annotation
- **Context Lens**: Progressive disclosure of related information based on text selection
- **Action Halo**: Contextual action buttons that appear on text selection
- **Breadcrumb Trail**: Navigation history for document exploration paths
- **Real-time Search**: Live highlighting of search results within the PDF

**Implementation Highlights**:
```jsx
const DocumentWorkbench = forwardRef(({ 
  document, 
  currentContext, 
  onContextChange, 
  searchResults,
  breadcrumbTrail,
  onBreadcrumbClick 
}, ref) => {
  // Adobe PDF Embed API integration with event handling
  // Text selection detection and context extraction
  // Progressive disclosure UI patterns
  // Real-time search result highlighting
});
```

### Synapse Panel
**Location**: `src/components/SynapsePanel.jsx`

**Purpose**: The intelligent right sidebar providing AI-powered document connections and insights

**Key Features**:
- **Tabbed Interface**: Clean separation between Connections and Insights
- **Live Search Results**: Real-time display of semantically related document sections
- **Snippet Navigation**: Click-to-jump functionality for cross-document navigation
- **AI Insights Generation**: Context-aware analysis with structured display
- **Audio Player Integration**: Podcast-style content playback with controls

**Implementation Highlights**:
```jsx
const SynapsePanel = forwardRef(({ 
  contextInfo, 
  onConnectionSelect,
  onInsightsGenerated 
}, ref) => {
  // Tabbed interface with state management
  // Real-time semantic search integration
  // Structured insights display
  // Audio content generation and playback
});
```

### Flow Status Bar
**Location**: `src/components/FlowStatusBar.jsx`

**Purpose**: Visual workflow tracking showing user progress through the document analysis flow

**Key Features**:
- **Progressive Indicators**: Clear visual representation of completed, active, and pending steps
- **Dynamic Updates**: Real-time status changes based on user actions
- **Contextual Tooltips**: Informative hover states explaining each workflow step
- **Responsive Design**: Adapts to different screen sizes and orientations

**Implementation Highlights**:
```jsx
const FlowStatusBar = ({ 
  document, 
  connectionsCount, 
  hasInsights, 
  isLoadingConnections 
}) => {
  // Dynamic step calculation based on user progress
  // Professional UI/UX with clear visual hierarchy
  // Responsive tooltip positioning
};
```

### Knowledge Graph Modal
**Location**: `src/components/KnowledgeGraphModal.jsx`

**Purpose**: Interactive visualization of document relationships using force-directed graphs

**Key Features**:
- **Force-Directed Layout**: Dynamic graph positioning using D3.js physics simulation
- **Interactive Navigation**: Click, hover, and zoom interactions for graph exploration
- **Document Highlighting**: Visual emphasis of currently selected document
- **Relationship Visualization**: Edge weights representing semantic similarity strength
- **Professional Styling**: Clean, modern graph aesthetics with smooth animations

**Implementation Highlights**:
```jsx
const KnowledgeGraphModal = ({ 
  isVisible, 
  onDocumentSelect,
  currentDocumentId 
}) => {
  // Force-directed graph with react-force-graph-2d
  // Interactive node and edge highlighting
  // Dynamic data fetching and graph updates
  // Professional graph styling and animations
};
```

### Document Library
**Location**: `src/components/DocumentLibrary.jsx`

**Purpose**: Document management interface with upload, organization, and status tracking

**Key Features**:
- **Bulk Upload Support**: Multi-file selection with drag-and-drop functionality
- **Processing Status**: Real-time updates on document processing progress
- **Library Management**: Document organization, deletion, and metadata display
- **Search Integration**: Quick filtering and search within the document library

## User Experience Features

### Progressive Disclosure
The interface implements progressive disclosure patterns to maintain focus while providing access to advanced features:

- **Context Lens**: Information appears contextually based on user selections
- **Action Halo**: Actions reveal themselves when relevant
- **Tabbed Interfaces**: Complex information organized into digestible sections

### Real-time Interactions
All user interactions provide immediate feedback:

- **Instant Search**: Sub-second response times for semantic queries
- **Live Updates**: Real-time status changes and progress indicators
- **Smooth Animations**: Professional transitions and state changes

### Accessibility
The application follows modern accessibility standards:

- **Keyboard Navigation**: Full functionality available via keyboard
- **Screen Reader Support**: Semantic HTML and ARIA attributes
- **High Contrast**: Professional color schemes with sufficient contrast ratios

## State Management

### Session-Based Architecture
```javascript
// Session Management
const sessionService = {
  generateSessionId: () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  getUserId: () => localStorage.getItem('synapse_user_id'),
  getSessionId: () => sessionStorage.getItem('synapse_session_id'),
  clearSession: () => { /* Session cleanup logic */ }
};
```

### Component State Patterns
```javascript
// Local State Management
const [documentState, setDocumentState] = useState({
  currentDocument: null,
  isLoading: false,
  searchResults: [],
  currentContext: null
});

// Effect-based State Synchronization
useEffect(() => {
  if (currentContext && currentContext !== previousContext) {
    handleContextChange(currentContext);
  }
}, [currentContext, previousContext]);
```

### Persistent Storage Strategy
- **Session Storage**: Temporary data for current browsing session
- **Local Storage**: User preferences and persistent identifiers
- **Memory State**: Real-time application state and UI interactions

## API Integration

### HTTP Client Configuration
```javascript
// API Client with Session Management
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor for Session Isolation
api.interceptors.request.use((config) => {
  const sessionId = getSessionId();
  config.headers['X-Session-ID'] = sessionId;
  return config;
});
```

### API Service Modules

#### Document API
```javascript
export const documentAPI = {
  upload: async (file, onUploadProgress) => {
    // Multi-part form upload with progress tracking
  },
  bulkUpload: async (files, onProgress) => {
    // Batch upload with individual file tracking
  },
  getAll: async () => {
    // Retrieve user's document library
  },
  delete: async (documentId) => {
    // Safe document deletion with cleanup
  }
};
```

#### Search API
```javascript
export const searchAPI = {
  semantic: async (queryText, options) => {
    // Semantic search with vector similarity
  },
  contextual: async (text, context, options) => {
    // Context-aware search with enhanced relevance
  }
};
```

#### Insights API
```javascript
export const insightsAPI = {
  generate: async (text, context) => {
    // AI-powered insights generation
  },
  getHistory: async () => {
    // Retrieve previous insights for context
  }
};
```

#### Podcast API
```javascript
export const podcastAPI = {
  generate: async (content, options) => {
    // Multi-speaker audio generation
  },
  getStatus: async (jobId) => {
    // Check audio generation progress
  }
};
```

## Development Setup

### Prerequisites
- Node.js 18+ with npm 9+
- Modern browser with ES2022 support
- Adobe PDF Embed API credentials (optional)

### Local Development

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env.local
   # Add your environment variables
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Access Application**
   - Development: http://localhost:5173
   - Backend API: http://localhost:8080

### Build and Deployment

```bash
# Production Build
npm run build

# Preview Production Build
npm run preview

# Docker Build (Multi-stage)
docker build -t synapse-frontend .

# Deploy to Cloud Run (via Cloud Build)
gcloud builds submit --config cloudbuild.yaml
```

## Component Documentation

### Component Hierarchy
```
App
├── DocumentLibrary
│   ├── UploadForm
│   └── QuickStartGuide
├── DocumentWorkbench
│   └── AdobeViewer (embedded)
├── SynapsePanel
│   ├── ConnectionsTab
│   └── InsightsTab
├── FlowStatusBar
└── KnowledgeGraphModal
    └── ForceGraph2D (third-party)
```

### Props Interface Patterns
```javascript
// Standard Component Props Pattern
interface ComponentProps {
  // Data Props
  data: DataType;
  isLoading: boolean;
  error: ErrorType | null;
  
  // Callback Props
  onAction: (param: ParamType) => void;
  onStateChange: (newState: StateType) => void;
  
  // Configuration Props
  options: ConfigType;
  className?: string;
}
```

### Event Handling Patterns
```javascript
// Debounced Search Input
const debouncedSearch = useCallback(
  debounce((query) => {
    if (query.length >= 3) {
      performSearch(query);
    }
  }, 300),
  [performSearch]
);

// Optimistic UI Updates
const handleDocumentUpload = async (file) => {
  // Immediate UI feedback
  setDocuments(prev => [...prev, optimisticDocument]);
  
  try {
    const result = await documentAPI.upload(file);
    // Update with real data
    setDocuments(prev => prev.map(doc => 
      doc.id === optimisticDocument.id ? result : doc
    ));
  } catch (error) {
    // Rollback on error
    setDocuments(prev => prev.filter(doc => doc.id !== optimisticDocument.id));
    showError(error);
  }
};
```

## Performance Optimization

### Code Splitting
```javascript
// Route-based Code Splitting
const KnowledgeGraphModal = lazy(() => import('./components/KnowledgeGraphModal'));

// Component-based Lazy Loading
const LazyComponent = forwardRef((props, ref) => (
  <Suspense fallback={<LoadingSpinner />}>
    <KnowledgeGraphModal {...props} ref={ref} />
  </Suspense>
));
```

### Memoization Strategies
```javascript
// Expensive Computation Memoization
const processedResults = useMemo(() => {
  return searchResults.map(result => ({
    ...result,
    cleanedText: cleanTextForDisplay(result.text),
    relevanceScore: calculateRelevance(result, currentContext)
  }));
}, [searchResults, currentContext]);

// Callback Memoization
const handleConnectionSelect = useCallback((connection) => {
  setSelectedConnection(connection);
  onConnectionSelect?.(connection);
}, [onConnectionSelect]);
```

### Bundle Optimization
- **Tree Shaking**: Automatic removal of unused code
- **Code Splitting**: Route and component-based chunking
- **Asset Optimization**: Image compression and lazy loading
- **Dependency Analysis**: Regular audit of bundle size

### Performance Metrics
| Metric | Target | Implementation |
|--------|--------|----------------|
| **First Contentful Paint** | < 1.5s | Code splitting, asset optimization |
| **Largest Contentful Paint** | < 2.5s | Lazy loading, image optimization |
| **Cumulative Layout Shift** | < 0.1 | Skeleton loading, fixed dimensions |
| **Time to Interactive** | < 3.5s | Progressive enhancement, service workers |

---

**UI/UX Excellence**: Progressive disclosure with Context Lens | **Performance**: Sub-second interactions | **Innovation**: Real-time semantic connections with Adobe PDF Embed API
