/**
 * Flow Status Bar Component - Redesigned for Professional UI/UX
 * 
 * Shows the current state of the user's workflow with clear visual hierarchy:
 * - Completed: Solid blue circles with white icons
 * - Active: Blue outline with blue icon (prominent)
 * - Pending: Gray outline with gray icon
 */
import { useState, useEffect } from 'react';
import { FileText, Network, Lightbulb, ChevronRight, ChevronDown } from 'lucide-react';
import './FlowStatusBar.css';

const FlowStatusBar = ({ 
  document, 
  connectionsCount, 
  hasInsights, 
  isLoadingConnections,
  currentContext,
  isVertical = false
}) => {
  const [flowStep, setFlowStep] = useState('upload');
  const [hoveredStep, setHoveredStep] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0 });

  useEffect(() => {
    if (!document) {
      setFlowStep('upload');
    } else if (connectionsCount === 0 && !isLoadingConnections) {
      setFlowStep('connect');
    } else if (connectionsCount > 0 && !hasInsights) {
      setFlowStep('generate');
    } else {
      setFlowStep('complete');
    }
  }, [document, connectionsCount, hasInsights, isLoadingConnections, currentContext]);

  const handleMouseEnter = (step, event) => {
    setHoveredStep(step);
    
    // For vertical layout, calculate the tooltip position based on the icon's position
    if (isVertical && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      const iconCenterY = rect.top + rect.height / 2;
      setTooltipPosition({ top: iconCenterY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredStep(null);
  };

  const getStepStatus = (step) => {
    const steps = ['upload', 'connect', 'generate', 'complete'];
    const currentIndex = steps.indexOf(flowStep);
    const stepIndex = steps.indexOf(step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const getStepLabel = (step) => {
    switch (step) {
      case 'upload':
        return 'Upload';
      case 'connect':
        return 'Connect';
      case 'generate':
        return 'Generate';
      default:
        return '';
    }
  };

  const getStepTooltip = (step) => {
    switch (step) {
      case 'upload':
        return 'Add documents to build your library';
      case 'connect':
        return 'Select text to find connections';
      case 'generate':
        return 'Generate insights and podcast';
      default:
        return '';
    }
  };

  const getConnectorStatus = (step) => {
    // Connector after upload: completed if we're past upload
    // Connector after connect: completed if we're past connect
    const steps = ['upload', 'connect', 'generate'];
    const currentIndex = steps.indexOf(flowStep);
    const stepIndex = steps.indexOf(step);
    
    return stepIndex < currentIndex ? 'completed' : 'pending';
  };

  return (
    <div className={`flow-status-bar ${isVertical ? 'vertical' : ''}`}>
      <div className="status-content">
        <div className="status-steps">
          {/* Upload Step */}
          <div 
            className="status-step-container"
            onMouseEnter={(e) => handleMouseEnter('upload', e)}
            onMouseLeave={handleMouseLeave}
          >
            <div className={`status-step ${getStepStatus('upload')}`}>
              <FileText size={isVertical ? 14 : 18} />
            </div>
            {!isVertical && (
              <div className={`status-label ${getStepStatus('upload')}`}>
                {getStepLabel('upload')}
              </div>
            )}
            {hoveredStep === 'upload' && (
              <div 
                className="tooltip"
                style={isVertical ? { top: `${tooltipPosition.top}px` } : {}}
              >
                {getStepTooltip('upload')}
              </div>
            )}
          </div>
          
          {/* Connector 1 - Arrow pointing to next step */}
          <div className={`status-connector ${getConnectorStatus('upload')}`}>
            {isVertical ? (
              <ChevronDown size={16} className="connector-arrow" />
            ) : (
              <ChevronRight size={16} className="connector-arrow" />
            )}
          </div>
          
          {/* Connect Step */}
          <div 
            className="status-step-container"
            onMouseEnter={(e) => handleMouseEnter('connect', e)}
            onMouseLeave={handleMouseLeave}
          >
            <div className={`status-step ${getStepStatus('connect')}`}>
              <Network size={isVertical ? 14 : 18} />
            </div>
            {!isVertical && (
              <div className={`status-label ${getStepStatus('connect')}`}>
                {getStepLabel('connect')}
              </div>
            )}
            {hoveredStep === 'connect' && (
              <div 
                className="tooltip"
                style={isVertical ? { top: `${tooltipPosition.top}px` } : {}}
              >
                {getStepTooltip('connect')}
              </div>
            )}
          </div>
          
          {/* Connector 2 - Arrow pointing to next step */}
          <div className={`status-connector ${getConnectorStatus('connect')}`}>
            {isVertical ? (
              <ChevronDown size={16} className="connector-arrow" />
            ) : (
              <ChevronRight size={16} className="connector-arrow" />
            )}
          </div>
          
          {/* Generate Step */}
          <div 
            className="status-step-container"
            onMouseEnter={(e) => handleMouseEnter('generate', e)}
            onMouseLeave={handleMouseLeave}
          >
            <div className={`status-step ${getStepStatus('generate')}`}>
              <Lightbulb size={isVertical ? 14 : 18} />
            </div>
            {!isVertical && (
              <div className={`status-label ${getStepStatus('generate')}`}>
                {getStepLabel('generate')}
              </div>
            )}
            {hoveredStep === 'generate' && (
              <div 
                className="tooltip"
                style={isVertical ? { top: `${tooltipPosition.top}px` } : {}}
              >
                {getStepTooltip('generate')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowStatusBar;
