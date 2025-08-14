/**
 * Upload Form Component
 * 
 * This component is the primary user interaction point for adding new documents.
 * It features a stylized drag-and-drop area for better UX and provides visual feedback
 * including loading spinners and success/error messages. Supports multiple file uploads.
 */
import { useState, useRef } from 'react';
import { documentAPI } from '../api';

const UploadForm = ({ onUploadSuccess, onUploadError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastUploadResult, setLastUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleUpload = async (files) => {
    const fileArray = Array.isArray(files) ? files : [files];
    const validFiles = fileArray.filter(file => file.type === 'application/pdf');
    
    if (validFiles.length === 0) {
      const error = new Error('Please select valid PDF files');
      setLastUploadResult({ success: false, message: error.message });
      onUploadError?.(error);
      return;
    }

    // Check file sizes
    const maxSize = 100 * 1024 * 1024; // 100MB
    const oversizedFiles = validFiles.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      const error = new Error(`Some files exceed 100MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      setLastUploadResult({ success: false, message: error.message });
      onUploadError?.(error);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setLastUploadResult(null);

    try {
      console.log(`Starting upload for ${validFiles.length} file(s):`, validFiles.map(f => f.name));
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      let result;
      if (validFiles.length === 1) {
        // Use single upload endpoint for single file
        result = await documentAPI.upload(validFiles[0]);
        // Convert to multiple upload format for consistent handling
        result = {
          message: `Uploaded 1 file successfully`,
          results: [{
            filename: validFiles[0].name,
            success: true,
            message: result.message,
            document_id: result.document_id,
            status: result.status
          }],
          total_files: 1,
          successful_uploads: 1,
          failed_uploads: 0
        };
      } else {
        // Use multiple upload endpoint for multiple files
        result = await documentAPI.uploadMultiple(validFiles);
      }
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      console.log('Upload result:', result);
      
      const successCount = result.successful_uploads;
      const failedCount = result.failed_uploads;
      
      setLastUploadResult({ 
        success: successCount > 0,
        message: `Uploaded ${successCount} file(s) successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        results: result.results,
        isMultiple: validFiles.length > 1
      });
      
      onUploadSuccess?.(result);
      
      // Reset form after upload
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      setLastUploadResult({ 
        success: false, 
        message: `Upload failed: ${error.message}`,
        isMultiple: validFiles.length > 1
      });
      onUploadError?.(error);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  const handleDragEvents = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      // Only set dragging to false if we're leaving the drop zone entirely
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      
      if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
        setIsDragging(false);
      }
    } else if (e.type === 'drop') {
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleUpload(files);
      }
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleUpload(files);
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{ width: '100%', padding: '16px' }}>
      {/* Upload Area */}
      <div
        onDragEnter={handleDragEvents}
        onDragLeave={handleDragEvents}
        onDragOver={handleDragEvents}
        onDrop={handleDragEvents}
        onClick={handleClickUpload}
        style={{
          border: `2px dashed ${isDragging ? '#007bff' : isUploading ? '#28a745' : '#dee2e6'}`,
          borderRadius: '12px',
          padding: '32px 16px',
          textAlign: 'center',
          backgroundColor: isDragging ? '#f8f9fa' : isUploading ? '#f8fff9' : 'white',
          cursor: isUploading ? 'default' : 'pointer',
          transition: 'all 0.3s ease',
          position: 'relative',
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={isUploading}
        />

        {isUploading ? (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e9ecef',
              borderTop: '4px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px'
            }} />
            <h3 style={{ margin: '0 0 8px', color: '#007bff', fontWeight: '600' }}>
              Uploading Files...
            </h3>
            <div style={{
              width: '200px',
              height: '4px',
              backgroundColor: '#e9ecef',
              borderRadius: '2px',
              marginBottom: '8px'
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: '#007bff',
                borderRadius: '2px',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
              {uploadProgress}% complete
            </p>
          </>
        ) : (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: isDragging ? '#007bff' : '#f8f9fa',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              fontSize: '24px',
              color: isDragging ? 'white' : '#6c757d'
            }}>
              [Folder]
            </div>
            <h3 style={{ 
              margin: '0 0 8px', 
              color: isDragging ? '#007bff' : '#343a40',
              fontWeight: '600'
            }}>
              {isDragging ? 'Drop PDFs here' : 'Upload PDF Documents'}
            </h3>
            <p style={{ 
              margin: '0 0 16px', 
              fontSize: '14px', 
              color: '#6c757d',
              lineHeight: '1.4'
            }}>
              {isDragging 
                ? 'Release to upload your PDF files'
                : 'Drag and drop PDF files here, or click to browse'
              }
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClickUpload();
              }}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
            >
              Choose Files
            </button>
            <p style={{ 
              margin: '12px 0 0', 
              fontSize: '12px', 
              color: '#868e96'
            }}>
              Maximum file size: 100MB per file
            </p>
          </>
        )}
      </div>

      {/* Upload Result Feedback */}
      {lastUploadResult && (
        <div 
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: lastUploadResult.success ? '#d4edda' : '#f8d7da',
            border: `1px solid ${lastUploadResult.success ? '#c3e6cb' : '#f5c6cb'}`,
            color: lastUploadResult.success ? '#155724' : '#721c24'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>
              {lastUploadResult.success ? '' : ''}
            </span>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>
              {lastUploadResult.message}
            </span>
          </div>
          
          {/* File upload results */}
          {lastUploadResult.results && (
            <div style={{ marginTop: '8px' }}>
              {lastUploadResult.results.map((result, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  margin: '4px 0',
                  fontSize: '12px',
                  opacity: 0.9
                }}>
                  <span>{result.success ? '' : ''}</span>
                  <span style={{ fontWeight: '500' }}>{result.filename}:</span>
                  <span>{result.message}</span>
                  {result.document_id && (
                    <span style={{ opacity: 0.7 }}>
                      (ID: {result.document_id})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadForm;
