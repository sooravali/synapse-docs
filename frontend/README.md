# Synapse-Docs Frontend

React-based frontend application providing an intelligent document viewing experience with AI-powered connections and insights.

## Table of Contents

| #   | Section                                                      |
| --- | ------------------------------------------------------------ |
| 1   | [Overview](#overview)                                        |
| 2   | [Architecture](#architecture)                                |
| 3   | [Technology Stack](#technology-stack)                        |
| 4   | [Component Structure](#component-structure)                  |
| 5   | [Key Features](#key-features)                                |
| 6   | [User Interface Design](#user-interface-design)              |
| 7   | [State Management](#state-management)                        |
| 8   | [API Integration](#api-integration)                          |
| 9   | [Setup & Development](#setup--development)                   |
| 10  | [Build & Deployment](#build--deployment)                     |
| 11  | [Performance](#performance)                                  |
| 12  | [Browser Compatibility](#browser-compatibility)              |

## Overview

The Synapse-Docs frontend is a modern React application that implements an innovative three-panel "Cockpit" design for intelligent document interaction. It provides high-fidelity PDF viewing, real-time semantic search, AI-powered insights, and interactive knowledge graph visualization, all optimized for seamless user experience.

## Architecture

### Three-Panel Cockpit Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Synapse-Docs Interface                       │
├─────────────┬─────────────────────────┬─────────────────────────────┤
│  Workspace  │       Workbench         │          Synapse            │
│ (Left Panel)│    (Center Panel)       │       (Right Panel)         │
├─────────────┼─────────────────────────┼─────────────────────────────┤
│             │                         │                             │
│ Document    │ PDF Viewer with         │ Connections & Insights      │
│ Library     │ Interactive Features    │                             │
│             │                         │                             │
│ • Upload    │ • Adobe PDF Embed API   │ • Related Text Snippets     │
│ • Browse    │ • Text Selection        │ • AI-Generated Insights     │
│ • Manage    │ • Context Lens          │ • Audio Podcast Player      │
│ • Search    │ • Action Halo           │ • Knowledge Graph Modal     │
│             │ • Breadcrumb Trail      │ • Cross-Document Navigation │
│             │ • Page Navigation       │                             │
└─────────────┴─────────────────────────┴─────────────────────────────┘
```

### Component Hierarchy

```
App
├── QuickStartGuide
├── DocumentLibrary (Workspace)
│   ├── UploadForm
│   └── SearchResults
├── DocumentWorkbench (Workbench)
│   ├── AdobeViewer
│   ├── FlowStatusBar
│   └── IconRail
├── SynapsePanel (Synapse)
│   └── KnowledgeGraphModal
└── KnowledgeGraphModal
```

## Technology Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Frontend Framework** | React | 18.2.0 | Component-based UI development |
| **Build Tool** | Vite | 5.0.8 | Fast development and optimized builds |
| **HTTP Client** | Axios | 1.6.0 | API communication |
| **Icons** | Lucide React | 0.539.0 | Consistent icon system |
| **Graph Visualization** | React Force Graph 2D | 1.28.0 | Interactive knowledge graphs |
| **PDF Rendering** | Adobe PDF Embed API | Latest | High-fidelity PDF viewing |
| **Styling** | CSS3 + CSS Modules | - | Component-scoped styling |
| **State Management** | React Hooks + Context | - | Application state management |

## Component Structure

### DocumentLibrary Component
**File**: `src/components/DocumentLibrary.jsx`

The left panel workspace for document management:

**Features**:
- Multi-file PDF upload with drag-and-drop
- Document library with search and filtering
- Real-time upload progress tracking
- Document metadata display
- Session-based document isolation

**Key Capabilities**:
- Bulk document upload processing
- Document preview thumbnails
- Advanced search across document titles
- Document deletion and management
- Upload status monitoring

### DocumentWorkbench Component
**File**: `src/components/DocumentWorkbench.jsx`

The center panel PDF viewing experience:

**Adobe PDF Embed Integration**:
- High-fidelity PDF rendering with zoom and pan
- Text selection detection and highlighting
- Page navigation and bookmarking
- Mobile-responsive viewing experience

**Interactive Features**:
- **Context Lens**: Real-time text selection feedback
- **Action Halo**: Progressive disclosure of AI features
- **Breadcrumb Trail**: Navigation history tracking
- **Flow Status Bar**: Processing state indication

**Text Selection Workflow**:
1. User selects text in PDF viewer
2. Context Lens provides immediate visual feedback
3. Action Halo appears with available actions
4. Background semantic search triggers automatically
5. Related content updates in Synapse panel

### SynapsePanel Component
**File**: `src/components/SynapsePanel.jsx`

The right panel for connections and insights:

**Tabbed Interface**:
- **Connections Tab**: Related content from document library
- **Insights Tab**: AI-generated analysis and takeaways
- **Audio Tab**: Podcast player for generated audio content

**Advanced Features**:
- Real-time connection discovery
- Contextual insight generation
- Multi-speaker audio podcast playback
- Cross-document navigation
- Knowledge graph integration

**User Experience Flow**:
1. Automatic connection discovery on text selection
2. One-click insight generation with loading states
3. Audio podcast creation with speaker selection
4. Interactive snippet navigation to source documents

### KnowledgeGraphModal Component
**File**: `src/components/KnowledgeGraphModal.jsx`

Interactive document relationship visualization:

**Graph Features**:
- Force-directed layout with document nodes
- Similarity-based edge connections
- Interactive zoom, pan, and selection
- Real-time graph updates
- Professional styling and animations

**Interaction Capabilities**:
- Node hover for document details
- Click navigation to specific documents
- Graph filtering and search
- Export and sharing functionality

### FlowStatusBar Component
**File**: `src/components/FlowStatusBar.jsx`

Status communication system:

**Status Types**:
- Document processing progress
- Search operation feedback
- AI generation status
- Error handling and recovery

**Visual Design**:
- Minimalist progress indicators
- Non-intrusive notifications
- Color-coded status levels
- Animated state transitions

### IconRail Component
**File**: `src/components/IconRail.jsx`

Context-sensitive action interface:

**Dynamic Actions**:
- Text selection dependent visibility
- Progressive feature disclosure
- Accessibility-compliant controls
- Responsive design adaptation

## Key Features

### Intelligent Text Selection
- **Real-time Detection**: Instant response to PDF text selection
- **Context Analysis**: Semantic understanding of selected content
- **Visual Feedback**: Context Lens for immediate user confirmation
- **Action Discovery**: Progressive disclosure of available features

### Semantic Connections
- **Automatic Discovery**: Background search for related content
- **Cross-Document Linking**: Connections across entire document library
- **Relevance Scoring**: Intelligent ranking of related snippets
- **Navigation Integration**: One-click navigation to source content

### AI-Powered Insights
- **Contextual Analysis**: LLM-generated insights based on selection
- **Multi-Type Insights**: Takeaways, contradictions, examples, connections
- **Rich Formatting**: Structured presentation of AI-generated content
- **Source Attribution**: Clear linking back to source documents

### Audio Podcast Generation
- **Multi-Speaker Support**: Conversational podcast format
- **Context Integration**: Audio based on selected text and connections
- **Professional Quality**: Azure TTS with natural speech patterns
- **Interactive Player**: Full playback controls with seek functionality

### Breadcrumb Navigation
- **Trail Tracking**: Automatic recording of user navigation path
- **Context Preservation**: Maintains selection context for each trail item
- **One-Click Return**: Easy navigation back to previous locations
- **Visual Timeline**: Clear presentation of exploration history

### Knowledge Graph Visualization
- **Document Relationships**: Visual representation of semantic connections
- **Interactive Exploration**: Zoom, pan, and click navigation
- **Force-Directed Layout**: Automatic positioning based on relationships
- **Real-Time Updates**: Dynamic graph updates as library grows

## User Interface Design

### Design Principles
- **Minimalist Aesthetics**: Clean, professional interface
- **Progressive Disclosure**: Features revealed as needed
- **Contextual Interactions**: Actions appear based on user context
- **Responsive Design**: Optimized for desktop and tablet viewing

### Color Scheme
- **Primary**: Professional blue (#2563eb)
- **Accent**: Highlight orange (#f59e0b)
- **Success**: Green (#10b981)
- **Warning**: Amber (#f59e0b)
- **Error**: Red (#ef4444)
- **Neutral**: Gray scale (#64748b)

### Typography
- **Primary Font**: System font stack for optimal readability
- **Heading Hierarchy**: Clear visual hierarchy with appropriate sizing
- **Reading Optimization**: High contrast ratios for accessibility

### Layout System
- **Three-Panel Grid**: Fixed layout with resizable panels
- **Responsive Breakpoints**: Optimized for 1024px+ desktop viewing
- **Panel Collapse**: Individual panel hiding for focused work
- **Full-Screen Modes**: Document-focused viewing options

## State Management

### Application State Architecture

```javascript
// Global App State
{
  documents: [],
  selectedDocument: null,
  currentContext: '',
  searchResults: [],
  connectionResults: [],
  breadcrumbTrail: [],
  uiState: {
    isLoading: false,
    showQuickStart: false,
    panelStates: {}
  }
}
```

### State Management Patterns
- **React Hooks**: useState, useEffect, useRef for component state
- **Context API**: Shared state across component tree
- **Custom Hooks**: Reusable state logic extraction
- **Prop Drilling**: Controlled data flow for performance

### Data Flow Architecture
```
User Interaction → Component Event → State Update → API Call → Response Handler → UI Update
```

## API Integration

### API Client Structure
**File**: `src/api/index.js`

```javascript
// Modular API organization
export const documentAPI = {
  upload: (file, sessionId) => {},
  list: (sessionId) => {},
  delete: (id, sessionId) => {}
};

export const searchAPI = {
  semantic: (query, sessionId) => {},
  connections: (text, sessionId) => {}
};

export const insightsAPI = {
  generate: (text, context, sessionId) => {},
  podcast: (content, sessionId) => {}
};
```

### Error Handling Strategy
- **Graceful Degradation**: Fallback UI states for API failures
- **Retry Logic**: Automatic retry for transient failures
- **User Feedback**: Clear error messages and recovery options
- **Offline Support**: Basic functionality during connectivity issues

### Session Management
- **Automatic Generation**: UUID-based session identifiers
- **Persistent Storage**: Local storage for session continuity
- **Isolation**: Complete user data separation
- **Cleanup**: Automatic session cleanup on browser close

## Setup & Development

### Prerequisites
- Node.js 18+ with npm package manager
- Modern web browser with ES6+ support
- Development server for API backend

### Installation

```bash
# Clone repository
git clone https://github.com/sooravali/synapse-docs.git
cd synapse-docs/frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Access application
open http://localhost:5173
```

### Development Scripts

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Code linting
npm run lint

# Dependency audit
npm audit
```

### Environment Configuration

```bash
# .env.local file
VITE_API_BASE_URL=http://localhost:8000
VITE_ADOBE_EMBED_API_KEY=your_adobe_key
VITE_ENABLE_MOCK_DATA=false
```

## Build & Deployment

### Production Build

```bash
# Optimized production build
npm run build

# Output directory: dist/
# Static assets optimized and minified
# Source maps generated for debugging
```

### Docker Integration

```dockerfile
# Multi-stage build for optimization
FROM node:18-alpine AS frontend
WORKDIR /frontend
COPY package*.json ./
RUN npm ci --silent
COPY . ./
RUN npm run build
```

### Performance Optimizations
- **Code Splitting**: Dynamic imports for large components
- **Bundle Analysis**: Webpack bundle analyzer integration
- **Asset Optimization**: Image compression and lazy loading
- **Caching Strategy**: Aggressive caching for static assets

## Performance

### Core Web Vitals Targets

| Metric | Target | Current |
|--------|--------|---------|
| **First Contentful Paint** | < 1.5s | ~1.2s |
| **Largest Contentful Paint** | < 2.5s | ~2.1s |
| **Cumulative Layout Shift** | < 0.1 | ~0.05 |
| **Time to Interactive** | < 3.5s | ~2.8s |

### Optimization Strategies
- **React.memo**: Component memoization for expensive renders
- **useMemo/useCallback**: Hook memoization for performance
- **Virtual Scrolling**: Efficient rendering of large lists
- **Debounced Search**: Reduced API calls for real-time search

### Bundle Size Analysis
- **Main Bundle**: ~150KB gzipped
- **Vendor Bundle**: ~200KB gzipped
- **Total Initial Load**: ~350KB gzipped
- **Lazy Loaded**: ~100KB additional for advanced features

## Browser Compatibility

### Supported Browsers
- **Chrome**: 90+ (Primary development target)
- **Firefox**: 88+ (Full feature support)
- **Safari**: 14+ (WebKit compatibility)
- **Edge**: 90+ (Chromium-based)

### Feature Detection
- **Progressive Enhancement**: Core functionality works without advanced features
- **Polyfill Strategy**: Automatic polyfill injection for older browsers
- **Graceful Degradation**: Fallback UI for unsupported features

### Adobe PDF Embed API Requirements
- Modern browser with JavaScript enabled
- Third-party cookies allowed for Adobe services
- Minimum viewport width of 768px for optimal experience

---

**Development Server**: Available at `http://localhost:5173` during development  
**Production Build**: Optimized static assets in `dist/` directory  
**API Integration**: Configured for backend at `http://localhost:8000`
