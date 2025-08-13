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

  const getStepMessage = () => {
    switch (flowStep) {
      case 'upload':
        return 'Upload your first PDF document to get started';
      case 'read':
        return 'Start reading or select text - connections will generate automatically';
      case 'scroll':
        return 'Connections found! Generate insights or podcasts for deeper analysis';
      case 'insights':
        return 'Great! Try generating podcasts or continue exploring';
      case 'complete':
        return 'All features unlocked! Read more or select text for additional analysis';
      default:
        return '';
    }
  };

  return (
    <div className="flow-status-bar">
      <div className="status-content">
        <div className="status-steps">
          <div className={`status-step ${getStepStatus('upload')}`}>
            <FileText size={16} />
          </div>
          <div className="status-connector" />
          <div className={`status-step ${getStepStatus('scroll')}`}>
            <Network size={16} />
          </div>
          <div className="status-connector" />
          <div className={`status-step ${getStepStatus('insights')}`}>
            <Lightbulb size={16} />
          </div>
        </div>
        <div className="status-message">
          {getStepMessage()}
        </div>
      </div>
    </div>
  );
};

export default FlowStatusBar;
