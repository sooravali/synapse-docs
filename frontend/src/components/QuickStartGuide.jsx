/**
 * Quick Start Guide Component
 * 
 * Provides comprehensive onboarding guidance for new users with visual examples
 * and step-by-step workflow instructions for the complete Synapse experience.
 */
import { useState } from 'react';
import { Upload, FileText, Network, Lightbulb, Podcast, X, ChevronRight, Eye, Sparkles, Home } from 'lucide-react';
import './QuickStartGuide.css';

const QuickStartGuide = ({ onDismiss }) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    {
      icon: Home,
      title: "Welcome to Synapse",
      description: "Synapse is your intelligent document companion that transforms how you interact with your PDF library. Experience seamless document exploration, AI-powered insights, and knowledge discovery like never before.",
      image: "/guide-images/main-page-intro.png",
      imageAlt: "Synapse application interface overview showing document library and features",
      keyFeatures: [
        "Intelligent document processing and indexing",
        "Real-time semantic search across all documents", 
        "AI-powered insights and content generation",
        "Interactive knowledge graph visualization",
        "Automatic research trail tracking"
      ],
      highlight: "🚀 Your complete research and document management solution in one powerful interface"
    },
    {
      icon: Upload,
      title: "Upload Your PDFs",
      description: "Start by uploading your PDF documents to build your personal knowledge library. Synapse supports drag-and-drop or click-to-browse functionality.",
      image: "/guide-images/upload-documents.png",
      imageAlt: "Document upload interface showing drag and drop area",
      keyFeatures: [
        "Support for multiple PDF files at once",
        "Automatic processing and indexing", 
        "Real-time upload progress tracking",
        "Immediate document organization"
      ],
      highlight: "✨ Your documents are automatically processed and made searchable within seconds"
    },
    {
      icon: Eye,
      title: "Select Text & Generate Snippets",
      description: "Open any document and select text to instantly discover related content from your entire library. Watch as Synapse finds semantically connected snippets across all your documents.",
      image: "/guide-images/select and generate related snippets.png", 
      imageAlt: "PDF viewer with text selection showing related snippets panel",
      keyFeatures: [
        "Real-time text selection detection",
        "Cross-document semantic search",
        "Instant snippet recommendations",
        "Click-to-jump navigation between documents"
      ],
      highlight: "🔍 Simply select any text - related content appears automatically from your other documents"
    },
    {
      icon: Lightbulb,
      title: "Generate AI Insights & Podcasts", 
      description: "Transform your selected content into structured insights with contradictions, supporting examples, and key takeaways. Then convert everything into engaging podcast-style audio.",
      image: "/guide-images/insights and podcasts.png",
      imageAlt: "Insights panel showing structured analysis and podcast generation",
      keyFeatures: [
        "AI-powered insight analysis",
        "Structured findings with citations",
        "Multi-speaker podcast generation",
        "Audio playback with controls"
      ],
      highlight: "🎧 Turn your research into conversational podcasts featuring Indian speakers Pooja and Arjun"
    },
    {
      icon: Network,
      title: "Explore Knowledge Connections",
      description: "Visualize how all your documents connect through the interactive Synapse View. Discover unexpected relationships and navigate your knowledge graph with force-directed visualization.",
      image: "/guide-images/synapse-view-2.png",
      imageAlt: "Interactive knowledge graph showing document connections",
      keyFeatures: [
        "Force-directed graph visualization", 
        "Interactive document exploration",
        "Connection strength indicators",
        "Click-to-open document navigation"
      ],
      highlight: "🌐 Press ⌘K (Mac) or Ctrl+K (Windows) to open the knowledge graph anytime"
    },
    {
      icon: FileText,
      title: "Navigate with Research Trail",
      description: "Track your exploration journey with automatic breadcrumb trails. See exactly where you've been and jump back to any previous location instantly.",
      image: "/guide-images/research-trail-breadcrumbs.png", 
      imageAlt: "Research trail breadcrumbs showing navigation history",
      keyFeatures: [
        "Automatic navigation tracking",
        "Page-level breadcrumb precision", 
        "One-click return to any location",
        "Visual exploration history"
      ],
      highlight: "🍞 Your research path is automatically tracked - never lose your place again"
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
          <div className="step-main">
            <div className="step-header">
              <div className="step-icon">
                <IconComponent size={24} />
              </div>
              <h3>{currentStepData.title}</h3>
            </div>
            
            <div className={`step-visual step-${currentStep}`}>
              {currentStepData.image ? (
                <img 
                  src={currentStepData.image} 
                  alt={currentStepData.imageAlt || currentStepData.title}
                  className="step-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className="image-placeholder" style={{display: currentStepData.image ? 'none' : 'flex'}}>
                <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Guide Image</span>
              </div>
            </div>
          </div>
          
          <div className="step-sidebar">
            <div className="step-description">
              <p>{currentStepData.description}</p>
            </div>
            
            {currentStepData.keyFeatures && (
              <div className="step-features">
                <h4>Key Features</h4>
                <ul>
                  {currentStepData.keyFeatures.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {currentStepData.highlight && (
              <div className="step-highlight">
                <div className="highlight-icon">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span>{currentStepData.highlight}</span>
              </div>
            )}
          </div>
        </div>          <div className="step-navigation">
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
                <Sparkles size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickStartGuide;
