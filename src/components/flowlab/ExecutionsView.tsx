'use client';

import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
  Code,
} from 'lucide-react';
import { useFlowLab } from '@/context/FlowLabContext';
import styles from './FlowLab.module.css';

export default function ExecutionsView() {
  const { executions, clearExecutions, deleteExecution } = useFlowLab();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className={styles.viewWrapper}>
      <div className={styles.viewHeader}>
        <div>
          <h2 className={styles.viewTitle}>Execution History</h2>
          <p className={styles.viewSubtitle}>
            Inspect previous runs, timing benchmarks, step outputs, and error diagnostics.
          </p>
        </div>
        {executions.length > 0 && (
          <button
            className={styles.secondaryBtn}
            onClick={() => {
              if (confirm('Clear all execution logs?')) {
                clearExecutions();
              }
            }}
          >
            <Trash2 size={15} /> Clear History
          </button>
        )}
      </div>

      {executions.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 8,
            color: 'var(--color-text-muted)',
          }}
        >
          <Clock size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
          <h4 style={{ margin: 0, color: 'var(--color-text)' }}>No runs logged yet</h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem' }}>
            Click <strong>Run Workflow</strong> on the canvas to execute your first automated flow.
          </p>
        </div>
      ) : (
        <div className={styles.executionsList}>
          {executions.map((exec) => {
            const isExpanded = expandedId === exec.id;
            const isSuccess = exec.status === 'completed';

            return (
              <div key={exec.id} className={styles.executionCard}>
                <div
                  className={styles.executionTop}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleExpand(exec.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{exec.workflowName}</span>
                        <span className={isSuccess ? styles.statusCompleted : styles.statusFailed}>
                          {exec.status.toUpperCase()}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {new Date(exec.startedAt).toLocaleString()} • Duration: {exec.durationMs}ms •{' '}
                        {exec.steps.length} steps executed
                      </span>
                    </div>
                  </div>

                  <button
                    className={styles.nodeMiniBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteExecution(exec.id);
                    }}
                    title="Delete run log"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {exec.error && (
                  <div
                    style={{
                      padding: 10,
                      backgroundColor: 'var(--color-danger-dim)',
                      color: 'var(--color-danger)',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      marginBottom: 10,
                    }}
                  >
                    Error: {exec.error}
                  </div>
                )}

                {/* Expanded Step Trace */}
                {isExpanded && (
                  <div className={styles.stepsTimeline}>
                    {exec.steps.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 10,
                          backgroundColor: 'var(--color-surface-2)',
                          borderRadius: 6,
                          marginBottom: 6,
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div className={styles.stepItem}>
                          <span style={{ fontWeight: 600 }}>
                            {idx + 1}. {step.nodeTitle} ({step.nodeType})
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem' }}>
                            {step.durationMs}ms
                          </span>
                        </div>

                        {step.errorMessage && (
                          <p style={{ color: 'var(--color-danger)', fontSize: '0.75rem', margin: '4px 0' }}>
                            {step.errorMessage}
                          </p>
                        )}

                        <div style={{ marginTop: 8 }}>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                            Output Payload:
                          </span>
                          <pre
                            style={{
                              margin: '4px 0 0 0',
                              padding: 8,
                              backgroundColor: 'var(--color-surface)',
                              borderRadius: 4,
                              fontSize: '0.6875rem',
                              fontFamily: 'var(--font-mono, monospace)',
                              overflowX: 'auto',
                            }}
                          >
                            {JSON.stringify(step.outputData || {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
