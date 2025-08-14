/**
 * Flow Status Bar Component
 * 
 * Shows the current state of the user's workflow and provides
 * subtle guidance on next steps.
 */
import { useState, useEffect } from 'react';
import { FileText, Network, Lightbulb, CheckCircle, Clock } from 'lucide-react';
import './FlowStatusBar.css';

const FlowStatusBar = ({ 
  document, 
  connectionsCount, 
  hasInsights, 
  isLoadingConnections,
  currentContext 
}) => {
  const [flowStep, setFlowStep] = useState('upload');

  useEffect(() => {
    if (!document) {
      setFlowStep('upload');
    } else if (!currentContext) {
      setFlowStep('read');
    } else if (connectionsCount === 0 && !isLoadingConnections) {
      setFlowStep('scroll');
    } else if (connectionsCount > 0 && !hasInsights) {
      setFlowStep('insights');
    } else {
      setFlowStep('complete');
    }
  }, [document, connectionsCount, hasInsights, isLoadingConnections, currentContext]);

  const getStepStatus = (step) => {
    const steps = ['upload', 'read', 'scroll', 'insights', 'complete'];
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
      case 'scroll':
        return 'Read';
      case 'insights':
        return 'Insights';
      default:
        return '';
    }
  };

  const getStepMessage = () => {
    switch (flowStep) {
      case 'upload':
        return 'Upload your PDF(s) to get started';
      case 'read':
        return 'Start reading or select text to find connections';
      case 'scroll':
        return 'Generate insights or podcasts for deeper analysis';
      case 'insights':
        return 'Great! Try generating insights or podcasts';
      case 'complete':
        return 'All features unlocked! Continue exploring documents';
      default:
        return '';
    }
  };

  return (
    <div className="flow-status-bar">
      <div className="status-content">
        <div className="status-steps">
          <div className="status-step-container">
            <div className={`status-step ${getStepStatus('upload')}`}>
              <FileText size={16} />
            </div>
            <div className={`status-label ${getStepStatus('upload')}`}>
              {getStepLabel('upload')}
            </div>
          </div>
          <div className="status-connector" />
          <div className="status-step-container">
            <div className={`status-step ${getStepStatus('scroll')}`}>
              <Network size={16} />
            </div>
            <div className={`status-label ${getStepStatus('scroll')}`}>
              {getStepLabel('scroll')}
            </div>
          </div>
          <div className="status-connector" />
          <div className="status-step-container">
            <div className={`status-step ${getStepStatus('insights')}`}>
              <Lightbulb size={16} />
            </div>
            <div className={`status-label ${getStepStatus('insights')}`}>
              {getStepLabel('insights')}
            </div>
          </div>
        </div>
      </div>
      <div className="status-message">
        {getStepMessage()}
      </div>
    </div>
  );
};

export default FlowStatusBar;
