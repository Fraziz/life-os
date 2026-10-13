'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Plus,
  Play,
  Settings2,
  Trash2,
  Sliders,
  Globe,
  Database,
  CheckSquare,
  Lightbulb,
  CheckCircle,
  Clock,
  Zap,
  GitBranch,
  Hourglass,
} from 'lucide-react';
import type { FlowNode, FlowConnection, FlowNodeType } from '@/types';
import { useFlowLab } from '@/context/FlowLabContext';
import NodeConfigDrawer from './NodeConfigDrawer';
import AddNodeModal from './AddNodeModal';
import styles from './FlowLab.module.css';

// Node dimensions for Bezier path computations
const NODE_WIDTH = 260;
const NODE_HEIGHT = 110;

const NODE_ICONS: Record<FlowNodeType, React.ComponentType<{ size?: number }>> = {
  manual_trigger: Play,
  schedule_trigger: Clock,
  lifeos_trigger: Zap,
  set_fields: Sliders,
  if_else: GitBranch,
  http_request: Globe,
  delay: Hourglass,
  save_record: Database,
  lifeos_create_task: CheckSquare,
  lifeos_inbox_idea: Lightbulb,
  lifeos_toggle_habit: CheckCircle,
};

export default function FlowLabCanvas() {
  const {
    activeWorkflow,
    updateNode,
    addNode,
    addConnection,
    deleteConnection,
    nodeStates,
    isExecuting,
    executingNodeId,
  } = useFlowLab();

  // Canvas Viewport transformation state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Node Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartPosRef = useRef({ mouseX: 0, mouseY: 0, nodeX: 0, nodeY: 0 });

  // Selected node for config drawer
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Add node modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Port connection mode: source node & handle waiting for a target input port
  const [connectingSource, setConnectingSource] = useState<{
    nodeId: string;
    handle: 'output' | 'true' | 'false';
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Pan and Drag Handlers ─────────────────────────────────────

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Only pan if clicking canvas background, not on a node or button
    if ((e.target as HTMLElement).closest(`.${styles.nodeCard}`) || (e.target as HTMLElement).closest(`.${styles.canvasControls}`)) {
      return;
    }
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
      return;
    }

    if (draggingNodeId && activeWorkflow) {
      const dx = (e.clientX - dragStartPosRef.current.mouseX) / zoom;
      const dy = (e.clientY - dragStartPosRef.current.mouseY) / zoom;
      const newX = Math.max(20, Math.round(dragStartPosRef.current.nodeX + dx));
      const newY = Math.max(20, Math.round(dragStartPosRef.current.nodeY + dy));

      updateNode(draggingNodeId, {
        position: { x: newX, y: newY },
      });
    }
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleNodePointerDown = (e: React.PointerEvent, node: FlowNode) => {
    e.stopPropagation();
    // Don't drag if clicking buttons inside the node
    if ((e.target as HTMLElement).closest('button')) return;

    setDraggingNodeId(node.id);
    dragStartPosRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: node.position.x,
      nodeY: node.position.y,
    };
  };

  // ── Connection Port Handlers ──────────────────────────────────

  const handleOutputPortClick = (e: React.MouseEvent, nodeId: string, handle: 'output' | 'true' | 'false') => {
    e.stopPropagation();
    if (connectingSource && connectingSource.nodeId === nodeId && connectingSource.handle === handle) {
      setConnectingSource(null); // Cancel
    } else {
      setConnectingSource({ nodeId, handle });
    }
  };

  const handleInputPortClick = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    if (connectingSource) {
      if (connectingSource.nodeId !== targetNodeId) {
        addConnection(connectingSource.nodeId, targetNodeId, connectingSource.handle);
      }
      setConnectingSource(null);
    }
  };

  // ── Zoom Controls ─────────────────────────────────────────────

  const handleZoomIn = () => setZoom((z) => Math.min(1.6, z + 0.15));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, z - 0.15));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 40, y: 40 });
  };

  // Fit to screen
  const handleFitScreen = () => {
    if (!activeWorkflow || activeWorkflow.nodes.length === 0) return;
    const xs = activeWorkflow.nodes.map((n) => n.position.x);
    const ys = activeWorkflow.nodes.map((n) => n.position.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + NODE_WIDTH;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys) + NODE_HEIGHT;

    const width = maxX - minX + 100;
    const height = maxY - minY + 100;
    const containerW = containerRef.current?.clientWidth || 1000;
    const containerH = containerRef.current?.clientHeight || 600;

    const scale = Math.min(1.1, Math.max(0.5, Math.min(containerW / width, containerH / height)));
    setZoom(scale);
    setPan({ x: 60 - minX * scale, y: 60 - minY * scale });
  };

  // ── Calculate Bezier Path ─────────────────────────────────────

  const calculatePath = (conn: FlowConnection) => {
    if (!activeWorkflow) return '';
    const fromNode = activeWorkflow.nodes.find((n) => n.id === conn.fromNodeId);
    const toNode = activeWorkflow.nodes.find((n) => n.id === conn.toNodeId);
    if (!fromNode || !toNode) return '';

    // Calculate source handle coordinate
    let startX = fromNode.position.x + NODE_WIDTH;
    let startY = fromNode.position.y + NODE_HEIGHT / 2;

    if (fromNode.type === 'if_else') {
      if (conn.fromHandle === 'true') {
        startY = fromNode.position.y + NODE_HEIGHT * 0.32;
      } else if (conn.fromHandle === 'false') {
        startY = fromNode.position.y + NODE_HEIGHT * 0.68;
      }
    }

    // Calculate target handle coordinate (left-center of target node)
    const endX = toNode.position.x;
    const endY = toNode.position.y + NODE_HEIGHT / 2;

    const deltaX = Math.abs(endX - startX) * 0.55;
    const controlX1 = startX + deltaX;
    const controlX2 = endX - deltaX;

    return `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;
  };

  const selectedNode = activeWorkflow?.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div
      ref={containerRef}
      className={styles.canvasViewport}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ cursor: isPanning ? 'grabbing' : 'default' }}
    >
      {/* Informational banner when drawing a connection */}
      {connectingSource && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            padding: '8px 16px',
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-text-inverse)',
            borderRadius: 20,
            fontSize: '0.8125rem',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>Click on any step’s input port (left handle) to connect</span>
          <button
            onClick={() => setConnectingSource(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-inverse)',
              cursor: 'pointer',
              fontWeight: 700,
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* SVG Canvas Workspace */}
      <div
        className={styles.canvasInner}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* Connection Bezier Curves */}
        <svg className={styles.connectionsSvg}>
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          </defs>

          {activeWorkflow?.connections.map((conn) => {
            const d = calculatePath(conn);
            if (!d) return null;
            const isConnActive = isExecuting && conn.fromNodeId === executingNodeId;

            return (
              <g key={conn.id}>
                {/* Hit area for deleting connection */}
                <path
                  d={d}
                  className={styles.connectionHitArea}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this connection?')) {
                      deleteConnection(conn.id);
                    }
                  }}
                />
                {/* Visual line */}
                <path
                  d={d}
                  className={`${styles.connectionCurve} ${isConnActive ? styles.activePulse : ''}`}
                />
              </g>
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {activeWorkflow?.nodes.map((node) => {
          const Icon = NODE_ICONS[node.type] || Play;
          const execState = nodeStates[node.id];
          const isSelected = selectedNodeId === node.id;
          const isNodeExecuting = isExecuting && executingNodeId === node.id;

          let cardStateClass = '';
          if (isNodeExecuting) cardStateClass = styles.nodeRunning;
          else if (execState?.status === 'success') cardStateClass = styles.nodeSuccess;
          else if (execState?.status === 'error') cardStateClass = styles.nodeError;

          // Category badge class
          let badgeClass = styles.nodeBadgeAction;
          if (['manual_trigger', 'schedule_trigger', 'lifeos_trigger'].includes(node.type)) {
            badgeClass = styles.nodeBadgeTrigger;
          } else if (['set_fields', 'if_else', 'delay'].includes(node.type)) {
            badgeClass = styles.nodeBadgeTransform;
          } else if (node.type.startsWith('lifeos_')) {
            badgeClass = styles.nodeBadgeLifeOS;
          }

          return (
            <div
              key={node.id}
              className={`${styles.nodeCard} ${isSelected ? styles.nodeSelected : ''} ${cardStateClass}`}
              style={{
                left: node.position.x,
                top: node.position.y,
              }}
              onPointerDown={(e) => handleNodePointerDown(e, node)}
              onClick={() => setSelectedNodeId(node.id)}
            >
              {/* Input Port (unless it's a trigger) */}
              {!['manual_trigger', 'schedule_trigger'].includes(node.type) && (
                <div
                  className={styles.handleInput}
                  onClick={(e) => handleInputPortClick(e, node.id)}
                  title="Click to connect as input"
                />
              )}

              {/* Node Card Header */}
              <div className={styles.nodeHeader}>
                <span className={`${styles.nodeBadge} ${badgeClass}`}>
                  {node.type.replace(/lifeos_/g, '').replace(/_/g, ' ')}
                </span>
                <div className={styles.nodeHeaderIcons}>
                  <button
                    className={styles.nodeMiniBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                    title="Configure step"
                  >
                    <Settings2 size={13} />
                  </button>
                </div>
              </div>

              {/* Node Card Body */}
              <div className={styles.nodeBody}>
                <h4 className={styles.nodeTitle}>
                  <Icon size={14} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.title}
                  </span>
                </h4>
                <p className={styles.nodeDesc}>
                  {node.type === 'http_request' && (node.config.url || 'REST endpoint')}
                  {node.type === 'if_else' && `Condition: ${node.config.field || 'key'} ${node.config.operator || '=='}`}
                  {node.type === 'delay' && `Pause: ${node.config.seconds || 2}s`}
                  {node.type === 'save_record' && (node.config.titleTemplate || 'Record capture')}
                  {node.type === 'lifeos_create_task' && (node.config.titleTemplate || 'Task creation')}
                  {node.type === 'lifeos_inbox_idea' && 'Inbox idea parking'}
                  {node.type === 'lifeos_toggle_habit' && 'Habit check-in'}
                  {node.type === 'set_fields' && `${(node.config.mappings || []).length} mapped fields`}
                  {node.type === 'manual_trigger' && 'Payload trigger'}
                  {node.type === 'schedule_trigger' && `${node.config.intervalMinutes || 60}m interval`}
                </p>

                {/* Micro-status Row */}
                <div className={styles.nodeStatusRow}>
                  <div className={styles.nodeStatusIndicator}>
                    <span
                      className={`${styles.statusMicroDot} ${
                        isNodeExecuting
                          ? styles.statusMicroDotRunning
                          : execState?.status === 'success'
                          ? styles.statusMicroDotSuccess
                          : execState?.status === 'error'
                          ? styles.statusMicroDotError
                          : ''
                      }`}
                    />
                    <span>{isNodeExecuting ? 'Running...' : execState?.status || 'Ready'}</span>
                  </div>
                  {execState?.durationMs !== undefined && <span>{execState.durationMs}ms</span>}
                </div>
              </div>

              {/* Output Ports */}
              {node.type === 'if_else' ? (
                <>
                  {/* True Port */}
                  <div
                    className={styles.handleOutputTrue}
                    onClick={(e) => handleOutputPortClick(e, node.id, 'true')}
                    title="Connect True branch output"
                  />
                  <span className={styles.handleLabelTrue}>True</span>

                  {/* False Port */}
                  <div
                    className={styles.handleOutputFalse}
                    onClick={(e) => handleOutputPortClick(e, node.id, 'false')}
                    title="Connect False branch output"
                  />
                  <span className={styles.handleLabelFalse}>False</span>
                </>
              ) : (
                <div
                  className={styles.handleOutput}
                  onClick={(e) => handleOutputPortClick(e, node.id, 'output')}
                  title="Connect output to another step"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Canvas Controls */}
      <div className={styles.canvasControls}>
        <button
          className={styles.ctrlBtn}
          onClick={() => setIsAddModalOpen(true)}
          title="Add step to workflow"
          aria-label="Add step"
        >
          <Plus size={18} />
        </button>
        <span style={{ width: 1, height: 20, backgroundColor: 'var(--color-border-subtle)' }} />
        <button className={styles.ctrlBtn} onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in">
          <ZoomIn size={16} />
        </button>
        <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
        <button className={styles.ctrlBtn} onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out">
          <ZoomOut size={16} />
        </button>
        <button className={styles.ctrlBtn} onClick={handleResetZoom} title="Reset zoom" aria-label="Reset zoom">
          <RotateCcw size={14} />
        </button>
        <button className={styles.ctrlBtn} onClick={handleFitScreen} title="Fit to screen" aria-label="Fit to screen">
          <Maximize2 size={15} />
        </button>
      </div>

      {/* Add Node Modal Catalog */}
      <AddNodeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelectType={(type) => {
          const newNode = addNode(type);
          setSelectedNodeId(newNode.id);
        }}
      />

      {/* Selected Node Configuration Drawer */}
      {selectedNode && (
        <NodeConfigDrawer node={selectedNode} onClose={() => setSelectedNodeId(null)} />
      )}
    </div>
  );
}
