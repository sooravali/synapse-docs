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
      
      console.log(`�� Knowledge graph loaded: ${data.nodes?.length || 0} documents, ${data.links?.length || 0} connections`);
      
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

    // Process nodes with MUCH BETTER initial positioning to prevent clustering
    const nodes = rawData.nodes.map((node, index) => {
      const isCurrentDoc = currentDocumentId && node.document_id == currentDocumentId;
      
      // Generate VERY well-spaced initial positions using golden angle spiral
      const nodeCount = rawData.nodes.length;
      const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // Golden angle in radians
      const angle = index * goldenAngle;
      const baseRadius = Math.max(800, nodeCount * 150); // Much larger base radius for better initial spacing
      const radius = Math.sqrt(index + 1) * (baseRadius / Math.sqrt(nodeCount));
      
      // Calculate position with golden spiral distribution for optimal spacing
      const initialX = isCurrentDoc ? 0 : Math.cos(angle) * radius + (Math.random() - 0.5) * 600;
      const initialY = isCurrentDoc ? 0 : Math.sin(angle) * radius + (Math.random() - 0.5) * 600;
      
      return {
        ...node,
        // Visual properties for react-force-graph-2d
        val: Math.max(node.size || 10, 20), // Larger nodes for better visibility
        color: getNodeColor(node, isCurrentDoc),
        // Enhanced properties for better layout
        isCurrentDocument: isCurrentDoc,
        displayName: node.name || 'Unknown Document', // Use original name without any cleaning
        group: getDocumentGroup(node.name),
        // CRITICAL: Set initial positions VERY far apart
        x: initialX,
        y: initialY,
        // Don't fix positions - let them move but start spread out
        fx: null,
        fy: null,
      };
    });

    // Process links with much longer distances to prevent clustering
    const links = (rawData.links || []).map(link => ({
      ...link,
      // Visual properties based on connection strength
      color: getLinkColor(link.weight),
      width: getLinkWidth(link.weight),
      opacity: getLinkOpacity(link.weight),
      // IMPORTANT: Much longer link distances to spread nodes apart like second image
      distance: Math.max(500, 600 - (link.weight * 100)), // Much longer distances for better initial spread
    }));

    return { nodes, links };
  };

  const getNodeColor = (node, isCurrentDoc) => {
    if (node.status !== 'ready') {
      return '#94a3b8'; // Gray for processing documents
    }
    if (isCurrentDoc) {
      return '#3b82f6'; // Blue for current document
    }
    
    // Color by document type for better visual grouping
    const group = getDocumentGroup(node.name);
    const colors = {
      breakfast: '#f59e0b', // Amber
      lunch: '#10b981',     // Emerald
      dinner_mains: '#ef4444', // Red
      dinner_sides: '#8b5cf6', // Purple
      other: '#6b7280'      // Gray
    };
    
    return colors[group] || colors.other;
  };

  const getDocumentGroup = (fileName) => {
    if (!fileName) return 'other';
    const name = fileName.toLowerCase();
    
    if (name.includes('breakfast')) return 'breakfast';
    if (name.includes('lunch')) return 'lunch';
    if (name.includes('dinner') && name.includes('main')) return 'dinner_mains';
    if (name.includes('dinner') && name.includes('side')) return 'dinner_sides';
    
    return 'other';
  };

  const getLinkColor = (weight) => {
    // Use 3-category color system as requested
    if (weight > 0.7) return '#000000'; // Black for strong connections (>0.7)
    if (weight >= 0.4) return '#6b7280'; // Grey for medium connections (0.4-0.7)
    return '#d1d5db'; // Light grey for low connections (<0.4)
  };

  const getLinkWidth = (weight) => {
    // Keep consistent thin line width for all connections
    return 2; // Consistent thin width for all links
  };

  const getLinkOpacity = (weight) => {
    return Math.min(weight + 0.3, 0.8); // Higher opacity for stronger connections
  };

  const cleanFileName = (fileName) => {
    if (!fileName) return 'Unknown Document';
    
    // Minimal cleaning - only remove doc_ prefix with numbers and .pdf extension
    // Keep everything else including full descriptive names
    let cleaned = fileName;
    
    // Only remove "doc_[number]_" prefix if it exists
    cleaned = cleaned.replace(/^doc_\d+_/, '');
    
    // Only remove .pdf extension (case insensitive)
    cleaned = cleaned.replace(/\.pdf$/i, '');
    
    // Return full filename without any truncation whatsoever
    return cleaned || fileName; // Fallback to original if cleaning results in empty string
  };

  // Calculate legend line width based on number of nodes
  const calculateLegendLineWidth = (nodeCount) => {
    // For 2-5 nodes: Fixed bigger length (like reference image)
    if (nodeCount <= 5) {
      return 50; // Bigger fixed length like in reference image
    }
    // For 6+ nodes: Proportional to number of nodes for better view
    return Math.min(50 + (nodeCount - 5) * 3, 80); // Max 80px to prevent too long lines
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

  // Enhanced node rendering with anti-aliasing and labels
  const renderNode = useCallback((node, ctx, globalScale) => {
    // Validate node position - fix for non-finite coordinates
    if (!node || typeof node.x !== 'number' || typeof node.y !== 'number' || 
        !isFinite(node.x) || !isFinite(node.y)) {
      return; // Skip rendering if coordinates are invalid
    }

    const fontSize = Math.max(12 / globalScale, 8);
    const radius = Math.sqrt(node.val || 10) * (globalScale > 1 ? 1.2 : 1.8);
    
    // Validate radius
    if (!isFinite(radius) || radius <= 0) {
      return; // Skip rendering if radius is invalid
    }
    
    // Enhanced rendering for better quality
    ctx.save();
    
    // Node shadow for depth
    if (globalScale > 0.5) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }
    
    // Draw node circle with gradient for better appearance
    const isHighlighted = highlightNodes.has(node.id) || hoveredNode?.id === node.id;
    const finalRadius = isHighlighted ? radius * 1.2 : radius;
    
    if (globalScale > 0.3 && isFinite(finalRadius) && finalRadius > 0) {
      // Gradient fill for better visual appeal
      try {
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, finalRadius
        );
        gradient.addColorStop(0, node.color);
        gradient.addColorStop(1, adjustColorBrightness(node.color, -20));
        ctx.fillStyle = gradient;
      } catch (error) {
        // Fallback to solid color if gradient creation fails
        console.warn('Gradient creation failed, using solid color:', error);
        ctx.fillStyle = node.color;
      }
    } else {
      ctx.fillStyle = node.color;
    }
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, finalRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Border for current document and highlighted nodes
    if (node.isCurrentDocument || isHighlighted) {
      ctx.strokeStyle = node.isCurrentDocument ? '#1e40af' : '#374151';
      ctx.lineWidth = (node.isCurrentDocument ? 3 : 2) / globalScale;
      ctx.stroke();
    }
    
    ctx.shadowColor = 'transparent'; // Reset shadow
    
    // Draw label below the node (like in reference image)
    if (globalScale > 0.4 && node.displayName) {
      const labelY = node.y + finalRadius + 20 / globalScale;
      const labelFontSize = Math.max(10 / globalScale, 8);
      
      ctx.font = `${labelFontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      // Measure text to create background
      const textMetrics = ctx.measureText(node.displayName);
      const textWidth = textMetrics.width;
      const textHeight = labelFontSize;
      const padding = 4 / globalScale;
      
      // Draw completely clear background for labels (no shade/border)
      ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Clean white background
      // No border/stroke for completely clear appearance
      
      // Create rounded rectangle for overlay effect
      const rectX = node.x - textWidth / 2 - padding;
      const rectY = labelY - padding;
      const rectWidth = textWidth + padding * 2;
      const rectHeight = textHeight + padding * 2;
      const cornerRadius = 3 / globalScale;
      
      // Draw rounded rectangle background (clean, no border)
      ctx.beginPath();
      ctx.moveTo(rectX + cornerRadius, rectY);
      ctx.lineTo(rectX + rectWidth - cornerRadius, rectY);
      ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + cornerRadius);
      ctx.lineTo(rectX + rectWidth, rectY + rectHeight - cornerRadius);
      ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - cornerRadius, rectY + rectHeight);
      ctx.lineTo(rectX + cornerRadius, rectY + rectHeight);
      ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - cornerRadius);
      ctx.lineTo(rectX, rectY + cornerRadius);
      ctx.quadraticCurveTo(rectX, rectY, rectX + cornerRadius, rectY);
      ctx.closePath();
      ctx.fill();
      // No stroke for clean appearance
      
      // Draw text with better contrast for readability
      ctx.fillStyle = node.isCurrentDocument ? '#1e40af' : '#1f2937'; // Slightly darker for better readability
      ctx.font = `600 ${labelFontSize}px Arial, sans-serif`; // Make text slightly bolder
      ctx.fillText(node.displayName, node.x, labelY);
    }
    
    ctx.restore();
  }, [highlightNodes, hoveredNode]);

  // Enhanced link rendering with better visual effects
  const renderLink = useCallback((link, ctx) => {
    const { source, target } = link;
    
    // Validate link coordinates
    if (!source || !target || 
        typeof source.x !== 'number' || typeof source.y !== 'number' ||
        typeof target.x !== 'number' || typeof target.y !== 'number' ||
        !isFinite(source.x) || !isFinite(source.y) ||
        !isFinite(target.x) || !isFinite(target.y)) {
      return; // Skip rendering if coordinates are invalid
    }
    
    const isHighlighted = highlightLinks.has(link);
    
    ctx.save();
    
    // Use the correct colors based on connection strength from the legend
    ctx.globalAlpha = isHighlighted ? 0.9 : (link.opacity || 0.7);
    ctx.strokeStyle = isHighlighted ? '#3b82f6' : (link.color || '#d1d5db'); // Use link.color for proper coloring
    ctx.lineWidth = isHighlighted ? (link.width || 2) * 1.5 : (link.width || 2);
    
    // Draw straight links only for cleaner appearance
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
      forceGraphRef.current.zoomToFit(1000, 50); // 1s animation, 50px padding
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
      // Reset zoom and center
      forceGraphRef.current.centerAt(0, 0, 1000);
      forceGraphRef.current.zoom(0.8, 1000); // Start slightly zoomed out
      
      // Reheat simulation with stronger forces to redistribute nodes
      forceGraphRef.current.d3ReheatSimulation();
      
      // Optional: Randomize positions slightly to break symmetry
      const currentData = forceGraphRef.current.graphData();
      if (currentData.nodes) {
        currentData.nodes.forEach(node => {
          if (!node.isCurrentDocument) {
            node.fx = null; // Remove any position fixes
            node.fy = null;
            // Add small random displacement
            node.vx = (Math.random() - 0.5) * 20;
            node.vy = (Math.random() - 0.5) * 20;
          }
        });
      }
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
                backgroundColor="transparent"
                width={900}
                height={650}
                // STRONGER ANTI-CLUSTERING FORCE PARAMETERS
                cooldownTicks={400}
                d3AlphaMin={0.0005}
                d3VelocityDecay={0.1}
                // Charge force (repulsion between nodes) - MUCH STRONGER repulsion
                d3Force={{
                  charge: {
                    strength: -1500, // Even stronger repulsion for better initial spread
                    distanceMin: 120,
                    distanceMax: 1200
                  },
                  link: {
                    distance: (link) => link.distance || 400, // Longer link distances like second image
                    strength: 0.12 // Weaker link force for more spread
                  },
                  center: {
                    strength: 0.02 // Very weak centering force for more spread
                  },
                  collision: {
                    radius: (node) => Math.sqrt(node.val) * 5 + 50, // Larger collision radius for better spacing
                    strength: 1.0 // Strong collision prevention
                  }
                }}
                onEngineStop={() => {
                  // Remove auto-zoom to prevent automatic zooming when panning nodes
                  // User can manually use zoom controls if needed
                }}
              />
              
              {/* EXTERNAL NODE LIST - Document names outside the graph */}
              <div className="knowledge-graph-node-list">
                <h4>Documents in Graph</h4>
                <div className="node-list-items">
                  {graphData.nodes.map((node, index) => (
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
              
              {/* Enhanced Legend */}
              <div className="knowledge-graph-legend">
                <h4>Document Types</h4>
                <div className="legend-item">
                  <div className="legend-node current-doc"></div>
                  <span>Current Document</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node breakfast"></div>
                  <span>Breakfast Ideas</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node lunch"></div>
                  <span>Lunch Ideas</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node dinner-mains"></div>
                  <span>Dinner Mains</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node dinner-sides"></div>
                  <span>Dinner Sides</span>
                </div>
                
                <h4 style={{ marginTop: '16px' }}>Connection Strength</h4>
                <div className="legend-item">
                  <div 
                    className="legend-line color-strong-new" 
                    style={{ width: `${calculateLegendLineWidth(graphData.nodes.length)}px` }}
                  ></div>
                  <span>Strong (&gt;0.7)</span>
                </div>
                <div className="legend-item">
                  <div 
                    className="legend-line color-medium-new" 
                    style={{ width: `${calculateLegendLineWidth(graphData.nodes.length)}px` }}
                  ></div>
                  <span>Medium (0.4-0.7)</span>
                </div>
                <div className="legend-item">
                  <div 
                    className="legend-line color-low-new" 
                    style={{ width: `${calculateLegendLineWidth(graphData.nodes.length)}px` }}
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
