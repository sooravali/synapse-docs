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

  const getStepMessage = () => {
    switch (flowStep) {
      case 'upload':
        return 'Upload your PDF(s) to get started';
      case 'connect':
        return 'Start reading or select text to find connections';
      case 'generate':
        return 'Generate insights or podcasts for deeper analysis';
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
              <FileText size={20} />
            </div>
            <div className={`status-label ${getStepStatus('upload')}`}>
              {getStepLabel('upload')}
            </div>
          </div>
          <div className="status-connector" />
          <div className="status-step-container">
            <div className={`status-step ${getStepStatus('connect')}`}>
              <Network size={20} />
            </div>
            <div className={`status-label ${getStepStatus('connect')}`}>
              {getStepLabel('connect')}
            </div>
          </div>
          <div className="status-connector" />
          <div className="status-step-container">
            <div className={`status-step ${getStepStatus('generate')}`}>
              <Lightbulb size={20} />
            </div>
            <div className={`status-label ${getStepStatus('generate')}`}>
              {getStepLabel('generate')}
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
