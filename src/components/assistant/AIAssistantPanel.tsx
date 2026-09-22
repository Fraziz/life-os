'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useHabits } from '@/context/HabitContext';
import { chatWithAssistant } from '@/utils/aiEngine';
import type { ChatMessage } from '@/utils/aiEngine';
import {
  Bot,
  X,
  Send,
  Loader2,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import styles from './AIAssistantPanel.module.css';

const SUGGESTED_QUESTIONS = [
  'What should I focus on right now?',
  'Am I behind on any goals?',
  'What did I accomplish today?',
  'Do I have any overdue tasks?',
  'How are my habits going?',
];

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function renderMessageContent(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userName = settings.profile.displayName || 'there';
  const aiSettings = settings.aiSettings;
  const isAIConfigured = aiSettings?.enabled && !!aiSettings.apiKey;

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hey ${userName}! 👋 I'm your Life OS assistant. I know your tasks, goals, habits, and projects. Ask me anything!\n\n${isAIConfigured ? `AI Mode: ${aiSettings?.model} 🤖` : '*Smart local mode. Add an API key in Settings → AI for real AI.*'}`,
        timestamp: new Date().toISOString(),
      }]);
    }
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

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
      setMessages([...newHistory, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date().toISOString() }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.avatar}><Bot size={18} /></div>
            <div>
              <div className={styles.headerTitle}>Life OS Assistant</div>
              <div className={styles.headerSub}>{isAIConfigured ? `🤖 ${aiSettings?.model}` : '⚡ Smart local mode'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {messages.length > 1 && (
              <button className={styles.iconBtn} onClick={() => { setMessages([]); setInput(''); }} title="Clear chat">
                <RotateCcw size={14} />
              </button>
            )}
            <button className={styles.iconBtn} onClick={onClose} title="Close"><X size={16} /></button>
          </div>
        </div>

        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <div key={i} className={`${styles.msgRow} ${msg.role === 'user' ? styles.userRow : styles.assistantRow}`}>
              {msg.role === 'assistant' && <div className={styles.msgAvatar}><Sparkles size={12} /></div>}
              <div className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                {msg.content.split('\n').map((line, li, arr) => (
                  <React.Fragment key={li}>
                    {renderMessageContent(line)}
                    {li < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className={`${styles.msgRow} ${styles.assistantRow}`}>
              <div className={styles.msgAvatar}><Sparkles size={12} /></div>
              <div className={`${styles.bubble} ${styles.assistantBubble} ${styles.thinkingBubble}`}>
                <Loader2 size={14} className={styles.spin} />
                <span>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 && !isThinking && (
          <div className={styles.suggestions}>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button key={i} className={styles.suggestionChip} onClick={() => sendMessage(q)}>{q}</button>
            ))}
          </div>
        )}

        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Ask me anything about your system..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isThinking}
            id="ai-assistant-chat-input"
          />
          <button className={styles.sendBtn} onClick={() => sendMessage(input)} disabled={!input.trim() || isThinking} aria-label="Send">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

