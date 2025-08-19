/**
 * Icon Rail Component
 * 
 * Displays a slim vertical rail with context-aware icons when the right sidebar is collapsed.
 * Implements progressive disclosure with tooltips and animations.
 */
import { useState, useEffect } from 'react';
import { Network, Lightbulb, Radio, FileText, ChevronLeft } from 'lucide-react';
import './IconRail.css';

const IconRail = ({ 
  hasConnections = false,
  hasInsights = false,
  hasPodcast = false,
  hasContext = false,
  isLoadingConnections = false,
  onRailExpand,
  onIconClick 
}) => {
  const [showInitialPulse, setShowInitialPulse] = useState(false);

  // Show initial pulse animation when context is available
  useEffect(() => {
    if (hasContext) {
      setShowInitialPulse(true);
      const timer = setTimeout(() => setShowInitialPulse(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [hasContext]);

  const handleIconClick = (iconType) => {
    if (onIconClick) {
      onIconClick(iconType);
    }
    if (onRailExpand) {
      onRailExpand();
    }
  };

  const isIconEnabled = (iconType) => {
    if (!hasContext) return false;
    
    switch (iconType) {
      case 'connections':
        return true;
      case 'insights':
        return hasConnections;
      case 'podcast':
        return hasInsights;
      default:
        return false;
    }
  };

  return (
    <div 
      className={`icon-rail ${showInitialPulse ? 'pulse' : ''}`}
    >
      {/* Background gradient */}
      <div className="rail-background" />
      
      {/* Expand Button at Top */}
      <button 
        className="expand-button"
        onClick={onRailExpand}
        title="Expand Panel"
      >
        <ChevronLeft size={16} />
      </button>
      
      {/* Icons */}
      <div className="rail-icons">
        {/* Connections Icon */}
        <div 
          className={`rail-icon ${isIconEnabled('connections') ? 'enabled' : 'disabled'} ${isLoadingConnections ? 'loading' : ''}`}
          onClick={() => isIconEnabled('connections') && handleIconClick('connections')}
        >
          <Network size={18} />
          {isLoadingConnections && <div className="icon-spinner" />}
        </div>

        {/* Insights Icon */}
        <div 
          className={`rail-icon insights-icon ${isIconEnabled('insights') ? 'enabled' : 'disabled'}`}
          onClick={() => isIconEnabled('insights') && handleIconClick('insights')}
        >
          <Lightbulb size={18} />
        </div>

        {/* Podcast Icon */}
        <div 
          className={`rail-icon ${isIconEnabled('podcast') ? 'enabled' : 'disabled'}`}
          onClick={() => isIconEnabled('podcast') && handleIconClick('podcast')}
        >
          <Radio size={18} />
        </div>
      </div>


    </div>
  );
};

export default IconRail;
