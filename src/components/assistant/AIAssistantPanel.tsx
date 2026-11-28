'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  ExternalLink,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useSpeechToText } from '@/utils/useSpeechToText';
import styles from './AIAssistantPanel.module.css';

const CHAT_HISTORY_STORAGE_KEY = 'life_os_ai_chat_history_v1';

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
  anchorPos?: { x: number; y: number } | null;
  standalone?: boolean;
}

interface PlatformAiStatus {
  enabled: boolean;
  configured: boolean;
  provider: string;
  model: string;
}

function renderMessageContent(content: string) {
  const lines = content.split('\n');
  return lines.map((line, li) => {
    const isBullet =
      line.trim().startsWith('•') || line.trim().startsWith('- ') || /^\d+\.\s/.test(line.trim());
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

    return (
      <div
        key={li}
        style={{
          marginBottom: line.trim() === '' ? '8px' : '3px',
          paddingLeft: isBullet ? '4px' : undefined,
        }}
      >
        {parts.map((part, pi) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pi} style={{ color: 'var(--color-text)' }}>
                {part.slice(2, -2)}
              </strong>
            );
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

function computePopupStyle(
  anchorPos: { x: number; y: number } | null | undefined,
  viewport: { width: number; height: number }
): React.CSSProperties {
  const margin = 16;
  const bubbleSize = 44;
  const gap = 12;
  const width = Math.min(400, Math.max(280, viewport.width - margin * 2));
  const height = Math.min(560, Math.max(320, viewport.height - 108));

  if (!anchorPos) {
    const defaultBottomOffset = viewport.height <= 700 ? 78 : 144;
    const maxBottom = Math.max(margin, viewport.height - height - margin);
    return {
      width: `${width}px`,
      height: `${height}px`,
      right: `${viewport.height <= 700 ? 20 : 24}px`,
      bottom: `${Math.min(defaultBottomOffset, maxBottom)}px`,
      transformOrigin: 'bottom right',
    };
  }

  const openOnLeftEdge = anchorPos.x < viewport.width / 2;
  const left = openOnLeftEdge
    ? Math.min(Math.max(margin, anchorPos.x), Math.max(margin, viewport.width - width - margin))
    : Math.max(margin, Math.min(anchorPos.x + bubbleSize - width, viewport.width - width - margin));

  const spaceAbove = anchorPos.y - gap - margin;
  const spaceBelow = viewport.height - (anchorPos.y + bubbleSize + gap) - margin;
  let top: number;
  let originY: 'top' | 'bottom' = 'bottom';

  if (spaceAbove >= height || spaceAbove >= spaceBelow) {
    top = Math.max(margin, Math.min(anchorPos.y - height - gap, viewport.height - height - margin));
    originY = 'bottom';
  } else {
    top = Math.max(margin, Math.min(anchorPos.y + bubbleSize + gap, viewport.height - height - margin));
    originY = 'top';
  }

  return {
    width: `${width}px`,
    height: `${height}px`,
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    transformOrigin: `${originY} ${openOnLeftEdge ? 'left' : 'right'}`,
  };
}

export default function AIAssistantPanel({
  isOpen,
  onClose,
  anchorPos = null,
  standalone = false,
}: AIAssistantPanelProps) {
  const { settings } = useSettings();
  const { tasks } = useTasks();
  const { goals } = useGoals();
  const { activeProjects } = useProjects();
  const { habits } = useHabits();
  const { docs } = useKnowledge();

  const [activeDocContext, setActiveDocContext] = useState<KnowledgeDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'popup' | 'drawer'>('popup');
  const [platformStatus, setPlatformStatus] = useState<PlatformAiStatus | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseVoiceTextRef = useRef('');

  const {
    isListening,
    toggleListening,
    isSupported: speechSupported,
  } = useSpeechToText({
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
  const isUserAiEnabled = aiSettings?.enabled !== false;

  // Keep viewport tracked for popup positioning and responsive drawer switching
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch non-secret platform AI availability status whenever opened
  useEffect(() => {
    if (!isOpen && !standalone) return;
    let active = true;
    fetch('/api/ai/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setPlatformStatus({
            enabled: Boolean(data.enabled),
            configured: Boolean(data.configured),
            provider: String(data.provider || ''),
            model: String(data.model || ''),
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, standalone]);

  // Listen for context pre-seed events from Knowledge Base or other views
  useEffect(() => {
    const handleContextEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        activeDoc?: KnowledgeDocument;
        initialMessage?: string;
      }>;
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

  // Persist active chat history so popping out to standalone window preserves conversation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (messages.length > 0) {
        localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages.slice(-40)));
      }
    } catch {}
  }, [messages]);

  // Keep popped-out window and embedded popup in sync across tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== CHAT_HISTORY_STORAGE_KEY) return;
      try {
        const next = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(next)) {
          setMessages(next);
        }
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Close floating popup / drawer with Escape key
  useEffect(() => {
    if (!isOpen || standalone) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, standalone, onClose]);

  useEffect(() => {
    if ((isOpen || standalone) && messages.length === 0) {
      let statusLine = 'Workspace AI is ready.';
      if (!isUserAiEnabled) {
        statusLine = 'AI features are currently paused in your Settings preferences.';
      } else if (platformStatus) {
        statusLine =
          platformStatus.enabled && platformStatus.configured
            ? `Connected: Platform AI (${platformStatus.model || platformStatus.provider.toUpperCase()}) is active.`
            : 'Local Mode: Built-in planning rules are active.';
      }

      setMessages([
        {
          role: 'assistant',
          content: `Hello ${userName}. I have live context on your active tasks, goals, habits, projects, and knowledge base notes.\n\n${statusLine}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
    if (isOpen || standalone) {
      const isMobileScreen = typeof window !== 'undefined' && window.innerWidth <= 640;
      if (!isMobileScreen) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [isOpen, standalone, messages.length, isUserAiEnabled, platformStatus, userName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setIsThinking(true);

    try {
      const reply = await chatWithAssistant(
        trimmed,
        messages,
        {
          tasks,
          goals,
          projects: activeProjects,
          habits,
          userName,
          docs,
          currentDoc: activeDocContext || undefined,
        },
        aiSettings
      );
      setMessages([
        ...newHistory,
        { role: 'assistant', content: reply, timestamp: new Date().toISOString() },
      ]);
    } catch {
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: 'Unable to generate a response right now. Please verify your connection or try again.',
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
        {
          tasks,
          goals,
          projects: activeProjects,
          habits,
          userName,
          docs,
          currentDoc: activeDocContext || undefined,
        },
        aiSettings
      );
      setMessages([
        ...newHistory,
        { role: 'assistant', content: reply, timestamp: new Date().toISOString() },
      ]);
    } catch {
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: 'Unable to regenerate a response right now. Please verify your connection or try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleRegenerateResponse = async (assistantIndex: number) => {
    if (isThinking) return;
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
        {
          tasks,
          goals,
          projects: activeProjects,
          habits,
          userName,
          docs,
          currentDoc: activeDocContext || undefined,
        },
        aiSettings
      );
      setMessages([
        ...newHistory,
        { role: 'assistant', content: reply, timestamp: new Date().toISOString() },
      ]);
    } catch {
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: 'Unable to regenerate response right now. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleEditAndResend = (content: string) => {
    setInput(content);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([]);
    setInput('');
    try {
      localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
    } catch {}
  };

  const handlePopOut = () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {}
    const width = 460;
    const height = 680;
    const left = Math.max(40, Math.round(window.screenX + window.outerWidth - width - 48));
    const top = Math.max(40, Math.round(window.screenY + 72));
    const popupWin = window.open(
      '/ai-popout',
      'sariling-mundo-ai-popout',
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes`
    );
    if (popupWin) {
      popupWin.focus();
      onClose();
    }
  };

  const isMobileViewport = viewport.width <= 640;
  const renderAsDrawer = !standalone && (isMobileViewport || viewMode === 'drawer');
  const popupStyle = useMemo(
    () => (standalone || renderAsDrawer ? undefined : computePopupStyle(anchorPos, viewport)),
    [standalone, renderAsDrawer, anchorPos, viewport]
  );

  if (!isOpen && !standalone) return null;

  const platformReady = platformStatus?.enabled && platformStatus?.configured;

  const panelBody = (
    <div
      className={
        standalone ? styles.standaloneShell : renderAsDrawer ? styles.panel : styles.popupPanel
      }
      style={popupStyle}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="AI Assistant"
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div>
            <div className={styles.headerTitle}>Assistant</div>
            <div className={styles.headerSub}>
              {!isUserAiEnabled ? (
                <span className={`${styles.statusPill} ${styles.statusPillOffline}`}>
                  <span>○</span> Paused in Settings
                </span>
              ) : platformReady ? (
                <span className={`${styles.statusPill} ${styles.statusPillActive}`}>
                  <span>●</span> {platformStatus?.model || platformStatus?.provider.toUpperCase()}
                </span>
              ) : platformStatus === null ? (
                <span className={`${styles.statusPill} ${styles.statusPillOffline}`}>
                  <span>●</span> Connecting...
                </span>
              ) : (
                <span className={`${styles.statusPill} ${styles.statusPillOffline}`}>
                  <span>○</span> Local Rules
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          {messages.length > 1 && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleClearChat}
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {!standalone && !isMobileViewport && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setViewMode((prev) => (prev === 'popup' ? 'drawer' : 'popup'))}
              title={viewMode === 'popup' ? 'Dock as side drawer' : 'Pop back into floating card'}
              aria-label={viewMode === 'popup' ? 'Dock as side drawer' : 'Pop back into floating card'}
            >
              {viewMode === 'popup' ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
          )}
          {!standalone && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handlePopOut}
              title="Pop out into standalone window"
              aria-label="Pop out AI assistant window"
            >
              <ExternalLink size={14} />
            </button>
          )}
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            title={standalone ? 'Close pop-out window' : 'Close Assistant'}
            aria-label={standalone ? 'Close pop-out window' : 'Close Assistant'}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Active Document Context Banner */}
      {activeDocContext && (
        <div className={styles.docContextBanner}>
          <div className={styles.docContextBadge}>
            <BookOpen size={12} style={{ flexShrink: 0 }} />
            <span>
              Discussing: <strong>{activeDocContext.title}</strong>
            </span>
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
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
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
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div className={styles.footerActions}>
                      <button
                        type="button"
                        className={styles.userActionBtn}
                        onClick={() => handleRetryUserMessage(i)}
                        title="Retry message"
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
            <button key={i} type="button" className={styles.suggestionChip} onClick={() => sendMessage(q)}>
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
  );

  if (standalone || !renderAsDrawer) {
    return panelBody;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      {panelBody}
    </div>
  );
}
