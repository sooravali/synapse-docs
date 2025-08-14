# Synapse Docs Frontend

A sophisticated React frontend application for document management with AI-powered semantic search and Adobe PDF viewing capabilities.

##  Features

### Core Functionality
- **Document Upload**: Drag-and-drop interface with progress tracking
- **AI-Powered Search**: Semantic search across document content
- **Adobe PDF Integration**: Advanced PDF viewing with programmatic navigation
- **Interactive Loop**: Click search results to jump to exact PDF pages
- **Two-Panel Layout**: Optimized for productivity and user experience

### Technical Highlights
- **React 18** with modern hooks and patterns
- **Vite** for fast development and optimized builds
- **Adobe PDF Embed API** with sophisticated integration
- **Responsive Design** with mobile-first approach
- **Accessibility** features and keyboard navigation
- **Error Boundaries** and graceful degradation

##  Project Structure

```
frontend/
├── public/
│   └── index.html              # HTML template
├── src/
│   ├── components/             # React components
│   │   ├── AdobeViewer.jsx    # PDF viewer with Adobe SDK
│   │   ├── UploadForm.jsx     # File upload interface
│   │   └── SearchResults.jsx   # Search results display
│   ├── utils/
│   │   └── api.js             # API client functions
│   ├── App.jsx                # Main application component
│   ├── App.css                # Application styles
│   ├── main.jsx               # React entry point
│   └── index.css              # Global styles
├── package.json               # Dependencies and scripts
├── vite.config.js            # Vite configuration
└── README.md                 # This file
```

##  Installation

### Prerequisites
- Node.js 18+ and npm
- Adobe PDF Embed API Client ID (see [Adobe Setup Guide](../ADOBE_SETUP.md))

### Setup Steps

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure Environment**
   ```bash
   # Create .env file
   echo "VITE_ADOBE_CLIENT_ID=your_client_id_here" > .env
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   - Navigate to `http://localhost:3000`
   - The application should load with the two-panel interface

##  Usage Guide

### Document Upload
1. **Drag and Drop**: Drag PDF files onto the upload area
2. **Browse Files**: Click to open file picker dialog
3. **Progress Tracking**: Monitor upload progress with visual indicators
4. **Status Updates**: See real-time processing status

### Document Search
1. **Enter Query**: Type search terms in the search input
2. **Execute Search**: Click search button or press Enter
3. **View Results**: Browse highlighted search results with similarity scores
4. **Navigate to Page**: Click results to jump to exact PDF page

### PDF Viewing
1. **Document Selection**: Click documents in the left panel to view
2. **Adobe Features**: Full PDF viewing capabilities including zoom, navigation
3. **Search Integration**: Automatic page jumping from search results
4. **Page Management**: Programmatic navigation via search results

##  Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Type checking (if using TypeScript)
npm run type-check
```

### Component Architecture

#### AdobeViewer.jsx
**Purpose**: Sophisticated Adobe PDF Embed API integration
- Dynamic SDK loading with error handling
- Programmatic navigation via `useImperativeHandle`
- Search highlighting and page jumping
- Responsive viewer configuration

```jsx
// Usage example
<AdobeViewer
  ref={viewerRef}
  clientId={import.meta.env.VITE_ADOBE_CLIENT_ID}
  fileUrl="/api/documents/123/content"
  fileName="document.pdf"
  onReady={() => console.log('Viewer ready')}
  onError={(error) => console.error('Viewer error:', error)}
/>
```

#### UploadForm.jsx
**Purpose**: Enhanced file upload interface
- Drag-and-drop with visual feedback
- Progress tracking and status updates
- File validation and error handling
- Accessibility features

```jsx
// Usage example
<UploadForm
  onUpload={(files) => handleFileUpload(files)}
  onProgress={(progress) => setUploadProgress(progress)}
  onError={(error) => handleUploadError(error)}
  accept=".pdf"
  maxSize={50 * 1024 * 1024} // 50MB
/>
```

#### SearchResults.jsx
**Purpose**: Rich search results display
- Query term highlighting
- Similarity score visualization
- Click handlers for PDF navigation
- Empty state and loading management

```jsx
// Usage example
<SearchResults
  results={searchResults}
  query={searchQuery}
  onResultClick={(result) => navigateToPage(result)}
  isLoading={isSearching}
/>
```

### State Management

The application uses React's built-in state management:

```jsx
// Main application state
const [documents, setDocuments] = useState([]);
const [currentDocument, setCurrentDocument] = useState(null);
const [searchResults, setSearchResults] = useState([]);
const [searchQuery, setSearchQuery] = useState('');
const [isSearching, setIsSearching] = useState(false);
```

### API Integration

The frontend communicates with the backend through a RESTful API:

```javascript
// API endpoints
const API_BASE = 'http://localhost:8000';

// Document operations
await uploadDocument(file);
await getDocuments();
await getDocumentContent(documentId);

// Search operations
await searchDocuments(query);
```

##  Styling

### CSS Architecture
- **Component-scoped styles** in App.css
- **CSS Custom Properties** for consistent theming
- **Responsive design** with mobile-first approach
- **Accessibility** considerations throughout

### Design System
- **Colors**: Professional blue and gray palette
- **Typography**: System fonts with proper hierarchy
- **Spacing**: Consistent 8px grid system
- **Shadows**: Subtle elevation for depth

### Responsive Breakpoints
```css
/* Mobile-first approach */
@media (max-width: 768px) {
  /* Mobile styles */
}

@media (min-width: 769px) {
  /* Desktop styles */
}
```

##  Security

### Environment Variables
- Adobe Client ID is safe to expose (client-side)
- No sensitive secrets in frontend code
- Domain restrictions enforced by Adobe

### Best Practices
- Input validation on file uploads
- XSS protection via React's built-in escaping
- CORS configuration handled by backend
- Error messages don't expose sensitive information

##  Testing

### Manual Testing Checklist
- [ ] File upload works with drag-and-drop
- [ ] Document list updates after upload
- [ ] Search returns relevant results
- [ ] Click search result navigates to correct PDF page
- [ ] Adobe viewer loads and displays PDFs correctly
- [ ] Responsive design works on mobile devices
- [ ] Error states display appropriate messages

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

##  Deployment

### Environment Configuration
```bash
# Production environment variables
VITE_ADOBE_CLIENT_ID=your_production_client_id
```

### Build and Deploy
```bash
# Build for production
npm run build

# Deploy dist/ folder to your hosting service
```

### Domain Configuration
Remember to update Adobe Developer Console with production domains.

##  Troubleshooting

### Common Issues

**Adobe Viewer Not Loading**
- Check Client ID is set correctly
- Verify domain is whitelisted in Adobe Console
- Check browser console for CORS errors

**Upload Failing**
- Verify backend server is running
- Check file size limits
- Ensure PDF file is valid

**Search Not Working**
- Confirm documents are processed (status: "ready")
- Check backend API is accessible
- Verify search endpoint is responding

### Debug Mode
Set `VITE_DEBUG=true` for additional logging.

##  Additional Resources

- [Adobe PDF Embed API Documentation](https://developer.adobe.com/document-services/docs/overview/pdf-embed-api/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Adobe Setup Guide](../ADOBE_SETUP.md)

##  Contributing

1. Follow React best practices
2. Maintain accessibility standards
3. Test on multiple browsers
4. Update documentation for new features
5. Follow the existing code style

##  License

This project is part of the Synapse Docs application. See the main project README for licensing information.

