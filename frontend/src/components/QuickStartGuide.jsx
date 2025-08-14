/**
 * Quick Start Guide Component
 * 
 * Provides onboarding guidance for new users to understand the complete workflow
 * from upload to insights generation.
 */
import { useState } from 'react';
import { Upload, FileText, Network, Lightbulb, Podcast, X, ChevronRight } from 'lucide-react';
import './QuickStartGuide.css';

const QuickStartGuide = ({ onDismiss }) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    {
      icon: Upload,
      title: "Upload Your PDFs",
      description: "Start by uploading PDF documents to your library. Drag and drop files or click to browse.",
      highlight: "All your documents are processed and indexed automatically"
    },
    {
      icon: FileText,
      title: "Select & Read",
      description: "Choose a document from your library to open it in the viewer. Start reading through your content.",
      highlight: "Navigate pages and explore your document content"
    },
    {
      icon: Network,
      title: "Discover Connections",
      description: "As you scroll and read, Synapse automatically finds related content from your other documents.",
      highlight: "No action needed - connections appear automatically!"
    },
    {
      icon: Lightbulb,
      title: "Generate Insights",
      description: "Select any text in your document to generate AI-powered insights, summaries, and analysis.",
      highlight: "Highlight text → Click insights button → Get instant analysis"
    },
    {
      icon: Podcast,
      title: "Create Podcasts",
      description: "Generate audio podcasts from your content for a new way to consume your documents.",
      highlight: "Turn your documents into engaging audio content"
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = steps[currentStep];
  const IconComponent = currentStepData.icon;

  return (
    <div className="quick-start-overlay">
      <div className="quick-start-modal">
        <div className="quick-start-header">
          <h2>Welcome to Synapse</h2>
          <button onClick={onDismiss} className="close-button">
            <X size={20} />
          </button>
        </div>
        
        <div className="quick-start-content">
          <div className="step-indicator">
            <span className="step-count">{currentStep + 1} of {steps.length}</span>
          </div>
          
          <div className="step-content">
            <div className="step-icon">
              <IconComponent size={48} />
            </div>
            <h3>{currentStepData.title}</h3>
            <p>{currentStepData.description}</p>
            <div className="step-highlight">
              <span className="highlight-icon"></span>
              <span>{currentStepData.highlight}</span>
            </div>
          </div>
          
          <div className="step-navigation">
            <button 
              onClick={prevStep} 
              disabled={currentStep === 0}
              className="nav-button prev"
            >
              Previous
            </button>
            
            <div className="step-dots">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`step-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                />
              ))}
            </div>
            
            {currentStep < steps.length - 1 ? (
              <button onClick={nextStep} className="nav-button next">
                Next
                <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={onDismiss} className="nav-button get-started">
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickStartGuide;
