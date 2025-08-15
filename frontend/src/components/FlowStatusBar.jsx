/**
 * Flow Status Bar Component - Redesigned for Professional UI/UX
 * 
 * Shows the current state of the user's workflow with clear visual hierarchy:
 * - Completed: Solid blue circles with white icons
 * - Active: Blue outline with blue icon (prominent)
 * - Pending: Gray outline with gray icon
 */
import { useState, useEffect } from 'react';
import { FileText, Network, Lightbulb } from 'lucide-react';
import './FlowStatusBar.css';

const FlowStatusBar = ({ 
  document, 
  connectionsCount, 
  hasInsights, 
  isLoadingConnections,
  currentContext 
}) => {
  const [flowStep, setFlowStep] = useState('upload');
  const [hoveredStep, setHoveredStep] = useState(null);

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
        return 'Analyzing documents to find connections';
      case 'generate':
        return 'Select text to generate insights and podcast';
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
    <div className="flow-status-bar">
      <div className="status-content">
        <div className="status-steps">
          {/* Upload Step */}
          <div className="status-step-container">
            <div 
              className={`status-step ${getStepStatus('upload')}`}
              onMouseEnter={() => setHoveredStep('upload')}
              onMouseLeave={() => setHoveredStep(null)}
            >
              <FileText size={18} />
              {hoveredStep === 'upload' && (
                <div className="tooltip">
                  {getStepTooltip('upload')}
                </div>
              )}
            </div>
            <div className={`status-label ${getStepStatus('upload')}`}>
              {getStepLabel('upload')}
            </div>
          </div>
          
          {/* Connector 1 */}
          <div className={`status-connector ${getConnectorStatus('upload')}`} />
          
          {/* Connect Step */}
          <div className="status-step-container">
            <div 
              className={`status-step ${getStepStatus('connect')}`}
              onMouseEnter={() => setHoveredStep('connect')}
              onMouseLeave={() => setHoveredStep(null)}
            >
              <Network size={18} />
              {hoveredStep === 'connect' && (
                <div className="tooltip">
                  {getStepTooltip('connect')}
                </div>
              )}
            </div>
            <div className={`status-label ${getStepStatus('connect')}`}>
              {getStepLabel('connect')}
            </div>
          </div>
          
          {/* Connector 2 */}
          <div className={`status-connector ${getConnectorStatus('connect')}`} />
          
          {/* Generate Step */}
          <div className="status-step-container">
            <div 
              className={`status-step ${getStepStatus('generate')}`}
              onMouseEnter={() => setHoveredStep('generate')}
              onMouseLeave={() => setHoveredStep(null)}
            >
              <Lightbulb size={18} />
              {hoveredStep === 'generate' && (
                <div className="tooltip">
                  {getStepTooltip('generate')}
                </div>
              )}
            </div>
            <div className={`status-label ${getStepStatus('generate')}`}>
              {getStepLabel('generate')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowStatusBar;
