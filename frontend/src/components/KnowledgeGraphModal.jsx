/**
 * Knowledge Graph Modal Component
 * 
 * Renders an interactive force-directed graph showing semantic relationships
 * between documents in the user's library. Uses react-force-graph-2d for
 * visualization with custom styling and professional layout optimizations.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, AlertCircle, Network, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import './KnowledgeGraphModal.css';

const KnowledgeGraphModal = ({ 
  isVisible, 
  onClose, 
  onDocumentSelect,
  currentDocumentId = null
}) => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const forceGraphRef = useRef();

  // Fetch graph data when modal becomes visible
  useEffect(() => {
    if (isVisible) {
      fetchGraphData();
    }
  }, [isVisible]);

  const fetchGraphData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/graph/connectivity?similarity_threshold=0.25&max_connections_per_doc=6', {
        method: 'GET',
        headers: {
          'X-Session-ID': getSessionId(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch graph data: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Process the graph data for optimal visualization
      const processedData = processGraphData(data);
      setGraphData(processedData);
      
      console.log(`🌐 Knowledge graph loaded: ${data.nodes?.length || 0} documents, ${data.links?.length || 0} connections`);
      
      // Auto-fit to view when graph data is loaded
      setTimeout(() => {
        if (forceGraphRef.current && processedData.nodes.length > 0) {
          forceGraphRef.current.zoomToFit(1500, 200); // Auto-fit with good padding
        }
      }, 1000); // Wait for graph to stabilize
      
    } catch (err) {
      console.error('Error fetching knowledge graph:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Get session ID (copied from api/index.js logic)
  const getSessionId = () => {
    let sessionId = sessionStorage.getItem('synapse_session_id');
    if (!sessionId) {
      let persistentUserId = localStorage.getItem('synapse_user_id');
      if (!persistentUserId) {
        persistentUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('synapse_user_id', persistentUserId);
      }
      sessionId = persistentUserId;
      sessionStorage.setItem('synapse_session_id', sessionId);
    }
    return sessionId;
  };

  const processGraphData = (rawData) => {
    if (!rawData || !rawData.nodes) {
      return { nodes: [], links: [] };
    }

    // Process nodes with much better spread for less clustering
    const nodes = rawData.nodes.map((node, index) => {
      const isCurrentDoc = currentDocumentId && node.document_id == currentDocumentId;
      
      // Much better initial positioning using golden ratio spiral for maximum spread
      const nodeCount = rawData.nodes.length;
      const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // Golden angle
      const angle = index * goldenAngle;
      const baseRadius = Math.max(800, nodeCount * 150); // MUCH larger base radius for spread
      const radius = Math.sqrt(index + 1) * (baseRadius / Math.sqrt(nodeCount));
      
      // Calculate position with maximum spread and randomness for organic look
      const initialX = isCurrentDoc ? 0 : Math.cos(angle) * radius + (Math.random() - 0.5) * 800; // Much larger randomness
      const initialY = isCurrentDoc ? 0 : Math.sin(angle) * radius + (Math.random() - 0.5) * 800;
      
      return {
        ...node,
        // Visual properties for react-force-graph-2d
        val: Math.max(node.size || 8, 12), // Smaller node size for cleaner look
        color: getNodeColor(node, isCurrentDoc),
        // Enhanced properties for better layout
        isCurrentDocument: isCurrentDoc,
        displayName: cleanFileName(node.name || 'Unknown Document'),
        // Set initial positions with good spread
        x: initialX,
        y: initialY,
        // Allow nodes to move freely
        fx: null,
        fy: null,
      };
    });

    // Process links with much longer distances for better spread
    const links = (rawData.links || []).map(link => ({
      ...link,
      // Visual properties based on connection strength
      color: getLinkColor(link.weight),
      width: getLinkWidth(link.weight),
      opacity: getLinkOpacity(link.weight),
      // Much longer link distances for maximum spread
      distance: Math.max(500, 800 - (link.weight * 200)), // Much longer distances for spread
    }));

    return { nodes, links };
  };

  const getNodeColor = (node, isCurrentDoc) => {
    if (node.status !== 'ready') {
      return '#64748b'; // Gray for processing documents
    }
    if (isCurrentDoc) {
      return '#3b82f6'; // Blue for current document - highlighted
    }
    
    // Clean, minimal Obsidian-style coloring - all documents are neutral
    return '#94a3b8'; // Neutral gray for all other documents
  };

  const getLinkColor = (weight) => {
    // Obsidian-style connection colors for dark background
    if (weight > 0.7) return '#f8fafc'; // Very light gray/white for strong connections 
    if (weight >= 0.4) return '#94a3b8'; // Medium gray for medium connections
    return '#475569'; // Darker gray for weak connections
  };

  const getLinkWidth = (weight) => {
    // Very thin lines like Obsidian - thinner than before
    return 0.5; // Much thinner lines for cleaner appearance
  };

  const getLinkOpacity = (weight) => {
    return Math.min(weight + 0.4, 0.8); // Better opacity for dark background
  };

  const cleanFileName = (fileName) => {
    if (!fileName) return 'Unknown Document';
    
    // Minimal cleaning - only remove doc_ prefix with numbers and .pdf extension
    let cleaned = fileName;
    
    // Only remove "doc_[number]_" prefix if it exists
    cleaned = cleaned.replace(/^doc_\d+_/, '');
    
    // Only remove .pdf extension (case insensitive)
    cleaned = cleaned.replace(/\.pdf$/i, '');
    
    // Return full filename without truncation
    return cleaned || fileName;
  };

  // Node interaction handlers with highlighting
  const handleNodeClick = useCallback((node) => {
    console.log(`🌐 Knowledge graph: User clicked on "${node.displayName}"`);
    
    if (node.status === 'ready' && onDocumentSelect) {
      // Close the modal and open the selected document
      onClose();
      onDocumentSelect(node.document_id);
    }
  }, [onClose, onDocumentSelect]);

  const handleNodeHover = useCallback((node) => {
    setHoveredNode(node);
    
    if (node) {
      // Highlight connected nodes and links
      const connectedNodeIds = new Set();
      const connectedLinkIds = new Set();
      
      graphData.links.forEach(link => {
        if (link.source.id === node.id || link.target.id === node.id) {
          connectedLinkIds.add(link);
          connectedNodeIds.add(link.source.id);
          connectedNodeIds.add(link.target.id);
        }
      });
      
      setHighlightNodes(connectedNodeIds);
      setHighlightLinks(connectedLinkIds);
    } else {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
    }
  }, [graphData.links]);

  // Clean node rendering inspired by Obsidian's minimal style
  const renderNode = useCallback((node, ctx, globalScale) => {
    if (!node || typeof node.x !== 'number' || typeof node.y !== 'number') return;
    
    const isHighlighted = highlightNodes.has(node) || hoveredNode === node;
    
    ctx.save();
    
    // Node size calculation - larger for better visibility
    const baseRadius = Math.sqrt(node.val || 16) * 1.2; // Larger nodes
    const finalRadius = Math.max(8, baseRadius) / globalScale;
    
    // Draw main node circle with clean Obsidian-style appearance
    ctx.beginPath();
    ctx.arc(node.x, node.y, finalRadius, 0, 2 * Math.PI);
    
    // Fill with clean colors
    ctx.fillStyle = node.color;
    if (isHighlighted) {
      // Add subtle glow for highlighted nodes
      ctx.shadowColor = node.isCurrentDocument ? '#3b82f6' : '#ffffff';
      ctx.shadowBlur = 8 / globalScale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.fill();
    
    // Clean border for current document
    if (node.isCurrentDocument) {
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }
    
    ctx.shadowColor = 'transparent'; // Reset shadow
    
    // Simple text label below node - extremely small for minimal visual clutter
    if (globalScale > 0.5 && node.displayName) {
      const labelY = node.y + finalRadius + 6 / globalScale;
      const labelFontSize = Math.max(2 / globalScale, 1.5); // Ultra tiny text - almost invisible
      
      ctx.font = `${labelFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      // Truncate text to just first few characters for minimal clutter
      const truncatedText = node.displayName.length > 4 ? 
        node.displayName.substring(0, 20) + '...' : 
        node.displayName;
      
      // Better text colors for dark background with proper contrast
      ctx.fillStyle = node.isCurrentDocument ? '#60a5fa' : '#cbd5e1'; // Better contrast for readability
      ctx.fillText(truncatedText, node.x, labelY);
    }
    
    ctx.restore();
  }, [highlightNodes, hoveredNode]);  // Clean link rendering - Obsidian style
  const renderLink = useCallback((link, ctx) => {
    const { source, target } = link;
    
    // Validate link coordinates
    if (!source || !target || 
        typeof source.x !== 'number' || typeof source.y !== 'number' ||
        typeof target.x !== 'number' || typeof target.y !== 'number' ||
        !isFinite(source.x) || !isFinite(source.y) ||
        !isFinite(target.x) || !isFinite(target.y)) {
      return;
    }
    
    const isHighlighted = highlightLinks.has(link);
    
    ctx.save();
    
    // Clean line styling - very thin lines
    ctx.globalAlpha = isHighlighted ? 1.0 : (link.opacity || 0.6);
    ctx.strokeStyle = isHighlighted ? '#60a5fa' : (link.color || '#475569');
    ctx.lineWidth = isHighlighted ? 1.5 : (link.width || 0.5); // Much thinner lines
    
    // Simple straight lines
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    
    ctx.restore();
  }, [highlightLinks]);

  // Utility function to adjust color brightness
  const adjustColorBrightness = (color, amount) => {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;
    const num = parseInt(col, 16);
    let r = (num >> 16) + amount;
    let g = (num >> 8 & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;
    
    r = r > 255 ? 255 : r < 0 ? 0 : r;
    g = g > 255 ? 255 : g < 0 ? 0 : g;
    b = b > 255 ? 255 : b < 0 ? 0 : b;
    
    return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16);
  };

  // Control functions for better user interaction
  const handleZoomToFit = () => {
    if (forceGraphRef.current) {
      forceGraphRef.current.zoomToFit(1000, 200); // 1s animation, 200px padding for better view
    }
  };

  const handleZoomIn = () => {
    if (forceGraphRef.current) {
      const currentZoom = forceGraphRef.current.zoom();
      forceGraphRef.current.zoom(currentZoom * 1.5, 500); // 0.5s animation
    }
  };

  const handleZoomOut = () => {
    if (forceGraphRef.current) {
      const currentZoom = forceGraphRef.current.zoom();
      forceGraphRef.current.zoom(currentZoom * 0.67, 500); // 0.5s animation
    }
  };

  const handleReset = () => {
    if (forceGraphRef.current) {
      // Reset positions with better spread
      const nodes = graphData.nodes;
      nodes.forEach((node, index) => {
        const nodeCount = nodes.length;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const angle = index * goldenAngle;
        const baseRadius = Math.max(600, nodeCount * 120); // Much larger spread
        const radius = Math.sqrt(index + 1) * (baseRadius / Math.sqrt(nodeCount));
        
        node.fx = null; // Release fixed positions
        node.fy = null;
        node.x = Math.cos(angle) * radius + (Math.random() - 0.5) * 600;
        node.y = Math.sin(angle) * radius + (Math.random() - 0.5) * 600;
      });
      
      // Reset zoom and center
      forceGraphRef.current.centerAt(0, 0, 1000);
      forceGraphRef.current.zoom(0.8, 1000); // Start slightly zoomed out
      
      // Restart the simulation with stronger forces
      forceGraphRef.current.d3ReheatSimulation();
      
      // Then fit to view with good padding
      setTimeout(() => {
        forceGraphRef.current.zoomToFit(1500, 150);
      }, 1000);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Escape' && isVisible) {
        onClose();
      } else if (event.key === 'f' && isVisible) {
        handleZoomToFit();
      } else if (event.key === 'r' && isVisible) {
        handleReset();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyPress);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'unset';
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="knowledge-graph-modal-overlay" onClick={onClose}>
      <div className="knowledge-graph-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="knowledge-graph-header">
          <div className="knowledge-graph-title">
            <Network className="knowledge-graph-icon" size={24} />
            <div>
              <h2>Synapse View</h2>
              <span className="knowledge-graph-subtitle">
                Document Connectivity Graph
              </span>
            </div>
          </div>
          
          {/* Controls */}
          <div className="knowledge-graph-controls">
            <button 
              className="control-button"
              onClick={handleZoomIn}
              title="Zoom In (Scroll Up)"
            >
              <ZoomIn size={18} />
            </button>
            <button 
              className="control-button"
              onClick={handleZoomOut}
              title="Zoom Out (Scroll Down)"
            >
              <ZoomOut size={18} />
            </button>
            <button 
              className="control-button"
              onClick={handleZoomToFit}
              title="Fit to View (F)"
            >
              <Network size={18} />
            </button>
            <button 
              className="control-button"
              onClick={handleReset}
              title="Reset Layout (R)"
            >
              <RotateCcw size={18} />
            </button>
          </div>
          
          <button 
            className="knowledge-graph-close"
            onClick={onClose}
            aria-label="Close knowledge graph"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="knowledge-graph-content">
          {isLoading ? (
            <div className="knowledge-graph-loading">
              <Loader2 className="spin" size={48} />
              <p>Analyzing document connections...</p>
            </div>
          ) : error ? (
            <div className="knowledge-graph-error">
              <AlertCircle size={48} />
              <h3>Unable to generate knowledge graph</h3>
              <p>{error}</p>
              <button 
                className="knowledge-graph-retry"
                onClick={fetchGraphData}
              >
                Try Again
              </button>
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div className="knowledge-graph-empty">
              <Network size={48} />
              <h3>No documents available</h3>
              <p>Upload some documents to see their connections</p>
            </div>
          ) : graphData.links.length === 0 ? (
            <div className="knowledge-graph-no-connections">
              <Network size={48} />
              <h3>No connections found</h3>
              <p>Your documents don't have strong semantic relationships</p>
              <div className="knowledge-graph-isolated-docs">
                {graphData.nodes.map(node => (
                  <div 
                    key={node.id}
                    className="isolated-doc"
                    onClick={() => handleNodeClick(node)}
                    style={{ borderLeftColor: node.color }}
                  >
                    {node.displayName}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="knowledge-graph-container">
              {/* Hover Tooltip */}
              {hoveredNode && (
                <div className="graph-hover-tooltip" style={{
                  position: 'absolute',
                  top: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  zIndex: 20,
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap'
                }}>
                  🔍 {hoveredNode.displayName}
                  {hoveredNode.isCurrentDocument && ' (Current)'}
                </div>
              )}
              
              <ForceGraph2D
                ref={forceGraphRef}
                graphData={graphData}
                nodeCanvasObject={renderNode}
                linkCanvasObject={renderLink}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                onNodeUnhover={() => handleNodeHover(null)}
                enableNodeDrag={true}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                nodeRelSize={1}
                nodeVal="val"
                nodeColor={() => 'transparent'}
                linkColor={() => 'transparent'}
                linkWidth={0}
                backgroundColor="#0f172a" // Dark background like Obsidian
                width={1000} // Larger canvas for better spread
                height={700} // Larger canvas for better spread
                // Enhanced force parameters for maximum spread - dramatically increased
                cooldownTicks={300}
                d3AlphaMin={0.001}
                d3VelocityDecay={0.15}
                d3Force={{
                  charge: {
                    strength: -2500, // MUCH stronger repulsion to prevent clustering
                    distanceMin: 200,
                    distanceMax: 2000
                  },
                  link: {
                    distance: (link) => link.distance || 600, // MUCH longer link distances
                    strength: 0.1 // Very weak link force for maximum spread
                  },
                  center: {
                    strength: 0.01 // Extremely weak centering for natural spread
                  },
                  collision: {
                    radius: (node) => Math.sqrt(node.val) * 6 + 80, // Much larger collision radius
                    strength: 1.0 // Maximum collision prevention
                  }
                }}
                onEngineStop={() => {
                  // No auto-zoom behavior
                }}
              />
              
              {/* Document List */}
              <div className="knowledge-graph-node-list">
                <h4>Documents in Graph</h4>
                <div className="node-list-items">
                  {graphData.nodes.map((node) => (
                    <div 
                      key={node.id}
                      className={`node-list-item ${hoveredNode?.id === node.id ? 'hovered' : ''} ${node.isCurrentDocument ? 'current' : ''}`}
                      onClick={() => handleNodeClick(node)}
                      onMouseEnter={() => handleNodeHover(node)}
                      onMouseLeave={() => handleNodeHover(null)}
                    >
                      <div 
                        className="node-color-indicator"
                        style={{ backgroundColor: node.color }}
                      ></div>
                      <span className="node-name">{node.displayName}</span>
                      {node.isCurrentDocument && (
                        <span className="current-badge">Current</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Simple Legend - Obsidian style */}
              <div className="knowledge-graph-legend">
                <h4>Connection Strength</h4>
                <div className="legend-item">
                  <div 
                    className="legend-line strong" 
                    style={{ backgroundColor: '#f8fafc', width: '40px', height: '2px' }}
                  ></div>
                  <span>Strong (&gt;0.7)</span>
                </div>
                <div className="legend-item">
                  <div 
                    className="legend-line medium" 
                    style={{ backgroundColor: '#94a3b8', width: '40px', height: '2px' }}
                  ></div>
                  <span>Medium (0.4-0.7)</span>
                </div>
                <div className="legend-item">
                  <div 
                    className="legend-line low" 
                    style={{ backgroundColor: '#475569', width: '40px', height: '2px' }}
                  ></div>
                  <span>Low (&lt;0.4)</span>
                </div>
              </div>

              {/* Enhanced Stats */}
              <div className="knowledge-graph-stats">
                <div className="stat">
                  <span className="stat-value">{graphData.nodes.length}</span>
                  <span className="stat-label">Documents</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{graphData.links.length}</span>
                  <span className="stat-label">Connections</span>
                </div>
                {hoveredNode && (
                  <div className="stat hovered">
                    <span className="stat-value">{hoveredNode.displayName}</span>
                    <span className="stat-label">Viewing</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Instructions */}
        <div className="knowledge-graph-instructions">
          <p>
            <strong>💡 Navigate:</strong> Click documents to open • Drag to explore • Scroll to zoom • Hover to highlight connections
          </p>
          <p className="shortcuts">
            <strong>⌨️ Shortcuts:</strong> F = Fit to view • R = Reset layout • ESC = Close
          </p>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphModal;
