/**
 * Quick Start Guide Component
 * 
 * Provides comprehensive onboarding guidance for new users with visual examples
 * and step-by-step workflow instructions for the complete Synapse experience.
 */
import { useState, useEffect, useMemo } from 'react';
import { Upload, FileText, Network, Lightbulb, Podcast, X, ChevronRight, Eye, Sparkles, Home } from 'lucide-react';
import './QuickStartGuide.css';

const QuickStartGuide = ({ onDismiss }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loadedImages, setLoadedImages] = useState(new Set());
  const [failedImages, setFailedImages] = useState(new Set());
  const [imageLoadingStates, setImageLoadingStates] = useState(new Map());
  
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

  // Memoize image URLs for performance
  const imageUrls = useMemo(() => 
    steps.map(step => step.image).filter(Boolean), 
    [steps]
  );

  // Preload all images when component mounts
  useEffect(() => {
    // Add preload link tags to head for faster browser caching
    const addPreloadLinks = () => {
      imageUrls.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        link.id = `preload-${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Only add if not already present
        if (!document.getElementById(link.id)) {
          document.head.appendChild(link);
        }
      });
    };

    const preloadImages = async () => {
      // Prioritize current step image
      const currentImage = steps[currentStep]?.image;
      const otherImages = imageUrls.filter(url => url !== currentImage);

      // Load current image first
      if (currentImage) {
        await loadImage(currentImage);
      }

      // Load remaining images with slight delay to not block current image
      setTimeout(() => {
        const loadPromises = otherImages.map(url => loadImage(url));
        Promise.allSettled(loadPromises);
      }, 100);
    };

    const loadImage = (url) => {
      return new Promise((resolve) => {
        // Skip if already processed
        if (loadedImages.has(url) || failedImages.has(url)) {
          resolve(loadedImages.has(url));
          return;
        }

        setImageLoadingStates(prev => new Map(prev.set(url, 'loading')));
        
        const img = new Image();
        
        img.onload = () => {
          setLoadedImages(prev => new Set(prev.add(url)));
          setImageLoadingStates(prev => new Map(prev.set(url, 'loaded')));
          resolve(true);
        };
        
        img.onerror = () => {
          setFailedImages(prev => new Set(prev.add(url)));
          setImageLoadingStates(prev => new Map(prev.set(url, 'error')));
          resolve(false);
        };
        
        img.src = url;
      });
    };

    addPreloadLinks();
    preloadImages();

    // Cleanup function to remove preload links when component unmounts
    return () => {
      imageUrls.forEach(url => {
        const linkId = `preload-${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const link = document.getElementById(linkId);
        if (link) {
          document.head.removeChild(link);
        }
      });
    };
  }, [imageUrls, currentStep, loadedImages, failedImages, steps]);

  // Prefetch next/previous images for smoother navigation
  useEffect(() => {
    const prefetchAdjacentImages = () => {
      const nextImage = steps[currentStep + 1]?.image;
      const prevImage = steps[currentStep - 1]?.image;
      
      [nextImage, prevImage].filter(Boolean).forEach(url => {
        if (!loadedImages.has(url) && !failedImages.has(url)) {
          const img = new Image();
          img.src = url;
        }
      });
    };

    prefetchAdjacentImages();
  }, [currentStep, steps, loadedImages, failedImages]);

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

  const goToStep = (stepIndex) => {
    setCurrentStep(stepIndex);
  };

  // Check if current step image is ready
  const isCurrentImageReady = () => {
    const currentImage = currentStepData.image;
    return !currentImage || loadedImages.has(currentImage);
  };

  // Optimized image component with loading states
  const OptimizedImage = ({ src, alt, className }) => {
    const loadingState = imageLoadingStates.get(src) || 'loading';
    const isLoaded = loadedImages.has(src);
    const hasFailed = failedImages.has(src);

    if (hasFailed) {
      return (
        <div className="image-placeholder">
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Guide Image</span>
        </div>
      );
    }

    return (
      <div className="image-container">
        {!isLoaded && (
          <div className="image-loading-skeleton">
            <div className="skeleton-shimmer"></div>
            <div className="skeleton-content">
              <div className="skeleton-icon">
                <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="skeleton-text">Loading guide image...</span>
            </div>
          </div>
        )}
        <img 
          src={src} 
          alt={alt}
          className={`${className} ${isLoaded ? 'image-loaded' : 'image-loading'}`}
          style={{ 
            display: isLoaded ? 'block' : 'none',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out'
          }}
          loading="eager"
          decoding="async"
          fetchpriority="high"
        />
      </div>
    );
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
            {!isCurrentImageReady() && (
              <div className="step-loading-indicator">
                <div className="loading-spinner"></div>
                <span>Loading image...</span>
              </div>
            )}
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
                <OptimizedImage 
                  src={currentStepData.image}
                  alt={currentStepData.imageAlt || currentStepData.title}
                  className="step-image"
                />
              ) : (
                <div className="image-placeholder">
                  <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Guide Image</span>
                </div>
              )}
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
                  onClick={() => goToStep(index)}
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
