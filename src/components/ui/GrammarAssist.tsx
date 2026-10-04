'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './GrammarAssist.module.css';

/**
 * GrammarAssist — global, as-you-type grammar & spelling checker.
 *
 * Watches every text field in the app (textarea + text/search inputs). After the user
 * pauses typing, the text is checked with the LanguageTool public API and a small
 * "N issues" pill appears under the field. Clicking it lists issues with one-click fixes.
 *
 * Opt out per field with `data-no-grammar`. Password/email/url/number fields and text
 * that looks like an API key are never sent.
 */

const API_URL = 'https://api.languagetool.org/v2/check';
const DEBOUNCE_MS = 1200;
const MIN_CHARS = 8;
const SECRET_PATTERN = /(gsk_|sk-|AIza|ghp_|xox[bp]-)[A-Za-z0-9_-]{10,}/;

interface LTMatch {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { id: string; issueType?: string };
}

type Field = HTMLInputElement | HTMLTextAreaElement;

function isCheckableField(el: EventTarget | null): el is Field {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.closest('[data-no-grammar]')) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return (type === 'text' || type === 'search') && !el.readOnly && !el.disabled;
  }
  return false;
}

/** Sets a value on a React-controlled field so React's onChange fires. */
function setNativeValue(el: Field, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function GrammarAssist() {
  const [field, setField] = useState<Field | null>(null);
  const [matches, setMatches] = useState<LTMatch[]>([]);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const fieldRef = useRef<Field | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ignoredRef = useRef<Set<string>>(new Set());

  const ignoreKey = (text: string, m: LTMatch) => `${m.rule.id}:${text.slice(m.offset, m.offset + m.length)}`;

  const runCheck = useCallback(async (el: Field) => {
    const text = el.value;
    const trimmed = text.trim();
    if (trimmed.length < MIN_CHARS || trimmed.split(/\s+/).length < 2 || SECRET_PATTERN.test(text)) {
      setMatches([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setChecking(true);

    try {
      const body = new URLSearchParams({ text, language: 'en-US' });
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`LanguageTool ${res.status}`);
      const data: { matches: LTMatch[] } = await res.json();

      // Discard stale results if the user kept typing or switched fields.
      if (fieldRef.current !== el || el.value !== text) return;
      setMatches(data.matches.filter((m) => !ignoredRef.current.has(ignoreKey(text, m))));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setMatches([]);
    } finally {
      if (abortRef.current === controller) setChecking(false);
    }
  }, []);

  const scheduleCheck = useCallback(
    (el: Field) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => runCheck(el), DEBOUNCE_MS);
    },
    [runCheck]
  );

  // Track focus + typing across the whole app.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (!isCheckableField(e.target)) return;
      const el = e.target;
      el.spellcheck = true;
      if (fieldRef.current !== el) {
        fieldRef.current = el;
        setField(el);
        setMatches([]);
        setOpen(false);
        if (el.value.trim()) scheduleCheck(el);
      }
      setRect(el.getBoundingClientRect());
    };

    const onFocusOut = (e: FocusEvent) => {
      if (e.target !== fieldRef.current) return;
      // Let clicks inside the panel keep the field active (they preventDefault on mousedown).
      setTimeout(() => {
        if (document.activeElement !== fieldRef.current) {
          fieldRef.current = null;
          setField(null);
          setMatches([]);
          setOpen(false);
          abortRef.current?.abort();
          if (timerRef.current) clearTimeout(timerRef.current);
        }
      }, 120);
    };

    const onInput = (e: Event) => {
      if (e.target !== fieldRef.current || !fieldRef.current) return;
      setMatches([]);
      setRect(fieldRef.current.getBoundingClientRect());
      scheduleCheck(fieldRef.current);
    };

    const onReposition = () => {
      if (fieldRef.current) setRect(fieldRef.current.getBoundingClientRect());
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('input', onInput);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('input', onInput);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [scheduleCheck]);

  const applyFix = (m: LTMatch, replacement: string) => {
    const el = fieldRef.current;
    if (!el) return;
    const v = el.value;
    const next = v.slice(0, m.offset) + replacement + v.slice(m.offset + m.length);
    setNativeValue(el, next);
    const caret = m.offset + replacement.length;
    try { el.setSelectionRange(caret, caret); } catch { /* some inputs don't support selection */ }
  };

  const ignore = (m: LTMatch) => {
    const el = fieldRef.current;
    if (!el) return;
    ignoredRef.current.add(ignoreKey(el.value, m));
    setMatches((prev) => {
      const rest = prev.filter((x) => x !== m);
      if (rest.length === 0) setOpen(false);
      return rest;
    });
  };

  if (!field || !rect || (matches.length === 0 && !checking)) return null;

  // Position under the field's right edge; flip above if near the viewport bottom.
  const PANEL_W = 320;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const below = rect.bottom + 6;
  const placeAbove = below + (open ? 280 : 30) > vh && rect.top > 300;
  const right = Math.max(8, vw - rect.right);
  const posStyle: React.CSSProperties = placeAbove
    ? { right, bottom: vh - rect.top + 6 }
    : { right, top: below };

  const text = field.value;
  const count = matches.length;

  return (
    <div
      className={styles.root}
      style={posStyle}
      onMouseDown={(e) => e.preventDefault()}
      role="region"
      aria-label="Grammar suggestions"
    >
      {open && count > 0 && (
        <div className={`${styles.panel} ${placeAbove ? styles.panelAbove : ''}`} style={{ width: Math.min(PANEL_W, vw - 16) }}>
          <div className={styles.panelHeader}>
            <span>{count} {count === 1 ? 'suggestion' : 'suggestions'}</span>
            <button type="button" className={styles.textBtn} onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <ul className={styles.list}>
            {matches.slice(0, 8).map((m, i) => {
              const bad = text.slice(m.offset, m.offset + m.length);
              const isSpelling = m.rule.issueType === 'misspelling';
              return (
                <li key={`${m.offset}-${i}`} className={styles.item}>
                  <div className={styles.itemTop}>
                    <span className={`${styles.kind} ${isSpelling ? styles.kindSpelling : styles.kindGrammar}`}>
                      {isSpelling ? 'Spelling' : 'Grammar'}
                    </span>
                    <span className={styles.bad}>{bad || '·'}</span>
                  </div>
                  <p className={styles.message}>{m.shortMessage || m.message}</p>
                  <div className={styles.fixRow}>
                    {m.replacements.slice(0, 3).map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        className={styles.fixBtn}
                        onClick={() => applyFix(m, r.value)}
                      >
                        {r.value || '(remove)'}
                      </button>
                    ))}
                    <button type="button" className={styles.textBtn} onClick={() => ignore(m)}>
                      Ignore
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        className={`${styles.pill} ${count > 0 ? styles.pillIssues : ''}`}
        onClick={() => count > 0 && setOpen((o) => !o)}
        title={count > 0 ? 'Show grammar suggestions' : 'Checking…'}
      >
        {count > 0 && <span className={styles.dot} />}
        {checking && count === 0 ? 'Checking…' : `${count} ${count === 1 ? 'issue' : 'issues'}`}
      </button>
    </div>
  );
}
