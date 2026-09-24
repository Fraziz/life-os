'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useHabits } from '@/context/HabitContext';
import { chatWithAssistant } from '@/utils/aiEngine';
import type { ChatMessage } from '@/utils/aiEngine';
import {
  X,
  Send,
  Loader2,
  RotateCcw,
  Copy,
  Check,
} from 'lucide-react';
import styles from './AIAssistantPanel.module.css';

const SUGGESTED_QUESTIONS = [
  'What should I focus on right now?',
  'Help me plan an optimized schedule for today',
  'Break down my most important goal',
  'Check my overdue tasks and potential blockers',
  'How is my habit consistency this week?',
];

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function renderMessageContent(content: string) {
  const lines = content.split('\n');
  return lines.map((line, li) => {
    const isBullet = line.trim().startsWith('•') || line.trim().startsWith('- ') || /^\d+\.\s/.test(line.trim());
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    
    return (
      <div key={li} style={{ marginBottom: line.trim() === '' ? '8px' : '3px', paddingLeft: isBullet ? '4px' : undefined }}>
        {parts.map((part, pi) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pi} style={{ color: 'var(--color-text)' }}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={pi}
                style={{
                  background: 'var(--color-surface-3, rgba(128, 128, 128, 0.15))',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return <span key={pi}>{part}</span>;
        })}
      </div>
    );
  });
}

export default function AIAssistantPanel({ isOpen, onClose }: AIAssistantPanelProps) {
  const { settings } = useSettings();
  const { tasks } = useTasks();
  const { goals } = useGoals();
  const { activeProjects } = useProjects();
  const { habits } = useHabits();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userName = settings.profile.displayName || 'there';
  const aiSettings = settings.aiSettings;
  const isAIConfigured = aiSettings?.enabled && !!aiSettings.apiKey;

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `Hello ${userName}. I have live context on your active tasks, goals, habits, and projects.\n\n${
            isAIConfigured
              ? `Connected: ${aiSettings?.model || 'Gemini'} is active.`
              : `Local Mode: Offline rules active. Add an API key in Settings to enable LLM generation.`
          }`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isAIConfigured, userName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed, timestamp: new Date().toISOString() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setIsThinking(true);

    try {
      const reply = await chatWithAssistant(
        trimmed,
        messages,
        { tasks, goals, projects: activeProjects, habits, userName },
        aiSettings
      );
      setMessages([...newHistory, { role: 'assistant', content: reply, timestamp: new Date().toISOString() }]);
    } catch {
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: 'Unable to generate a response. Please verify your connection or API settings.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div>
              <div className={styles.headerTitle}>Assistant</div>
              <div className={styles.headerSub}>
                {isAIConfigured ? (
                  <span className={`${styles.statusPill} ${styles.statusPillActive}`}>
                    <span>●</span> {aiSettings?.model || 'Gemini'}
                  </span>
                ) : (
                  <span className={`${styles.statusPill} ${styles.statusPillOffline}`}>
                    <span>○</span> Local Rules
                    <Link href="/settings" onClick={onClose} className={styles.configLink}>
                      Configure API
                    </Link>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            {messages.length > 1 && (
              <button
                className={styles.iconBtn}
                onClick={() => {
                  setMessages([]);
                  setInput('');
                }}
                title="Clear conversation"
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button className={styles.iconBtn} onClick={onClose} title="Close Assistant">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className={styles.messages}>
          {messages.map((msg, i) => {
            const isAssistant = msg.role === 'assistant';

            return (
              <div
                key={i}
                className={`${styles.msgRow} ${isAssistant ? styles.assistantRow : styles.userRow}`}
              >
                <div
                  className={`${styles.bubble} ${
                    isAssistant ? styles.assistantBubble : styles.userBubble
                  }`}
                >
                  {renderMessageContent(msg.content)}

                  {isAssistant && i > 0 && (
                    <div className={styles.bubbleFooter}>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button
                        type="button"
                        className={styles.copyBtn}
                        onClick={() => handleCopy(msg.content, i)}
                        title="Copy message text"
                      >
                        {copiedIndex === i ? (
                          <>
                            <Check size={11} style={{ color: 'var(--color-success)' }} /> Copied
                          </>
                        ) : (
                          <>
                            <Copy size={11} /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isThinking && (
            <div className={`${styles.msgRow} ${styles.assistantRow}`}>
              <div className={`${styles.bubble} ${styles.assistantBubble} ${styles.thinkingBubble}`}>
                <Loader2 size={13} className={styles.spin} />
                <span>Generating response...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested Quick Question Chips */}
        {messages.length <= 1 && !isThinking && (
          <div className={styles.suggestions}>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                className={styles.suggestionChip}
                onClick={() => sendMessage(q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Ask about tasks, schedule, goals, habits..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isThinking}
            id="ai-assistant-chat-input"
          />
          <button
            type="button"
            className={styles.sendBtn}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isThinking}
            aria-label="Send message"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
