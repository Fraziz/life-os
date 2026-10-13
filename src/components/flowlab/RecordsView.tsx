'use client';

import React, { useState } from 'react';
import { Database, Download, Search, Trash2, FileText } from 'lucide-react';
import { useFlowLab } from '@/context/FlowLabContext';
import styles from './FlowLab.module.css';

export default function RecordsView() {
  const { records, deleteRecord, clearRecords, exportRecordsAsCsv, exportRecordsAsJson } = useFlowLab();
  const [search, setSearch] = useState('');

  const filtered = records.filter(
    (r) =>
      (r.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.workflowName || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDownloadCsv = () => {
    const csvContent = exportRecordsAsCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `flowlab_records_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadJson = () => {
    const jsonContent = exportRecordsAsJson();
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `flowlab_records_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.viewWrapper}>
      <div className={styles.viewHeader}>
        <div>
          <h2 className={styles.viewTitle}>Saved Records Database</h2>
          <p className={styles.viewSubtitle}>
            Browse, inspect, and export persistent records captured across automated workflows.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {records.length > 0 && (
            <>
              <button className={styles.secondaryBtn} onClick={handleDownloadCsv}>
                <Download size={14} /> Export CSV
              </button>
              <button className={styles.secondaryBtn} onClick={handleDownloadJson}>
                <Download size={14} /> Export JSON
              </button>
              <button
                className={styles.secondaryBtn}
                onClick={() => {
                  if (confirm('Clear all saved records?')) {
                    clearRecords();
                  }
                }}
              >
                <Trash2 size={14} /> Clear
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16, maxWidth: 360, position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          placeholder="Search records or source flows..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.formInput}
          style={{ paddingLeft: 36 }}
        />
      </div>

      {records.length === 0 ? (
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
          <Database size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
          <h4 style={{ margin: 0, color: 'var(--color-text)' }}>No records logged yet</h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem' }}>
            Add a <strong>Save Record</strong> step to any flow to start capturing data here.
          </p>
        </div>
      ) : (
        <div className={styles.recordsTableWrap}>
          <table className={styles.recordsTable}>
            <thead>
              <tr>
                <th>Record Title</th>
                <th>Source Flow</th>
                <th>Timestamp</th>
                <th>Captured Data</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => (
                <tr key={rec.id}>
                  <td style={{ fontWeight: 600 }}>{rec.title}</td>
                  <td>
                    <span className={styles.nodeBadge}>{rec.workflowName}</span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(rec.createdAt).toLocaleDateString()} {new Date(rec.createdAt).toLocaleTimeString()}
                  </td>
                  <td>
                    <div className={styles.jsonViewer} title={JSON.stringify(rec.data)}>
                      {JSON.stringify(rec.data)}
                    </div>
                  </td>
                  <td>
                    <button
                      className={styles.nodeMiniBtn}
                      onClick={() => deleteRecord(rec.id)}
                      title="Delete record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
