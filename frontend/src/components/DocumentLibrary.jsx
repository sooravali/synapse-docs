/**
 * Left Panel: The Knowledge Base
 * 
 * Implements the user's personal library with bulk upload capabilities,
 * status indicators, and library search functionality.
 */
import { useState, useEffect } from 'react';
import { documentAPI } from '../api';
import { Upload, Search, CheckCircle, AlertCircle, Clock, FileText, Trash2 } from 'lucide-react';
import './DocumentLibrary.css';

const DocumentLibrary = ({ documents, onDocumentSelect, selectedDocument, onDocumentsUpdate }) => {
  const [uploadProgress, setUploadProgress] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [filteredDocuments, setFilteredDocuments] = useState(documents);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Filter documents based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredDocuments(documents);
    } else {
      const filtered = documents.filter(doc => 
        doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDocuments(filtered);
    }
  }, [documents, searchTerm]);

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

      // Refresh document list
      await onDocumentsUpdate();
      
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
      return `${doc.total_chunks || 0} chunks indexed`;
    }
    return doc.status.charAt(0).toUpperCase() + doc.status.slice(1);
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
              <p>No documents uploaded yet. Start by uploading some PDFs!</p>
            ) : (
              <p>No documents match your search.</p>
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
                <div className="document-name">{doc.file_name}</div>
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
