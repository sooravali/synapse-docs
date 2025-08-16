/**
 * Left Panel: The Workspace
 * 
 * Implements the user's personal library with bulk upload capabilities,
 * status indicators, and library search functionality.
 */
import { useState, useEffect } from 'react';
import { documentAPI, sessionUtils } from '../api';
import { Upload, Search, CheckCircle, AlertCircle, Clock, FileText, Trash2, Info, MoreVertical, Download } from 'lucide-react';
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
  
  // Individual document deletion state
  const [deletingDocuments, setDeletingDocuments] = useState(new Set());
  const [openMenuId, setOpenMenuId] = useState(null);
  
  // Session-based state for "Recently Added" feature
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [knowledgeBaseDocuments, setKnowledgeBaseDocuments] = useState([]);
  
  // Tab state management for the new tabbed interface
  const [activeTab, setActiveTab] = useState('recent'); // Default to 'recent' or 'all' based on content

  // SessionStorage utilities for tracking new files in current session
  const SESSION_STORAGE_KEY = 'synapse_docs_newFileIDs';

  const getSessionNewFileIDs = () => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Error reading session storage:', error);
      return [];
    }
  };

  const addToSessionNewFiles = (documentId) => {
    try {
      const currentIDs = getSessionNewFileIDs();
      if (!currentIDs.includes(documentId)) {
        const updatedIDs = [...currentIDs, documentId];
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedIDs));
        console.log(`Added document ${documentId} to session new files:`, updatedIDs);
      }
    } catch (error) {
      console.warn('Error updating session storage:', error);
    }
  };

  const removeFromSessionNewFiles = (documentId) => {
    try {
      const currentIDs = getSessionNewFileIDs();
      const updatedIDs = currentIDs.filter(id => id !== documentId);
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedIDs));
      console.log(`Removed document ${documentId} from session new files:`, updatedIDs);
    } catch (error) {
      console.warn('Error updating session storage:', error);
    }
  };

  const getMostRecentSessionDocument = (documents) => {
    const sessionIDs = getSessionNewFileIDs();
    if (sessionIDs.length === 0) return null;
    
    // Get the most recently added ID (last in array)
    const mostRecentID = sessionIDs[sessionIDs.length - 1];
    return documents.find(doc => doc.id === mostRecentID) || null;
  };

  // Utility function to format dates in a user-friendly way
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return 'today';
      if (diffDays === 2) return 'yesterday';
      if (diffDays <= 7) return `${diffDays - 1} days ago`;
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    } catch (error) {
      return '';
    }
  };

  // Helper function to clean filename display
  const cleanFileName = (fileName) => {
    if (!fileName) return '';
    return fileName.replace(/^doc_\d+_/, '').replace(/\.pdf$/, '');
  };

  // Helper function to get upload progress for a specific document
  const getDocumentUploadProgress = (fileName) => {
    // Find upload progress entry that matches this document's filename
    const progressEntries = Object.entries(uploadProgress);
    const matchingEntry = progressEntries.find(([key, progress]) => {
      const cleanProgressName = progress.name.replace(/\.pdf$/, '');
      const cleanDocName = cleanFileName(fileName);
      return cleanProgressName === cleanDocName || progress.name === fileName;
    });
    
    return matchingEntry ? matchingEntry[1] : null;
  };

  // Categorize documents into Recent vs All Documents based on session storage
  useEffect(() => {
    const sessionIDs = getSessionNewFileIDs();
    
    const recent = [];
    const knowledgeBase = [];
    
    // Add actual documents from the database
    documents.forEach(doc => {
      if (sessionIDs.includes(doc.id)) {
        recent.push(doc);
      } else {
        knowledgeBase.push(doc);
      }
    });

    // Add uploading documents to Recent tab (these are temporary until they become real documents)
    Object.entries(uploadProgress).forEach(([key, progress]) => {
      // Create temporary document objects for uploading files
      const tempDoc = {
        id: `temp_${key}`,
        file_name: progress.name,
        status: progress.status === 'uploading' ? 'uploading' : 'processing',
        created_at: new Date().toISOString(),
        isTemporary: true, // Flag to identify temporary upload documents
        uploadProgress: progress
      };
      recent.push(tempDoc);
    });
    
    setRecentDocuments(recent);
    setKnowledgeBaseDocuments(knowledgeBase);
    
    // Smart tab selection logic based on content
    if (recent.length > 0) {
      // If there are recent documents, default to 'recent' tab
      setActiveTab('recent');
    } else if (knowledgeBase.length > 0) {
      // If no recent documents but there are existing documents, show 'all'
      setActiveTab('all');
    } else {
      // First-time user with no documents, default to 'all' for the initial upload prompt
      setActiveTab('all');
    }
    
    // Debug session information
    const currentSessionId = sessionUtils.getSessionId();
    const currentUserId = sessionUtils.getCurrentUserId();
    console.log(`Session Debug - Session ID: ${currentSessionId}, User ID: ${currentUserId}`);
    console.log(`Categorized documents: ${recent.length} recent, ${knowledgeBase.length} all documents`);
    console.log(`Active tab set to: ${recent.length > 0 ? 'recent' : knowledgeBase.length > 0 ? 'all' : 'all'}`);
  }, [documents, uploadProgress]);

  // Filter documents based on search term (global search across both sections)
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

  // Enhanced auto-selection logic with priority for recently added documents
  useEffect(() => {
    if (!selectedDocument && documents.length > 0) {
      // Priority 1: Most recent document in "Recently Added" section (if any)
      const mostRecentDoc = getMostRecentSessionDocument(documents);
      if (mostRecentDoc && mostRecentDoc.status === 'ready') {
        console.log('Auto-selecting most recent session document:', mostRecentDoc.file_name);
        onDocumentSelect(mostRecentDoc);
        return;
      }
      
      // Priority 2: Fallback to original logic - first ready document in all documents
      const readyDoc = documents.find(doc => doc.status === 'ready');
      if (readyDoc) {
        console.log('Auto-selecting first ready document:', readyDoc.file_name);
        onDocumentSelect(readyDoc);
      }
    }
  }, [documents, selectedDocument, onDocumentSelect]);

  // Poll for status updates when documents are processing
  useEffect(() => {
    const processingDocs = documents.filter(doc => doc.status === 'processing');
    
    if (processingDocs.length > 0 && !isPolling) {
      setIsPolling(true);
      console.log(`Found ${processingDocs.length} documents still processing, starting status polling...`);
      
      const pollInterval = setInterval(async () => {
        try {
          console.log('Polling for document status updates...');
          await onDocumentsUpdate();
          
          // Check if any documents are still processing
          const stillProcessing = documents.filter(doc => doc.status === 'processing');
          if (stillProcessing.length === 0) {
            console.log(' All documents processing completed, stopping poll');
            clearInterval(pollInterval);
            setIsPolling(false);
          }
        } catch (error) {
          console.error(' Error during status polling:', error);
        }
      }, 3000); // Poll every 3 seconds

      // Auto-stop polling after 5 minutes to prevent infinite polling
      const maxPollTime = setTimeout(() => {
        console.log(' Maximum polling time reached, stopping poll');
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
      // Upload files with real-time progress tracking
      const response = await documentAPI.uploadMultiple(fileArray, (percentCompleted) => {
        // Update all files with the same upload progress since it's a batch upload
        const updatedTracker = { ...progressTracker };
        Object.keys(updatedTracker).forEach(key => {
          updatedTracker[key] = {
            ...updatedTracker[key],
            status: percentCompleted < 100 ? 'uploading' : 'processing',
            progress: percentCompleted < 100 ? percentCompleted : 75 // Switch to processing at 75%
          };
        });
        setUploadProgress(updatedTracker);
      });
      
      // Upload completed, now show processing state
      const processingTracker = {};
      Object.keys(progressTracker).forEach(key => {
        processingTracker[key] = {
          ...progressTracker[key],
          status: 'processing',
          progress: 85 // Show 85% while documents are being processed
        };
      });
      setUploadProgress(processingTracker);

      // Track newly uploaded documents in session storage
      if (response && response.results) {
        response.results.forEach(result => {
          if (result.success && result.document_id) {
            addToSessionNewFiles(result.document_id);
            console.log(`Added newly uploaded document ${result.document_id} to session tracking`);
          }
        });
        
        // Automatically switch to 'recent' tab when new documents are uploaded
        setActiveTab('recent');
        console.log('Switched to Recent tab after file upload');
      }

      // Small delay to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh document list after ensuring DB is updated
      console.log('Refreshing document list after upload...');
      await onDocumentsUpdate();
      console.log('Document list refreshed, checking status...');
      
      // Show completion state briefly
      const completedTracker = {};
      Object.keys(progressTracker).forEach(key => {
        completedTracker[key] = {
          ...progressTracker[key],
          status: 'completed',
          progress: 100
        };
      });
      setUploadProgress(completedTracker);
      
      // Note: Documents will start as "processing" - polling effect will handle status updates
      
      // Clear progress after successful upload
      setTimeout(() => {
        setUploadProgress({});
      }, 3000); // Longer delay to show completion

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
      return ''; // Remove status text for ready documents to keep it clean
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
      console.log('Starting clear all documents operation...');
      
      const result = await documentAPI.clearAll();
      console.log('Clear all completed:', result);
      
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
      console.error(' Failed to clear all documents:', error);
      alert('Failed to clear documents. Please try again.');
    } finally {
      setIsClearingAll(false);
    }
  };

  // Simple delete document with confirmation
  const handleDeleteDocument = async (documentId, documentName) => {
    // Simple browser confirmation - no complex state management
    const confirmed = window.confirm(`Are you sure you want to delete "${cleanFileName(documentName)}"?\n\nThis action cannot be undone.`);
    
    if (!confirmed) {
      return; // User cancelled
    }

    // Close menu
    setOpenMenuId(null);

    // Add to deleting set to show loading state
    setDeletingDocuments(prev => new Set([...prev, documentId]));
    
    try {
      console.log(`Starting delete operation for document ${documentId}...`);
      
      const result = await documentAPI.deleteDocument(documentId);
      console.log('Delete completed:', result);
      
      // If deleting the currently selected document, clear selection
      if (selectedDocument && selectedDocument.id === documentId) {
        onDocumentSelect(null);
      }
      
      // Remove from session storage if it was a recent document
      removeFromSessionNewFiles(documentId);
      
      // Refresh the document list
      await onDocumentsUpdate();
      
      // Clear connections cache if available (similar to clear all)
      if (window.localStorage) {
        window.localStorage.removeItem('synapse_connections_cache');
      }
      
      console.log(`Successfully deleted document: ${cleanFileName(documentName)}`);
      
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert(`Failed to delete document "${cleanFileName(documentName)}". Please try again.`);
    } finally {
      // Remove from deleting set
      setDeletingDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  // Download document handler
  const handleDownloadDocument = (documentId, documentName) => {
    try {
      const downloadUrl = documentAPI.getDownloadUrl(documentId);
      
      // Create temporary link element to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = cleanFileName(documentName) + '.pdf';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setOpenMenuId(null); // Close menu after download
      console.log(`Download initiated for: ${cleanFileName(documentName)}`);
    } catch (error) {
      console.error('Failed to download document:', error);
      alert(`Failed to download document "${cleanFileName(documentName)}". Please try again.`);
    }
  };

  // Toggle document menu
  const toggleDocumentMenu = (documentId, event) => {
    event.stopPropagation(); // Prevent document selection
    setOpenMenuId(openMenuId === documentId ? null : documentId);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Tab handling functions
  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    console.log(`Switched to ${tabName} tab`);
  };

  // Get documents for the active tab
  const getActiveTabDocuments = () => {
    if (searchTerm) {
      // When searching, show all filtered results regardless of tab
      return filteredDocuments;
    }
    
    if (activeTab === 'recent') {
      return recentDocuments;
    } else {
      return knowledgeBaseDocuments;
    }
  };

  // Get tab display name with count
  const getTabDisplayName = (tabName) => {
    if (tabName === 'recent') {
      const count = recentDocuments.length;
      return count > 0 ? `Recent (${count})` : 'Recent';
    } else {
      const count = knowledgeBaseDocuments.length;
      return count > 0 ? `Past Documents (${count})` : 'Past Documents';
    }
  };

  // Component for rendering individual tab button with enhanced tooltip
  const TabButton = ({ tabName, isActive, onClick, tooltip }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    
    return (
      <div className="tab-button-wrapper">
        <button
          className={`tab-button ${isActive ? 'active' : ''}`}
          onClick={() => onClick(tabName)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span className="tab-text">{getTabDisplayName(tabName)}</span>
          <Info size={12} className="tab-info-icon" />
        </button>
        {showTooltip && (
          <div className="tab-tooltip">
            {tooltip}
          </div>
        )}
      </div>
    );
  };

  // Render the document list for the active tab
  const renderDocumentList = (documents) => {
    if (documents.length === 0) {
      // Handle empty states based on tab and search context
      if (searchTerm) {
        return (
          <div className="empty-state">
            <div className="no-matches">
              <p>No documents match your search.</p>
              <button onClick={() => setSearchTerm('')} className="clear-search-btn">
                Clear search
              </button>
            </div>
          </div>
        );
      } else if (activeTab === 'recent') {
        return (
          <div className="empty-state">
            <div className="tab-empty-state">
              <p>Your newly uploaded documents will appear here.</p>
              <span className="empty-hint">Upload some PDFs to get started!</span>
            </div>
          </div>
        );
      } else if (activeTab === 'all' && knowledgeBaseDocuments.length === 0 && recentDocuments.length === 0) {
        // First-time user experience
        return (
          <div className="empty-state">
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
          </div>
        );
      } else {
        // All Documents tab with no documents in library (but recent documents exist)
        return (
          <div className="empty-state">
            <div className="tab-empty-state">
              <p>Your document library is empty.</p>
              <span className="empty-hint">Documents from 'Recent' will appear here after your next session.</span>
            </div>
          </div>
        );
      }
    }

    return (
      <div className="tab-document-list">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className={`document-item ${selectedDocument?.id === doc.id ? 'selected' : ''} ${doc.isTemporary ? 'uploading' : ''} ${openMenuId === doc.id ? 'menu-open' : ''}`}
            onClick={() => !doc.isTemporary && onDocumentSelect(doc)}
          >
            <div className="document-info">
              <div className="document-main">
                <div className="document-icon">
                  <FileText size={16} />
                </div>
                <div className="document-details">
                  <div className="document-name">
                    <span>{cleanFileName(doc.file_name)}</span>
                    {recentDocuments.find(recent => recent.id === doc.id) && activeTab === 'all' && (
                      <span className="new-badge">New</span>
                    )}
                  </div>
                  <div className="document-metadata">
                    {/* Show upload progress for temporary documents */}
                    {doc.isTemporary && doc.uploadProgress && (
                      <div className="document-upload-progress">
                        <div className="upload-status-info">
                          <span className="upload-status-text">
                            {doc.uploadProgress.status === 'uploading' && `Uploading... ${doc.uploadProgress.progress}%`}
                            {doc.uploadProgress.status === 'processing' && `Processing... ${doc.uploadProgress.progress}%`}
                            {doc.uploadProgress.status === 'completed' && `Completed!`}
                            {doc.uploadProgress.status === 'error' && `Error`}
                          </span>
                        </div>
                        <div className="inline-progress-bar">
                          <div 
                            className={`inline-progress-fill ${doc.uploadProgress.status === 'completed' ? 'completed' : ''} ${doc.uploadProgress.status === 'error' ? 'error' : ''}`}
                            style={{ width: `${doc.uploadProgress.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Show regular metadata for real documents */}
                    {!doc.isTemporary && (
                      <>
                        {doc.created_at && (
                          <span className="document-date">
                            Added {formatDate(doc.created_at)}
                          </span>
                        )}
                        {doc.status !== 'ready' && (
                          <div className="document-status-indicator">
                            {getStatusIcon(doc.status)}
                            <span className="document-status">{getStatusText(doc)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                {/* Three-dot menu for real documents only */}
                {!doc.isTemporary && (
                  <div className="document-actions">
                    <button
                      className="document-menu-button"
                      onClick={(e) => toggleDocumentMenu(doc.id, e)}
                      disabled={deletingDocuments.has(doc.id)}
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {openMenuId === doc.id && (
                      <div className="document-menu-dropdown">
                        <button
                          className="menu-item download-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadDocument(doc.id, doc.file_name);
                          }}
                        >
                          <Download size={14} />
                          <span>Download</span>
                        </button>
                        <button
                          className="menu-item delete-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id, doc.file_name);
                          }}
                          disabled={deletingDocuments.has(doc.id)}
                        >
                          <Trash2 size={14} />
                          <span>{deletingDocuments.has(doc.id) ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
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
            Workspace
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
                  <Trash2 size={12} />
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

      {/* Document List with Tabbed Interface */}
      <div className="document-list">
        {/* Tab Container */}
        <div className="tab-container">
          <TabButton
            tabName="recent"
            isActive={activeTab === 'recent'}
            onClick={handleTabClick}
            tooltip="Documents uploaded in this session. They will be moved to 'All Documents' on your next visit."
          />
          <TabButton
            tabName="all"
            isActive={activeTab === 'all'}
            onClick={handleTabClick}
            tooltip="Your permanent library. Insights are generated by connecting information across all documents here."
          />
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {searchTerm ? (
            // When searching, show all results with search indicator
            <div className="search-results-header">
              <h4 className="search-results-title">SEARCH RESULTS</h4>
            </div>
          ) : null}
          
          {/* Render the active tab's content */}
          {renderDocumentList(getActiveTabDocuments())}
        </div>
      </div>
    </div>
  );
};

export default DocumentLibrary;
