/**
 * Left Panel: The Knowledge Base
 * 
 * Implements the user's personal library with bulk upload capabilities,
 * status indicators, and library search functionality.
 */
import { useState, useEffect } from 'react';
import { documentAPI } from '../api';
import { Upload, Search, CheckCircle, AlertCircle, Clock, FileText, Trash2 } from 'lucide-react';
import FlowStatusBar from './FlowStatusBar';
import './DocumentLibrary.css';

const DocumentLibrary = ({ 
  documents, 
  onDocumentSelect, 
  selectedDocument, 
  onDocumentsUpdate,
  connectionsCount,
  hasInsights,
  isLoadingConnections,
  currentContext
}) => {
  const [uploadProgress, setUploadProgress] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [filteredDocuments, setFilteredDocuments] = useState(documents);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Helper function to clean filename display
  const cleanFileName = (fileName) => {
    if (!fileName) return '';
    return fileName.replace(/^doc_\d+_/, '').replace(/\.pdf$/, '');
  };

  // Filter documents based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredDocuments(documents);
    } else {
      const filtered = documents.filter(doc => {
        // Search against the cleaned filename (what users see) instead of raw filename
        const cleanedName = cleanFileName(doc.file_name);
        return cleanedName.toLowerCase().includes(searchTerm.toLowerCase());
      });
      setFilteredDocuments(filtered);
    }
  }, [documents, searchTerm]);

  // Poll for status updates when documents are processing
  useEffect(() => {
    const processingDocs = documents.filter(doc => doc.status === 'processing');
    
    if (processingDocs.length > 0 && !isPolling) {
      setIsPolling(true);
      console.log(`📊 Found ${processingDocs.length} documents still processing, starting status polling...`);
      
      const pollInterval = setInterval(async () => {
        try {
          console.log('🔄 Polling for document status updates...');
          await onDocumentsUpdate();
          
          // Check if any documents are still processing
          const stillProcessing = documents.filter(doc => doc.status === 'processing');
          if (stillProcessing.length === 0) {
            console.log('✅ All documents processing completed, stopping poll');
            clearInterval(pollInterval);
            setIsPolling(false);
          }
        } catch (error) {
          console.error('❌ Error during status polling:', error);
        }
      }, 3000); // Poll every 3 seconds

      // Auto-stop polling after 5 minutes to prevent infinite polling
      const maxPollTime = setTimeout(() => {
        console.log('⏰ Maximum polling time reached, stopping poll');
        clearInterval(pollInterval);
        setIsPolling(false);
      }, 300000); // 5 minutes

      return () => {
        clearInterval(pollInterval);
        clearTimeout(maxPollTime);
        setIsPolling(false);
      };
    } else if (processingDocs.length === 0 && isPolling) {
      setIsPolling(false);
    }
  }, [documents, isPolling, onDocumentsUpdate]);

  const handleFileUpload = async (files) => {
    const fileArray = Array.from(files);
    
    // Initialize progress tracking
    const progressTracker = {};
    fileArray.forEach((file, index) => {
      progressTracker[`upload_${index}`] = {
        name: file.name,
        status: 'uploading',
        progress: 0
      };
    });
    setUploadProgress(progressTracker);

    try {
      // Upload files
      const response = await documentAPI.uploadMultiple(fileArray);
      
      // Update progress to processing
      Object.keys(progressTracker).forEach(key => {
        progressTracker[key] = {
          ...progressTracker[key],
          status: 'processing',
          progress: 50
        };
      });
      setUploadProgress({ ...progressTracker });

      // Small delay to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh document list after ensuring DB is updated
      console.log('🔄 Refreshing document list after upload...');
      await onDocumentsUpdate();
      console.log('✅ Document list refreshed, checking status...');
      
      // Note: Documents will start as "processing" - polling effect will handle status updates
      
      // Clear progress after successful upload
      setTimeout(() => {
        setUploadProgress({});
      }, 2000);

    } catch (error) {
      console.error('Upload failed:', error);
      
      // Update progress to error
      Object.keys(progressTracker).forEach(key => {
        progressTracker[key] = {
          ...progressTracker[key],
          status: 'error',
          progress: 100
        };
      });
      setUploadProgress({ ...progressTracker });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="status-icon status-ready" size={16} />;
      case 'processing':
        return <Clock className="status-icon status-processing animate-spin" size={16} />;
      case 'error':
        return <AlertCircle className="status-icon status-error" size={16} />;
      default:
        return <Clock className="status-icon status-processing" size={16} />;
    }
  };

  const getStatusText = (doc) => {
    if (doc.status === 'ready') {
      return `${doc.total_chunks || 0} chunks indexed • Ready to explore!`;
    }
    if (doc.status === 'processing') {
      return isPolling ? 'Processing (auto-updating...)' : 'Processing...';
    }
    if (doc.status === 'error') {
      return doc.error_message ? `Error: ${doc.error_message}` : 'Error occurred during processing';
    }
    // Fallback for any unknown status
    return `Status: ${doc.status}`;
  };

  const handleClearAll = async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }

    setIsClearingAll(true);
    setShowClearConfirm(false);
    
    try {
      console.log('🗑️ Starting clear all documents operation...');
      
      const result = await documentAPI.clearAll();
      console.log('✅ Clear all completed:', result);
      
      // Refresh the document list
      onDocumentsUpdate();
      
      // Clear any selected document
      onDocumentSelect(null);
      
      // Clear connections cache if available (will reset on next search)
      if (window.localStorage) {
        window.localStorage.removeItem('synapse_connections_cache');
      }
      
      alert(`Successfully cleared ${result.deleted_count} documents and reset the library!`);
      
    } catch (error) {
      console.error('❌ Failed to clear all documents:', error);
      alert('Failed to clear documents. Please try again.');
    } finally {
      setIsClearingAll(false);
    }
  };

  const cancelClearAll = () => {
    setShowClearConfirm(false);
  };

  return (
    <div className="document-library">
      {/* Flow Status Bar */}
      <FlowStatusBar 
        document={selectedDocument}
        connectionsCount={connectionsCount}
        hasInsights={hasInsights}
        isLoadingConnections={isLoadingConnections}
        currentContext={currentContext}
      />
      
      <div className="library-header">
        <div className="library-title-section">
          <h2 className="library-title">
            <FileText size={20} />
            My Library
          </h2>
          
          {/* Clear All Button */}
          {documents.length > 0 && (
            <div className="clear-all-section">
              {!showClearConfirm ? (
                <button
                  onClick={handleClearAll}
                  disabled={isClearingAll}
                  className="clear-all-button"
                  title="Clear all documents and start fresh"
                >
                  <Trash2 size={16} />
                  {isClearingAll ? 'Clearing...' : 'Clear All'}
                </button>
              ) : (
                <div className="clear-confirm">
                  <span className="confirm-text">Delete all {documents.length} documents?</span>
                  <button onClick={handleClearAll} className="confirm-yes">Yes</button>
                  <button onClick={cancelClearAll} className="confirm-no">No</button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Library Search */}
        <div className="library-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Filter documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Bulk Upload Area */}
      <div 
        className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload size={24} className="upload-icon" />
        <div className="upload-text">
          <strong>Upload Documents</strong>
          <span>Drag & drop PDFs here or click to browse</span>
        </div>
        <input
          type="file"
          multiple
          accept=".pdf"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="file-input"
        />
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="upload-progress">
          {Object.entries(uploadProgress).map(([key, progress]) => (
            <div key={key} className="progress-item">
              <div className="progress-info">
                <span className="progress-name">{progress.name}</span>
                <span className="progress-status">{progress.status}</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document List */}
      <div className="document-list">
        {filteredDocuments.length === 0 ? (
          <div className="empty-state">
            {documents.length === 0 ? (
              <div className="getting-started">
                <div className="welcome-content">
                  <h3>Welcome to Synapse</h3>
                  <p>Upload your first PDF to start discovering connections and generating insights across your documents.</p>
                  <div className="next-steps">
                    <div className="step">
                      <span className="step-number">1</span>
                      <span>Upload PDFs using the area above</span>
                    </div>
                    <div className="step">
                      <span className="step-number">2</span>
                      <span>Select a document to view it</span>
                    </div>
                    <div className="step">
                      <span className="step-number">3</span>
                      <span>Scroll to discover related content</span>
                    </div>
                    <div className="step">
                      <span className="step-number">4</span>
                      <span>Select text for AI insights</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-matches">
                <p>No documents match your search.</p>
                <button onClick={() => setSearchTerm('')} className="clear-search-btn">
                  Clear search
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className={`document-item ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
              onClick={() => onDocumentSelect(doc)}
            >
              <div className="document-info">
                <div className="document-name">{cleanFileName(doc.file_name)}</div>
                <div className="document-meta">
                  {getStatusIcon(doc.status)}
                  <span className="document-status">{getStatusText(doc)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DocumentLibrary;
