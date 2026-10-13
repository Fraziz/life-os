'use client';

import React, { useState } from 'react';
import {
  Play,
  Settings2,
  Trash2,
  Plus,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
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
import type { FlowNodeType, FlowNode } from '@/types';
import { useFlowLab } from '@/context/FlowLabContext';
import NodeConfigDrawer from './NodeConfigDrawer';
import AddNodeModal from './AddNodeModal';
import styles from './FlowLab.module.css';

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

export default function StepListView() {
  const { activeWorkflow, addNode, deleteNode, nodeStates, isExecuting, executingNodeId } = useFlowLab();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const selectedNode = activeWorkflow?.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className={styles.viewWrapper}>
      <div className={styles.viewHeader}>
        <div>
          <h2 className={styles.viewTitle}>Step List Sequence</h2>
          <p className={styles.viewSubtitle}>
            Touch-friendly, linearized view of all workflow triggers, actions, and conditional branches.
          </p>
        </div>
        <button className={styles.primaryActionBtn} onClick={() => setIsAddModalOpen(true)}>
          <Plus size={16} /> Add Step
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeWorkflow?.nodes.map((node, index) => {
          const Icon = NODE_ICONS[node.type] || Play;
          const execState = nodeStates[node.id];
          const isNodeExecuting = isExecuting && executingNodeId === node.id;

          return (
            <React.Fragment key={node.id}>
              <div
                className={styles.executionCard}
                style={{
                  cursor: 'pointer',
                  borderColor: isNodeExecuting
                    ? 'var(--color-warning)'
                    : execState?.status === 'success'
                    ? 'var(--color-success)'
                    : undefined,
                }}
                onClick={() => setSelectedNodeId(node.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: 'var(--color-surface-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--color-border-subtle)',
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{node.title}</span>
                        <span className={styles.nodeBadge}>{node.type.replace(/_/g, ' ')}</span>
                      </div>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {node.type === 'http_request' && (node.config.url || 'REST endpoint')}
                        {node.type === 'if_else' && `Condition on: ${node.config.field || 'field'}`}
                        {node.type === 'delay' && `Pause for ${node.config.seconds || 2}s`}
                        {node.type === 'save_record' && (node.config.titleTemplate || 'Record logging')}
                        {node.type === 'lifeos_create_task' && (node.config.titleTemplate || 'Task creation')}
                        {node.type === 'lifeos_inbox_idea' && 'Inbox idea parking'}
                        {node.type === 'set_fields' && 'Field transformation'}
                        {node.type === 'manual_trigger' && 'Payload trigger'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {execState?.durationMs !== undefined && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {execState.durationMs}ms
                      </span>
                    )}
                    <button
                      className={styles.nodeMiniBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                      title="Edit step"
                    >
                      <Settings2 size={16} />
                    </button>
                    <button
                      className={styles.nodeMiniBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNode(node.id);
                      }}
                      title="Delete step"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {index < (activeWorkflow.nodes.length - 1) && (
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                  <ArrowDown size={16} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <AddNodeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelectType={(type) => {
          const newNode = addNode(type);
          setSelectedNodeId(newNode.id);
        }}
      />

      {selectedNode && (
        <NodeConfigDrawer node={selectedNode} onClose={() => setSelectedNodeId(null)} />
      )}
    </div>
  );
}
