/**
 * Tooltip Guide Component
 * 
 * Shows a helpful tooltip that emerges from the right sidebar to guide users
 * about the text selection functionality. Appears only at startup when the
 * right sidebar is collapsed to help users understand the core workflow.
 */
import { useState, useEffect } from 'react';
import { X, Sparkles, ChevronLeft } from 'lucide-react';
import './TooltipGuide.css';

const TooltipGuide = ({ 
  isVisible, 
  onDismiss, 
  isRightSidebarCollapsed = true 
}) => {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Only show if visible prop is true and right sidebar is collapsed
    if (isVisible && isRightSidebarCollapsed) {
      // Small delay for smooth entrance animation
      const timer = setTimeout(() => setShouldShow(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShouldShow(false);
    }
  }, [isVisible, isRightSidebarCollapsed]);

  const handleDismiss = () => {
    setShouldShow(false);
    // Small delay before calling onDismiss for smooth exit animation
    setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 300);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  };

  if (!shouldShow) return null;

  return (
    <div className="tooltip-guide-overlay" onClick={handleBackdropClick}>
      <div className="tooltip-guide">
        <div className="tooltip-arrow"></div>
        
        <div className="tooltip-header">
          <div className="tooltip-icon">
            <Sparkles size={18} />
          </div>
          <button 
            className="tooltip-close"
            onClick={handleDismiss}
            title="Dismiss guide"
          >
            <X size={16} />
          </button>
        </div>

        <div className="tooltip-content">
          <h4>Discover Related Content</h4>
          <p>Select text to find related snippets from your documents.</p>
          
          <div className="tooltip-expand-hint">
            <ChevronLeft size={12} />
            <span>Sidebar expands automatically</span>
          </div>
        </div>

        <div className="tooltip-footer">
          <button 
            className="tooltip-dismiss-btn"
            onClick={handleDismiss}
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default TooltipGuide;
