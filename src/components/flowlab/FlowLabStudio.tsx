'use client';

import React, { useState, useRef } from 'react';
import {
  Workflow,
  Play,
  Square,
  Plus,
  Copy,
  Download,
  Upload,
  Trash2,
  Database,
  History,
  ListOrdered,
  LayoutGrid,
  CheckCircle2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useFlowLab } from '@/context/FlowLabContext';
import FlowLabCanvas from './FlowLabCanvas';
import StepListView from './StepListView';
import ExecutionsView from './ExecutionsView';
import RecordsView from './RecordsView';
import styles from './FlowLab.module.css';

type ActiveTab = 'canvas' | 'steplist' | 'executions' | 'records';

export default function FlowLabStudio() {
  const {
    workflows,
    activeWorkflowId,
    activeWorkflow,
    setActiveWorkflowId,
    createWorkflow,
    duplicateWorkflow,
    deleteWorkflow,
    updateWorkflow,
    executeWorkflow,
    cancelExecution,
    isExecuting,
    exportWorkflowJson,
    importWorkflowJson,
    executions,
    records,
  } = useFlowLab();

  const [activeTab, setActiveTab] = useState<ActiveTab>('canvas');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartRename = () => {
    if (activeWorkflow) {
      setEditedName(activeWorkflow.name);
      setIsEditingName(true);
    }
  };

  const handleSaveRename = () => {
    if (activeWorkflow && editedName.trim()) {
      updateWorkflow(activeWorkflow.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleRun = async () => {
    if (isExecuting) {
      cancelExecution();
    } else {
      try {
        await executeWorkflow();
      } catch (err: any) {
        console.error('Workflow execution failed:', err);
      }
    }
  };

  const handleExport = () => {
    if (!activeWorkflow) return;
    const jsonStr = exportWorkflowJson(activeWorkflow.id);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeWorkflow.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_flowlab.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importWorkflowJson(content);
        if (!res.success) {
          alert(`Import failed: ${res.error}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className={styles.studioContainer}>
      {/* ── Studio Top Header Bar ── */}
      <header className={styles.topHeader}>
        <div className={styles.brandGroup}>
          <h1 className={styles.brandTitle}>
            <Workflow size={20} color="var(--color-accent)" />
            FlowLab
          </h1>
          <span className={styles.statusPill}>
            <span className={styles.statusDot} />
            Life OS Automation Engine
          </span>
        </div>

        {/* Workflow Selector & Inline Rename */}
        <div className={styles.workflowSelectWrap}>
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
              className={styles.formInput}
              style={{ width: 220, padding: '4px 8px' }}
              autoFocus
            />
          ) : (
            <select
              className={styles.workflowSelect}
              value={activeWorkflowId}
              onChange={(e) => setActiveWorkflowId(e.target.value)}
            >
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name} ({wf.nodes.length} steps)
                </option>
              ))}
            </select>
          )}

          <button
            className={styles.secondaryBtn}
            onClick={handleStartRename}
            title="Rename active workflow"
            style={{ padding: '0 8px', minHeight: 36 }}
          >
            Rename
          </button>

          <button
            className={styles.secondaryBtn}
            onClick={() => duplicateWorkflow(activeWorkflowId)}
            title="Duplicate workflow"
            style={{ padding: '0 8px', minHeight: 36 }}
          >
            <Copy size={14} />
          </button>

          <button
            className={styles.secondaryBtn}
            onClick={() => createWorkflow()}
            title="Create new workflow"
            style={{ padding: '0 8px', minHeight: 36 }}
          >
            <Plus size={14} /> New
          </button>
        </div>

        {/* Studio View Navigation Tabs */}
        <nav className={styles.navTabs} aria-label="FlowLab Views">
          <button
            className={`${styles.tabBtn} ${activeTab === 'canvas' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('canvas')}
          >
            <LayoutGrid size={15} /> Visual Canvas
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'steplist' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('steplist')}
          >
            <ListOrdered size={15} /> Step List
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'executions' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('executions')}
          >
            <History size={15} /> Executions ({executions.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'records' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('records')}
          >
            <Database size={15} /> Records ({records.length})
          </button>
        </nav>

        {/* Primary Action Button (Run / Cancel) & Utilities */}
        <div className={styles.headerActions}>
          <button
            className={`${styles.primaryActionBtn} ${isExecuting ? styles.btnRunning : ''}`}
            onClick={handleRun}
            title={isExecuting ? 'Cancel running workflow' : 'Run workflow immediately'}
          >
            {isExecuting ? (
              <>
                <Square size={16} fill="currentColor" /> Cancel
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" /> Run Workflow
              </>
            )}
          </button>

          <button
            className={styles.secondaryBtn}
            onClick={handleExport}
            title="Export workflow JSON"
            style={{ padding: '0 10px', minHeight: 36 }}
          >
            <Download size={15} /> Export
          </button>

          <button
            className={styles.secondaryBtn}
            onClick={() => fileInputRef.current?.click()}
            title="Import workflow JSON"
            style={{ padding: '0 10px', minHeight: 36 }}
          >
            <Upload size={15} /> Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />

          {workflows.length > 1 && (
            <button
              className={styles.secondaryBtn}
              onClick={() => {
                if (confirm(`Delete "${activeWorkflow?.name}"?`)) {
                  deleteWorkflow(activeWorkflowId);
                }
              }}
              title="Delete workflow"
              style={{ padding: '0 8px', minHeight: 36, color: 'var(--color-danger)' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </header>

      {/* ── Main View Switcher ── */}
      {activeTab === 'canvas' && <FlowLabCanvas />}
      {activeTab === 'steplist' && <StepListView />}
      {activeTab === 'executions' && <ExecutionsView />}
      {activeTab === 'records' && <RecordsView />}
    </div>
  );
}
