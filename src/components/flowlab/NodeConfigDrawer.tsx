'use client';

import React, { useState } from 'react';
import { X, Trash2, Play, CheckCircle2, AlertCircle, Info, Code } from 'lucide-react';
import type { FlowNode } from '@/types';
import { useFlowLab } from '@/context/FlowLabContext';
import { useHabits } from '@/context/HabitContext';
import styles from './FlowLab.module.css';

interface NodeConfigDrawerProps {
  node: FlowNode;
  onClose: () => void;
}

export default function NodeConfigDrawer({ node, onClose }: NodeConfigDrawerProps) {
  const { updateNode, deleteNode, nodeStates } = useFlowLab();
  const { habits } = useHabits();
  const [activeTab, setActiveTab] = useState<'config' | 'inspect'>('config');

  const executionState = nodeStates[node.id];

  const handleConfigChange = (key: string, value: any) => {
    updateNode(node.id, {
      config: {
        ...node.config,
        [key]: value,
      },
    });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNode(node.id, { title: e.target.value });
  };

  return (
    <div className={styles.configDrawer}>
      <div className={styles.drawerHeader}>
        <div>
          <span className={styles.nodeBadge}>{node.type.replace(/_/g, ' ')}</span>
          <h3 className={styles.drawerTitle} style={{ marginTop: 4 }}>
            Configure Step
          </h3>
        </div>
        <button className={styles.iconBtn} onClick={onClose} aria-label="Close panel">
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-subtle)', padding: '0 20px' }}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'config' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('config')}
          style={{ padding: '10px 16px', borderRadius: 0 }}
        >
          Configuration
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'inspect' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('inspect')}
          style={{ padding: '10px 16px', borderRadius: 0 }}
        >
          Inspection Trace
        </button>
      </div>

      <div className={styles.drawerContent}>
        {activeTab === 'config' ? (
          <>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Step Name</label>
              <input
                className={styles.formInput}
                type="text"
                value={node.title}
                onChange={handleTitleChange}
                placeholder="e.g. Format Data"
              />
            </div>

            {/* Manual Trigger Config */}
            {node.type === 'manual_trigger' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Initial Test JSON Payload</label>
                <textarea
                  className={styles.formTextarea}
                  value={node.config.payload || ''}
                  onChange={(e) => handleConfigChange('payload', e.target.value)}
                  placeholder="{\n  &quot;title&quot;: &quot;Sample Event&quot;\n}"
                />
                <p className={styles.helperText}>
                  This payload is passed down into downstream nodes when triggered.
                </p>
              </div>
            )}

            {/* Schedule Trigger Config */}
            {node.type === 'schedule_trigger' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Interval (Minutes)</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="1"
                  value={node.config.intervalMinutes || 60}
                  onChange={(e) => handleConfigChange('intervalMinutes', Number(e.target.value))}
                />
                <p className={styles.helperText}>Simulates recurring trigger executions.</p>
              </div>
            )}

            {/* Life OS Trigger Config */}
            {node.type === 'lifeos_trigger' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Life OS Event Source</label>
                <select
                  className={styles.formSelect}
                  value={node.config.eventType || 'task_completed'}
                  onChange={(e) => handleConfigChange('eventType', e.target.value)}
                >
                  <option value="task_completed">Task Completed in Life OS</option>
                  <option value="habit_done">Habit Checked Today</option>
                  <option value="idea_added">New Idea Parked in Inbox</option>
                </select>
              </div>
            )}

            {/* Set Fields Config */}
            {node.type === 'set_fields' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Field Mappings</label>
                <p className={styles.helperText}>
                  Use <code>{'{{path.to.field}}'}</code> to reference incoming data.
                </p>
                {(node.config.mappings || []).map((m: any, idx: number) => (
                  <div key={idx} className={styles.mappingRow}>
                    <input
                      className={styles.formInput}
                      placeholder="Output Key"
                      value={m.key}
                      onChange={(e) => {
                        const newMappings = [...(node.config.mappings || [])];
                        newMappings[idx] = { ...newMappings[idx], key: e.target.value };
                        handleConfigChange('mappings', newMappings);
                      }}
                    />
                    <input
                      className={styles.formInput}
                      placeholder="Template (e.g. {{title}})"
                      value={m.template}
                      onChange={(e) => {
                        const newMappings = [...(node.config.mappings || [])];
                        newMappings[idx] = { ...newMappings[idx], template: e.target.value };
                        handleConfigChange('mappings', newMappings);
                      }}
                    />
                    <button
                      className={styles.nodeMiniBtn}
                      onClick={() => {
                        const newMappings = (node.config.mappings || []).filter((_: any, i: number) => i !== idx);
                        handleConfigChange('mappings', newMappings);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  className={styles.secondaryBtn}
                  onClick={() => {
                    const newMappings = [...(node.config.mappings || []), { key: '', template: '' }];
                    handleConfigChange('mappings', newMappings);
                  }}
                  style={{ alignSelf: 'flex-start', marginTop: 6 }}
                >
                  + Add Mapping Field
                </button>
              </div>
            )}

            {/* IF / ELSE Config */}
            {node.type === 'if_else' && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Input Field Path</label>
                  <input
                    className={styles.formInput}
                    placeholder="e.g. priority or data.status"
                    value={node.config.field || ''}
                    onChange={(e) => handleConfigChange('field', e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Condition Operator</label>
                  <select
                    className={styles.formSelect}
                    value={node.config.operator || 'equals'}
                    onChange={(e) => handleConfigChange('operator', e.target.value)}
                  >
                    <option value="equals">Equals (==)</option>
                    <option value="not_equals">Does Not Equal (!=)</option>
                    <option value="contains">Contains Substring</option>
                    <option value="greater_than">Greater Than (&gt;)</option>
                    <option value="is_empty">Is Empty / Null</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Expected Value</label>
                  <input
                    className={styles.formInput}
                    placeholder="e.g. high or 100"
                    value={node.config.value || ''}
                    onChange={(e) => handleConfigChange('value', e.target.value)}
                  />
                  <p className={styles.helperText}>
                    If matched, execution continues along the green <strong>True</strong> port; otherwise down the red <strong>False</strong> port.
                  </p>
                </div>
              </>
            )}

            {/* HTTP Request Config */}
            {node.type === 'http_request' && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>HTTP Method</label>
                  <select
                    className={styles.formSelect}
                    value={node.config.method || 'GET'}
                    onChange={(e) => handleConfigChange('method', e.target.value)}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Destination URL</label>
                  <input
                    className={styles.formInput}
                    placeholder="https://api.example.com/data"
                    value={node.config.url || ''}
                    onChange={(e) => handleConfigChange('url', e.target.value)}
                  />
                </div>
                {['POST', 'PUT'].includes(node.config.method) && (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>JSON Body</label>
                    <textarea
                      className={styles.formTextarea}
                      placeholder="{ &quot;name&quot;: &quot;{{title}}&quot; }"
                      value={node.config.body || ''}
                      onChange={(e) => handleConfigChange('body', e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            {/* Delay Config */}
            {node.type === 'delay' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Wait Duration (Seconds)</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="1"
                  max="10"
                  value={node.config.seconds || 2}
                  onChange={(e) => handleConfigChange('seconds', Number(e.target.value))}
                />
                <p className={styles.helperText}>Non-blocking pause before calling downstream nodes.</p>
              </div>
            )}

            {/* Save Record Config */}
            {node.type === 'save_record' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Record Title Template</label>
                <input
                  className={styles.formInput}
                  placeholder="Record: {{taskTitle}}"
                  value={node.config.titleTemplate || ''}
                  onChange={(e) => handleConfigChange('titleTemplate', e.target.value)}
                />
                <p className={styles.helperText}>Saved into FlowLab’s local database (searchable & exportable).</p>
              </div>
            )}

            {/* Life OS Create Task Config */}
            {node.type === 'lifeos_create_task' && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Task Title Template</label>
                  <input
                    className={styles.formInput}
                    placeholder="{{taskTitle}}"
                    value={node.config.titleTemplate || ''}
                    onChange={(e) => handleConfigChange('titleTemplate', e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Task Priority</label>
                  <select
                    className={styles.formSelect}
                    value={node.config.priority || 'high'}
                    onChange={(e) => handleConfigChange('priority', e.target.value)}
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Task Description</label>
                  <input
                    className={styles.formInput}
                    placeholder="Created automatically via FlowLab"
                    value={node.config.descriptionTemplate || ''}
                    onChange={(e) => handleConfigChange('descriptionTemplate', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Life OS Inbox Idea Config */}
            {node.type === 'lifeos_inbox_idea' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Idea Content Template</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="💡 {{idea}}"
                  value={node.config.contentTemplate || ''}
                  onChange={(e) => handleConfigChange('contentTemplate', e.target.value)}
                />
              </div>
            )}

            {/* Life OS Toggle Habit Config */}
            {node.type === 'lifeos_toggle_habit' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Select Habit to Check</label>
                <select
                  className={styles.formSelect}
                  value={node.config.habitId || ''}
                  onChange={(e) => handleConfigChange('habitId', e.target.value)}
                >
                  {habits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          /* Inspection Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {executionState?.status === 'success' && <CheckCircle2 size={16} color="var(--color-success)" />}
              {executionState?.status === 'error' && <AlertCircle size={16} color="var(--color-danger)" />}
              {(!executionState || executionState.status === 'idle') && <Info size={16} color="var(--color-text-muted)" />}
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                Status: {executionState?.status || 'Not executed yet'}
              </span>
              {executionState?.durationMs !== undefined && (
                <span className={styles.nodeBadge}>{executionState.durationMs}ms</span>
              )}
            </div>

            {executionState?.error && (
              <div style={{ padding: 12, backgroundColor: 'var(--color-danger-dim)', borderRadius: 6, color: 'var(--color-danger)', fontSize: '0.8125rem' }}>
                {executionState.error}
              </div>
            )}

            <div>
              <label className={styles.formLabel}>Last Output Payload</label>
              <pre
                style={{
                  padding: 12,
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {executionState?.output ? JSON.stringify(executionState.output, null, 2) : 'No execution output yet.'}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className={styles.drawerFooter}>
        <button
          className={styles.secondaryBtn}
          onClick={() => {
            deleteNode(node.id);
            onClose();
          }}
          style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger-dim)' }}
        >
          <Trash2 size={16} /> Delete Step
        </button>
        <button className={styles.primaryActionBtn} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
