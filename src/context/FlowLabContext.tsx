'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type {
  FlowLabWorkflow,
  FlowNode,
  FlowConnection,
  FlowLabExecution,
  FlowLabExecutionStep,
  FlowLabRecord,
  FlowNodeType,
} from '@/types';
import { useTasks } from './TaskContext';
import { useInbox } from './InboxContext';
import { useHabits } from './HabitContext';
import { loadJsonArray, saveJson } from '@/lib/localStore';

const WORKFLOWS_STORAGE_KEY = 'life_os_flowlab_workflows_v1';
const EXECUTIONS_STORAGE_KEY = 'life_os_flowlab_executions_v1';
const RECORDS_STORAGE_KEY = 'life_os_flowlab_records_v1';

// ── Default Workflows ──────────────────────────────────────────

export const DEFAULT_WORKFLOWS: FlowLabWorkflow[] = [
  {
    id: 'wf-daily-task-gen',
    name: 'Daily Focus Task Generator',
    description: 'Manual trigger that formats payload and instantly creates an actionable task in Life OS with an audit record.',
    isActive: true,
    nodes: [
      {
        id: 'node-1',
        type: 'manual_trigger',
        title: 'Manual Trigger',
        position: { x: 60, y: 160 },
        config: {
          payload: JSON.stringify(
            {
              title: 'Review FlowLab Automation Architecture',
              priority: 'high',
              tags: 'FlowLab, Development',
            },
            null,
            2
          ),
        },
      },
      {
        id: 'node-2',
        type: 'set_fields',
        title: 'Format Task Metadata',
        position: { x: 360, y: 160 },
        config: {
          mappings: [
            { key: 'taskTitle', template: 'FlowLab: {{title}}' },
            { key: 'priority', template: '{{priority}}' },
            { key: 'category', template: 'Focus Space' },
          ],
        },
      },
      {
        id: 'node-3',
        type: 'lifeos_create_task',
        title: 'Create Task in Life OS',
        position: { x: 660, y: 160 },
        config: {
          titleTemplate: '{{taskTitle}}',
          descriptionTemplate: 'Automated task spawned via FlowLab on {{timestamp}}.',
          priority: 'high',
        },
      },
      {
        id: 'node-4',
        type: 'save_record',
        title: 'Save Execution Record',
        position: { x: 960, y: 160 },
        config: {
          titleTemplate: 'Task Spawned: {{taskTitle}}',
        },
      },
    ],
    connections: [
      { id: 'c-1-2', fromNodeId: 'node-1', fromHandle: 'output', toNodeId: 'node-2', toHandle: 'input' },
      { id: 'c-2-3', fromNodeId: 'node-2', fromHandle: 'output', toNodeId: 'node-3', toHandle: 'input' },
      { id: 'c-3-4', fromNodeId: 'node-3', fromHandle: 'output', toNodeId: 'node-4', toHandle: 'input' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wf-quick-inbox-capture',
    name: 'Quick Capture to Idea Parking',
    description: 'Transforms ideas or meeting notes and routes them directly into your Life OS Idea Parking inbox.',
    isActive: true,
    nodes: [
      {
        id: 'node-inbox-1',
        type: 'manual_trigger',
        title: 'Idea Payload',
        position: { x: 60, y: 160 },
        config: {
          payload: JSON.stringify(
            {
              idea: 'Explore WebAudio synthesis micro-game prototype',
              source: 'FlowLab Quick Capture',
            },
            null,
            2
          ),
        },
      },
      {
        id: 'node-inbox-2',
        type: 'delay',
        title: 'Brief Buffer',
        position: { x: 360, y: 160 },
        config: {
          seconds: 1,
        },
      },
      {
        id: 'node-inbox-3',
        type: 'lifeos_inbox_idea',
        title: 'Add to Idea Parking',
        position: { x: 660, y: 160 },
        config: {
          contentTemplate: '💡 {{idea}} (Captured via {{source}})',
        },
      },
      {
        id: 'node-inbox-4',
        type: 'save_record',
        title: 'Log Captured Idea',
        position: { x: 960, y: 160 },
        config: {
          titleTemplate: 'Idea Captured: {{idea}}',
        },
      },
    ],
    connections: [
      { id: 'c-inbox-1-2', fromNodeId: 'node-inbox-1', fromHandle: 'output', toNodeId: 'node-inbox-2', toHandle: 'input' },
      { id: 'c-inbox-2-3', fromNodeId: 'node-inbox-2', fromHandle: 'output', toNodeId: 'node-inbox-3', toHandle: 'input' },
      { id: 'c-inbox-3-4', fromNodeId: 'node-inbox-3', fromHandle: 'output', toNodeId: 'node-inbox-4', toHandle: 'input' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wf-weather-sync',
    name: 'Weather & Energy Observation',
    description: 'Queries a live open meteorology endpoint, evaluates temperature conditions, and saves an ambient environment log.',
    isActive: false,
    nodes: [
      {
        id: 'node-w-1',
        type: 'schedule_trigger',
        title: 'Scheduled Pulse',
        position: { x: 60, y: 180 },
        config: {
          intervalMinutes: 120,
        },
      },
      {
        id: 'node-w-2',
        type: 'http_request',
        title: 'Fetch Metro Weather',
        position: { x: 360, y: 180 },
        config: {
          method: 'GET',
          url: 'https://api.open-meteo.com/v1/forecast?latitude=14.5995&longitude=120.9842&current_weather=true',
        },
      },
      {
        id: 'node-w-3',
        type: 'set_fields',
        title: 'Extract Metrics',
        position: { x: 660, y: 180 },
        config: {
          mappings: [
            { key: 'temperature', template: '{{current_weather.temperature}}' },
            { key: 'windspeed', template: '{{current_weather.windspeed}}' },
            { key: 'weathercode', template: '{{current_weather.weathercode}}' },
          ],
        },
      },
      {
        id: 'node-w-4',
        type: 'save_record',
        title: 'Log Weather Record',
        position: { x: 960, y: 180 },
        config: {
          titleTemplate: 'Ambient Reading: {{temperature}}°C (Wind: {{windspeed}} km/h)',
        },
      },
    ],
    connections: [
      { id: 'c-w-1-2', fromNodeId: 'node-w-1', fromHandle: 'output', toNodeId: 'node-w-2', toHandle: 'input' },
      { id: 'c-w-2-3', fromNodeId: 'node-w-2', fromHandle: 'output', toNodeId: 'node-w-3', toHandle: 'input' },
      { id: 'c-w-3-4', fromNodeId: 'node-w-3', fromHandle: 'output', toNodeId: 'node-w-4', toHandle: 'input' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ── Safe Dot-Notation Template Resolver ────────────────────────

export function resolveSafePath(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

export function interpolateTemplate(template: string, data: Record<string, any>): string {
  if (typeof template !== 'string') return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, path) => {
    const val = resolveSafePath(data, path);
    if (val === undefined || val === null) {
      // If path is top-level and not in data, return empty or keep original
      return '';
    }
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    return String(val);
  });
}

// ── Context Interface ─────────────────────────────────────────

interface NodeExecutionState {
  status: 'idle' | 'running' | 'success' | 'error';
  output?: any;
  error?: string;
  timestamp?: string;
  durationMs?: number;
}

interface FlowLabContextType {
  workflows: FlowLabWorkflow[];
  activeWorkflowId: string;
  activeWorkflow: FlowLabWorkflow | undefined;
  executions: FlowLabExecution[];
  records: FlowLabRecord[];
  isExecuting: boolean;
  executingNodeId: string | null;
  nodeStates: Record<string, NodeExecutionState>;

  setActiveWorkflowId: (id: string) => void;
  createWorkflow: (name?: string, description?: string) => FlowLabWorkflow;
  updateWorkflow: (id: string, updates: Partial<FlowLabWorkflow>) => void;
  duplicateWorkflow: (id: string) => FlowLabWorkflow;
  deleteWorkflow: (id: string) => void;

  addNode: (type: FlowNodeType, position?: { x: number; y: number }) => FlowNode;
  updateNode: (nodeId: string, updates: Partial<FlowNode>) => void;
  deleteNode: (nodeId: string) => void;

  addConnection: (fromNodeId: string, toNodeId: string, fromHandle?: 'output' | 'true' | 'false') => void;
  deleteConnection: (connectionId: string) => void;

  executeWorkflow: (workflowId?: string) => Promise<FlowLabExecution>;
  cancelExecution: () => void;

  clearExecutions: () => void;
  deleteExecution: (id: string) => void;

  deleteRecord: (id: string) => void;
  clearRecords: () => void;
  exportRecordsAsCsv: () => string;
  exportRecordsAsJson: () => string;

  importWorkflowJson: (jsonStr: string) => { success: boolean; error?: string };
  exportWorkflowJson: (workflowId?: string) => string;
}

const FlowLabContext = createContext<FlowLabContextType | undefined>(undefined);

export function FlowLabProvider({ children }: { children: React.ReactNode }) {
  const { addTask } = useTasks();
  const { quickDump } = useInbox();
  const { toggleHabitCheckIn } = useHabits();

  const [workflows, setWorkflows] = useState<FlowLabWorkflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>('');
  const [executions, setExecutions] = useState<FlowLabExecution[]>([]);
  const [records, setRecords] = useState<FlowLabRecord[]>([]);

  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);
  const [nodeStates, setNodeStates] = useState<Record<string, NodeExecutionState>>({});
  const [isCanceled, setIsCanceled] = useState<boolean>(false);

  // ── Load from Local Storage on mount ─────────────────────────
  useEffect(() => {
    try {
      const storedWorkflows = loadJsonArray<FlowLabWorkflow>(WORKFLOWS_STORAGE_KEY);
      if (storedWorkflows && storedWorkflows.length > 0) {
        setWorkflows(storedWorkflows);
        setActiveWorkflowId(storedWorkflows[0].id);
      } else {
        setWorkflows(DEFAULT_WORKFLOWS);
        setActiveWorkflowId(DEFAULT_WORKFLOWS[0].id);
        saveJson(WORKFLOWS_STORAGE_KEY, DEFAULT_WORKFLOWS);
      }

      const storedExecutions = loadJsonArray<FlowLabExecution>(EXECUTIONS_STORAGE_KEY);
      if (storedExecutions) setExecutions(storedExecutions);

      const storedRecords = loadJsonArray<FlowLabRecord>(RECORDS_STORAGE_KEY);
      if (storedRecords) setRecords(storedRecords);
    } catch (e) {
      console.error('Failed to initialize FlowLab storage:', e);
    }
  }, []);

  // ── Auto-save workflows ──────────────────────────────────────
  const persistWorkflows = useCallback((list: FlowLabWorkflow[]) => {
    setWorkflows(list);
    saveJson(WORKFLOWS_STORAGE_KEY, list);
  }, []);

  const persistExecutions = useCallback((list: FlowLabExecution[]) => {
    setExecutions(list);
    saveJson(EXECUTIONS_STORAGE_KEY, list);
  }, []);

  const persistRecords = useCallback((list: FlowLabRecord[]) => {
    setRecords(list);
    saveJson(RECORDS_STORAGE_KEY, list);
  }, []);

  const activeWorkflow = useMemo(() => {
    return workflows.find((w) => w.id === activeWorkflowId) || workflows[0];
  }, [workflows, activeWorkflowId]);

  // ── Workflow Management ──────────────────────────────────────

  const createWorkflow = useCallback((name = 'New Automation Flow', description = 'Visual workflow canvas') => {
    const newWorkflow: FlowLabWorkflow = {
      id: `wf-${Date.now()}`,
      name,
      description,
      isActive: true,
      nodes: [
        {
          id: `node-${Date.now()}-1`,
          type: 'manual_trigger',
          title: 'Manual Trigger',
          position: { x: 80, y: 160 },
          config: {
            payload: JSON.stringify({ title: 'New Trigger Event', count: 1 }, null, 2),
          },
        },
      ],
      connections: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistWorkflows([newWorkflow, ...workflows]);
    setActiveWorkflowId(newWorkflow.id);
    return newWorkflow;
  }, [workflows, persistWorkflows]);

  const updateWorkflow = useCallback((id: string, updates: Partial<FlowLabWorkflow>) => {
    const updated = workflows.map((w) => {
      if (w.id === id) {
        return { ...w, ...updates, updatedAt: new Date().toISOString() };
      }
      return w;
    });
    persistWorkflows(updated);
  }, [workflows, persistWorkflows]);

  const duplicateWorkflow = useCallback((id: string) => {
    const target = workflows.find((w) => w.id === id);
    if (!target) return createWorkflow();
    const cloned: FlowLabWorkflow = {
      ...target,
      id: `wf-${Date.now()}`,
      name: `${target.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistWorkflows([cloned, ...workflows]);
    setActiveWorkflowId(cloned.id);
    return cloned;
  }, [workflows, createWorkflow, persistWorkflows]);

  const deleteWorkflow = useCallback((id: string) => {
    if (workflows.length <= 1) return;
    const remaining = workflows.filter((w) => w.id !== id);
    persistWorkflows(remaining);
    setActiveWorkflowId(remaining[0].id);
  }, [workflows, persistWorkflows]);

  // ── Node & Connection Editing ────────────────────────────────

  const addNode = useCallback((type: FlowNodeType, position?: { x: number; y: number }) => {
    if (!activeWorkflow) throw new Error('No active workflow');
    const nodeId = `node-${Date.now()}`;
    const defaultPos = position || {
      x: 100 + (activeWorkflow.nodes.length % 5) * 280,
      y: 160 + Math.floor(activeWorkflow.nodes.length / 5) * 120,
    };

    let title = 'Step';
    let config: Record<string, any> = {};

    switch (type) {
      case 'manual_trigger':
        title = 'Manual Trigger';
        config = { payload: '{\n  "title": "Trigger Event"\n}' };
        break;
      case 'schedule_trigger':
        title = 'Schedule Trigger';
        config = { intervalMinutes: 60 };
        break;
      case 'lifeos_trigger':
        title = 'Life OS Event';
        config = { eventType: 'task_completed' };
        break;
      case 'set_fields':
        title = 'Set Fields';
        config = { mappings: [{ key: 'taskTitle', template: '{{title}}' }] };
        break;
      case 'if_else':
        title = 'IF / ELSE';
        config = { field: 'priority', operator: 'equals', value: 'high' };
        break;
      case 'http_request':
        title = 'HTTP Request';
        config = { method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1' };
        break;
      case 'delay':
        title = 'Delay';
        config = { seconds: 2 };
        break;
      case 'save_record':
        title = 'Save Record';
        config = { titleTemplate: 'Automated Record' };
        break;
      case 'lifeos_create_task':
        title = 'Create Life OS Task';
        config = { titleTemplate: '{{taskTitle}}', priority: 'medium' };
        break;
      case 'lifeos_inbox_idea':
        title = 'Add Idea to Inbox';
        config = { contentTemplate: '{{idea}}' };
        break;
      case 'lifeos_toggle_habit':
        title = 'Check Habit';
        config = { habitId: 'habit-game' };
        break;
    }

    const newNode: FlowNode = {
      id: nodeId,
      type,
      title,
      position: defaultPos,
      config,
    };

    updateWorkflow(activeWorkflow.id, {
      nodes: [...activeWorkflow.nodes, newNode],
    });

    return newNode;
  }, [activeWorkflow, updateWorkflow]);

  const updateNode = useCallback((nodeId: string, updates: Partial<FlowNode>) => {
    if (!activeWorkflow) return;
    const newNodes = activeWorkflow.nodes.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          ...updates,
          config: updates.config ? { ...n.config, ...updates.config } : n.config,
        };
      }
      return n;
    });
    updateWorkflow(activeWorkflow.id, { nodes: newNodes });
  }, [activeWorkflow, updateWorkflow]);

  const deleteNode = useCallback((nodeId: string) => {
    if (!activeWorkflow) return;
    const newNodes = activeWorkflow.nodes.filter((n) => n.id !== nodeId);
    const newConns = activeWorkflow.connections.filter(
      (c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId
    );
    updateWorkflow(activeWorkflow.id, { nodes: newNodes, connections: newConns });
  }, [activeWorkflow, updateWorkflow]);

  const addConnection = useCallback((fromNodeId: string, toNodeId: string, fromHandle: 'output' | 'true' | 'false' = 'output') => {
    if (!activeWorkflow) return;
    if (fromNodeId === toNodeId) return; // avoid self loops

    // Prevent duplicate connections
    const exists = activeWorkflow.connections.some(
      (c) => c.fromNodeId === fromNodeId && c.toNodeId === toNodeId && c.fromHandle === fromHandle
    );
    if (exists) return;

    const newConn: FlowConnection = {
      id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fromNodeId,
      fromHandle,
      toNodeId,
      toHandle: 'input',
    };

    updateWorkflow(activeWorkflow.id, {
      connections: [...activeWorkflow.connections, newConn],
    });
  }, [activeWorkflow, updateWorkflow]);

  const deleteConnection = useCallback((connectionId: string) => {
    if (!activeWorkflow) return;
    const newConns = activeWorkflow.connections.filter((c) => c.id !== connectionId);
    updateWorkflow(activeWorkflow.id, { connections: newConns });
  }, [activeWorkflow, updateWorkflow]);

  // ── Execution Engine ──────────────────────────────────────────

  const cancelExecution = useCallback(() => {
    setIsCanceled(true);
  }, []);

  const executeWorkflow = useCallback(async (targetWorkflowId?: string): Promise<FlowLabExecution> => {
    const wf = workflows.find((w) => w.id === (targetWorkflowId || activeWorkflowId)) || activeWorkflow;
    if (!wf || wf.nodes.length === 0) {
      throw new Error('Workflow has no steps to execute');
    }

    setIsExecuting(true);
    setIsCanceled(false);

    // Reset node states
    const initialStates: Record<string, NodeExecutionState> = {};
    wf.nodes.forEach((n) => {
      initialStates[n.id] = { status: 'idle' };
    });
    setNodeStates(initialStates);

    const startedAt = new Date().toISOString();
    const startTime = performance.now();
    const executionSteps: FlowLabExecutionStep[] = [];
    let overallStatus: 'completed' | 'failed' | 'canceled' = 'completed';
    let errorMessage: string | undefined;

    // Identify trigger nodes
    const triggerNodes = wf.nodes.filter((n) =>
      ['manual_trigger', 'schedule_trigger', 'lifeos_trigger'].includes(n.type)
    );
    const startNode = triggerNodes[0] || wf.nodes[0];

    // Execution queue
    let currentNode: FlowNode | null = startNode;
    let currentPayload: any = { timestamp: new Date().toISOString() };
    const visitedNodes = new Set<string>();

    try {
      while (currentNode && !isCanceled) {
        const stepNode: FlowNode = currentNode;
        const stepNodeId = stepNode.id;

        visitedNodes.add(stepNodeId);
        setExecutingNodeId(stepNodeId);
        setNodeStates((prev) => ({
          ...prev,
          [stepNodeId]: { status: 'running' },
        }));

        const stepStartTime = performance.now();
        let stepOutput: any = { ...currentPayload };
        let stepError: string | undefined;
        let branchResult: 'true' | 'false' | 'output' = 'output';

        try {
          switch (stepNode.type) {
            case 'manual_trigger': {
              if (stepNode.config.payload) {
                try {
                  stepOutput = { ...stepOutput, ...JSON.parse(stepNode.config.payload) };
                } catch {
                  stepOutput = { ...stepOutput, text: stepNode.config.payload };
                }
              }
              break;
            }

            case 'schedule_trigger': {
              stepOutput = {
                ...stepOutput,
                interval: stepNode.config.intervalMinutes || 60,
                triggeredAt: new Date().toISOString(),
              };
              break;
            }

            case 'lifeos_trigger': {
              stepOutput = {
                ...stepOutput,
                event: stepNode.config.eventType || 'task_created',
                triggeredAt: new Date().toISOString(),
              };
              break;
            }

            case 'set_fields': {
              const mappings = stepNode.config.mappings || [];
              const transformed: Record<string, any> = { ...currentPayload };
              mappings.forEach((m: { key: string; template: string }) => {
                if (m.key) {
                  transformed[m.key] = interpolateTemplate(m.template || '', currentPayload);
                }
              });
              stepOutput = transformed;
              break;
            }

            case 'if_else': {
              const field = stepNode.config.field || '';
              const operator = stepNode.config.operator || 'equals';
              const targetVal = stepNode.config.value ?? '';
              const actualVal = resolveSafePath(currentPayload, field);

              let conditionMet = false;
              if (operator === 'equals') conditionMet = String(actualVal) === String(targetVal);
              else if (operator === 'not_equals') conditionMet = String(actualVal) !== String(targetVal);
              else if (operator === 'contains') conditionMet = String(actualVal).toLowerCase().includes(String(targetVal).toLowerCase());
              else if (operator === 'greater_than') conditionMet = Number(actualVal) > Number(targetVal);
              else if (operator === 'is_empty') conditionMet = actualVal === undefined || actualVal === null || actualVal === '';
              else conditionMet = Boolean(actualVal);

              branchResult = conditionMet ? 'true' : 'false';
              stepOutput = {
                ...currentPayload,
                _conditionResult: conditionMet,
                _branch: branchResult,
              };
              break;
            }

            case 'http_request': {
              const method = stepNode.config.method || 'GET';
              const url = interpolateTemplate(stepNode.config.url || '', currentPayload);
              if (!url) throw new Error('Missing target URL');

              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 10000);

              let bodyData: any = undefined;
              if (['POST', 'PUT', 'PATCH'].includes(method) && stepNode.config.body) {
                bodyData = interpolateTemplate(stepNode.config.body, currentPayload);
              }

              const res = await fetch(url, {
                method,
                signal: controller.signal,
                headers: {
                  'Content-Type': 'application/json',
                  ...(stepNode.config.headers || {}),
                },
                body: bodyData,
              });
              clearTimeout(timeout);

              const contentType = res.headers.get('content-type') || '';
              let resData: any;
              if (contentType.includes('application/json')) {
                resData = await res.json();
              } else {
                resData = await res.text();
              }

              stepOutput = {
                ...currentPayload,
                httpStatus: res.status,
                httpOk: res.ok,
                response: resData,
                ...(typeof resData === 'object' && resData !== null ? resData : {}),
              };
              break;
            }

            case 'delay': {
              const seconds = Math.min(Math.max(Number(stepNode.config.seconds) || 1, 1), 10);
              await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
              stepOutput = { ...currentPayload, delayedSeconds: seconds };
              break;
            }

            case 'lifeos_create_task': {
              const taskTitle = interpolateTemplate(
                stepNode.config.titleTemplate || 'New Automated Task',
                currentPayload
              );
              const taskDesc = interpolateTemplate(
                stepNode.config.descriptionTemplate || 'Automated by FlowLab',
                currentPayload
              );
              const created = addTask({
                title: taskTitle || 'Automated Task',
                description: taskDesc,
                priority: stepNode.config.priority || 'high',
                tags: ['FlowLab', 'Automated'],
                status: 'todo',
                subtasks: [],
              });
              stepOutput = {
                ...currentPayload,
                createdTaskId: created.id,
                createdTaskTitle: created.title,
              };
              break;
            }

            case 'lifeos_inbox_idea': {
              const ideaText = interpolateTemplate(
                stepNode.config.contentTemplate || 'New Idea from FlowLab',
                currentPayload
              );
              quickDump(ideaText || 'Captured FlowLab idea');
              stepOutput = {
                ...currentPayload,
                capturedIdea: ideaText,
              };
              break;
            }

            case 'lifeos_toggle_habit': {
              const habitId = stepNode.config.habitId || 'habit-game';
              toggleHabitCheckIn(habitId);
              stepOutput = {
                ...currentPayload,
                toggledHabitId: habitId,
              };
              break;
            }

            case 'save_record': {
              const recTitle = interpolateTemplate(
                stepNode.config.titleTemplate || 'Flow Record',
                currentPayload
              );
              const newRec: FlowLabRecord = {
                id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                workflowId: wf.id,
                workflowName: wf.name,
                title: recTitle || 'Automated Record',
                data: currentPayload,
                createdAt: new Date().toISOString(),
              };
              persistRecords([newRec, ...records]);
              stepOutput = { ...currentPayload, savedRecordId: newRec.id };
              break;
            }

            default:
              stepOutput = { ...currentPayload };
          }
        } catch (err: any) {
          stepError = err?.message || 'Execution error';
          overallStatus = 'failed';
          errorMessage = stepError;
        }

        const stepDuration = Math.round(performance.now() - stepStartTime);

        executionSteps.push({
          nodeId: stepNodeId,
          nodeTitle: stepNode.title,
          nodeType: stepNode.type,
          status: stepError ? 'error' : 'success',
          inputData: currentPayload,
          outputData: stepOutput,
          durationMs: stepDuration,
          errorMessage: stepError,
          timestamp: new Date().toISOString(),
        });

        setNodeStates((prev) => ({
          ...prev,
          [stepNodeId]: {
            status: stepError ? 'error' : 'success',
            output: stepOutput,
            error: stepError,
            durationMs: stepDuration,
            timestamp: new Date().toLocaleTimeString(),
          },
        }));

        if (stepError) {
          break; // Halt on error
        }

        // Advance payload
        currentPayload = stepOutput;

        // Determine next node
        const outgoingConnections = wf.connections.filter(
          (c) => c.fromNodeId === stepNodeId
        );

        let nextConn: FlowConnection | undefined;
        if (stepNode.type === 'if_else') {
          nextConn = outgoingConnections.find((c) => c.fromHandle === branchResult);
          if (!nextConn) nextConn = outgoingConnections.find((c) => !c.fromHandle || c.fromHandle === 'output');
        } else {
          nextConn = outgoingConnections[0];
        }

        if (nextConn) {
          const nextTarget = wf.nodes.find((n) => n.id === nextConn!.toNodeId);
          if (nextTarget && !visitedNodes.has(nextTarget.id)) {
            currentNode = nextTarget;
          } else {
            currentNode = null;
          }
        } else {
          currentNode = null;
        }
      }
    } finally {
      setIsExecuting(false);
      setExecutingNodeId(null);
    }

    const durationMs = Math.round(performance.now() - startTime);
    const executionResult: FlowLabExecution = {
      id: `exec-${Date.now()}`,
      workflowId: wf.id,
      workflowName: wf.name,
      status: isCanceled ? 'canceled' : overallStatus,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs,
      steps: executionSteps,
      finalOutput: currentPayload,
      error: errorMessage,
    };

    const updatedExecutions = [executionResult, ...executions].slice(0, 50);
    persistExecutions(updatedExecutions);

    return executionResult;
  }, [
    workflows,
    activeWorkflowId,
    activeWorkflow,
    isCanceled,
    addTask,
    quickDump,
    toggleHabitCheckIn,
    persistRecords,
    records,
    executions,
    persistExecutions,
  ]);

  // ── History & Record Management ──────────────────────────────

  const clearExecutions = useCallback(() => {
    persistExecutions([]);
  }, [persistExecutions]);

  const deleteExecution = useCallback((id: string) => {
    persistExecutions(executions.filter((e) => e.id !== id));
  }, [executions, persistExecutions]);

  const deleteRecord = useCallback((id: string) => {
    persistRecords(records.filter((r) => r.id !== id));
  }, [records, persistRecords]);

  const clearRecords = useCallback(() => {
    persistRecords([]);
  }, [persistRecords]);

  const exportRecordsAsCsv = useCallback(() => {
    if (records.length === 0) return '';
    const headers = ['id', 'workflowName', 'title', 'createdAt', 'data'];
    const rows = records.map((r) => [
      r.id,
      `"${(r.workflowName || '').replace(/"/g, '""')}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      r.createdAt,
      `"${JSON.stringify(r.data || {}).replace(/"/g, '""')}"`,
    ]);
    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }, [records]);

  const exportRecordsAsJson = useCallback(() => {
    return JSON.stringify(records, null, 2);
  }, [records]);

  // ── Workflow JSON Import / Export ────────────────────────────

  const exportWorkflowJson = useCallback((workflowId?: string) => {
    const wf = workflows.find((w) => w.id === (workflowId || activeWorkflowId)) || activeWorkflow;
    if (!wf) return '{}';
    return JSON.stringify(
      {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        flow: wf,
      },
      null,
      2
    );
  }, [workflows, activeWorkflowId, activeWorkflow]);

  const importWorkflowJson = useCallback((jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const flowData = parsed.flow || parsed;
      if (!flowData.name || !Array.isArray(flowData.nodes)) {
        return { success: false, error: 'Invalid workflow format: missing name or nodes.' };
      }
      const imported: FlowLabWorkflow = {
        id: `wf-${Date.now()}`,
        name: `${flowData.name} (Imported)`,
        description: flowData.description || 'Imported flow',
        isActive: true,
        nodes: flowData.nodes || [],
        connections: flowData.connections || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      persistWorkflows([imported, ...workflows]);
      setActiveWorkflowId(imported.id);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'JSON parse failed' };
    }
  }, [workflows, persistWorkflows]);

  return (
    <FlowLabContext.Provider
      value={{
        workflows,
        activeWorkflowId,
        activeWorkflow,
        executions,
        records,
        isExecuting,
        executingNodeId,
        nodeStates,
        setActiveWorkflowId,
        createWorkflow,
        updateWorkflow,
        duplicateWorkflow,
        deleteWorkflow,
        addNode,
        updateNode,
        deleteNode,
        addConnection,
        deleteConnection,
        executeWorkflow,
        cancelExecution,
        clearExecutions,
        deleteExecution,
        deleteRecord,
        clearRecords,
        exportRecordsAsCsv,
        exportRecordsAsJson,
        importWorkflowJson,
        exportWorkflowJson,
      }}
    >
      {children}
    </FlowLabContext.Provider>
  );
}

export function useFlowLab() {
  const ctx = useContext(FlowLabContext);
  if (!ctx) {
    throw new Error('useFlowLab must be used within a FlowLabProvider');
  }
  return ctx;
}
