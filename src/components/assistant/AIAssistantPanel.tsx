'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useHabits } from '@/context/HabitContext';
import { useKnowledge } from '@/context/KnowledgeContext';
import { chatWithAssistant } from '@/utils/aiEngine';
import type { ChatMessage } from '@/utils/aiEngine';
import type { KnowledgeDocument } from '@/types';
import {
  X,
  Send,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  Mic,
  MicOff,
  Edit3,
  BookOpen,
} from 'lucide-react';
import { useSpeechToText } from '@/utils/useSpeechToText';
import styles from './AIAssistantPanel.module.css';

const SUGGESTED_QUESTIONS = [
  'What should I focus on right now?',
  'Help me plan an optimized schedule for today',
  'Summarize my active knowledge base notes',
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
  const { settings, updateSettings } = useSettings();
  const { tasks } = useTasks();
  const { goals } = useGoals();
  const { activeProjects } = useProjects();
  const { habits } = useHabits();
  const { docs } = useKnowledge();

  const [activeDocContext, setActiveDocContext] = useState<KnowledgeDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const baseVoiceTextRef = useRef('');

  const { isListening, toggleListening, isSupported: speechSupported } = useSpeechToText({
    onTranscript: (spokenText) => {
      const base = baseVoiceTextRef.current;
      setInput(base ? `${base} ${spokenText}` : spokenText);
    },
  });

  const handleToggleListening = () => {
    if (!isListening) {
      baseVoiceTextRef.current = input.trim();
    }
    toggleListening();
  };

  const userName = settings.profile.displayName || 'there';
  const aiSettings = settings.aiSettings;
  const isAIConfigured = aiSettings?.enabled && !!aiSettings.apiKey;

  // Listen for context pre-seed events from Knowledge Base or other views
  useEffect(() => {
    const handleContextEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ activeDoc?: KnowledgeDocument; initialMessage?: string }>;
      if (customEvent.detail?.activeDoc) {
        setActiveDocContext(customEvent.detail.activeDoc);
      }
      if (customEvent.detail?.initialMessage) {
        setInput(customEvent.detail.initialMessage);
      }
    };
    window.addEventListener('open-ai-chat-with-context', handleContextEvent);
    return () => window.removeEventListener('open-ai-chat-with-context', handleContextEvent);
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `Hello ${userName}. I have live context on your active tasks, goals, habits, projects, and knowledge base notes.\n\n${
            isAIConfigured
              ? `Connected: ${aiSettings?.model || 'Gemini'} is active.`
              : `Local Mode: Offline rules active. Add an API key in Settings to enable LLM generation.`
          }`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
    if (isOpen) {
      // Avoid jarring mobile keyboard jump on initial touch opening
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
      if (!isMobile) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
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
        { tasks, goals, projects: activeProjects, habits, userName, docs, currentDoc: activeDocContext || undefined },
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

  const handleRetryUserMessage = async (index: number) => {
    if (isThinking) return;
    const targetMsg = messages[index];
    if (!targetMsg || targetMsg.role !== 'user') return;

    // Retain conversation history up to before this message
    const previousHistory = messages.slice(0, index);
    const userMsg: ChatMessage = {
      role: 'user',
      content: targetMsg.content,
      timestamp: new Date().toISOString(),
    };
    const newHistory = [...previousHistory, userMsg];
    setMessages(newHistory);
    setIsThinking(true);

    try {
      const reply = await chatWithAssistant(
        targetMsg.content,
        previousHistory,
        { tasks, goals, projects: activeProjects, habits, userName, docs, currentDoc: activeDocContext || undefined },
        aiSettings
      );
      setMessages([...newHistory, { role: 'assistant', content: reply, timestamp: new Date().toISOString() }]);
    } catch {
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: 'Unable to regenerate a response. Please verify your connection or API settings.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleRegenerateResponse = async (assistantIndex: number) => {
    if (isThinking) return;
    // Find the user prompt directly before this assistant message
    const userPromptMsg = messages[assistantIndex - 1];
    if (!userPromptMsg || userPromptMsg.role !== 'user') return;

    const previousHistory = messages.slice(0, assistantIndex - 1);
    const userMsg: ChatMessage = {
      role: 'user',
      content: userPromptMsg.content,
      timestamp: new Date().toISOString(),
    };
    const newHistory = [...previousHistory, userMsg];
    setMessages(newHistory);
    setIsThinking(true);

    try {
      const reply = await chatWithAssistant(
        userPromptMsg.content,
        previousHistory,
        { tasks, goals, projects: activeProjects, habits, userName, docs, currentDoc: activeDocContext || undefined },
        aiSettings
      );
      setMessages([...newHistory, { role: 'assistant', content: reply, timestamp: new Date().toISOString() }]);
    } catch {
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: 'Unable to regenerate response. Please check your API settings.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleEditAndResend = (content: string) => {
    setInput(content);
    inputRef.current?.focus();
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span className={`${styles.statusPill} ${styles.statusPillActive}`}>
                      <span>●</span> {aiSettings?.model || 'Gemini'}
                    </span>
                    {aiSettings?.savedKeys && aiSettings.savedKeys.length > 1 && (
                      <select
                        style={{
                          background: 'var(--color-surface-2)',
                          border: '1px solid var(--color-border-subtle)',
                          color: 'var(--color-text-muted)',
                          fontSize: '10px',
                          borderRadius: '99px',
                          padding: '1px 6px',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                        value={aiSettings.activeKeyId || aiSettings.apiKey}
                        onChange={(e) => {
                          const selected = aiSettings.savedKeys?.find(
                            (k) => k.id === e.target.value || k.apiKey === e.target.value
                          );
                          if (selected) {
                            updateSettings({
                              aiSettings: {
                                ...aiSettings,
                                apiKey: selected.apiKey,
                                model: selected.model || aiSettings.model,
                                activeKeyId: selected.id,
                              },
                            });
                          }
                        }}
                        title="Switch saved API Key Profile"
                      >
                        {aiSettings.savedKeys.map((k) => (
                          <option key={k.id} value={k.id}>
                            Key: {k.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
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

        {/* Active Document Context Banner */}
        {activeDocContext && (
          <div className={styles.docContextBanner}>
            <div className={styles.docContextBadge}>
              <BookOpen size={12} style={{ flexShrink: 0 }} />
              <span>Discussing: <strong>{activeDocContext.title}</strong></span>
            </div>
            <button
              type="button"
              className={styles.docContextDismiss}
              onClick={() => setActiveDocContext(null)}
              title="Clear note context"
              aria-label="Clear note context"
            >
              <X size={12} />
            </button>
          </div>
        )}

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
                      <div className={styles.footerActions}>
                        <button
                          type="button"
                          className={styles.copyBtn}
                          onClick={() => handleRegenerateResponse(i)}
                          title="Regenerate response (Retry)"
                          disabled={isThinking}
                        >
                          <RotateCcw size={11} /> Retry
                        </button>
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
                    </div>
                  )}

                  {!isAssistant && (
                    <div className={styles.userBubbleFooter}>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <div className={styles.footerActions}>
                        <button
                          type="button"
                          className={styles.userActionBtn}
                          onClick={() => handleRetryUserMessage(i)}
                          title="Retry message (Ulit)"
                          disabled={isThinking}
                        >
                          <RotateCcw size={11} /> Retry
                        </button>
                        <button
                          type="button"
                          className={styles.userActionBtn}
                          onClick={() => handleEditAndResend(msg.content)}
                          title="Edit in input box"
                          disabled={isThinking}
                        >
                          <Edit3 size={11} /> Edit
                        </button>
                      </div>
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
            {(activeDocContext
              ? [
                  `Summarize key takeaways from "${activeDocContext.title}"`,
                  `Generate 3 study questions for this note`,
                  `How can I apply "${activeDocContext.title}" to my goals?`,
                ]
              : SUGGESTED_QUESTIONS
            ).map((q, i) => (
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
            placeholder={isListening ? 'Listening to voice...' : 'Ask about tasks, schedule, goals, habits...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isThinking}
            id="ai-assistant-chat-input"
          />
          {speechSupported && (
            <button
              type="button"
              className={`${styles.micBtn} ${isListening ? styles.micActive : ''}`}
              onClick={handleToggleListening}
              title={isListening ? 'Stop voice recording' : 'Voice input'}
              aria-label={isListening ? 'Stop voice recording' : 'Voice input'}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          )}
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
