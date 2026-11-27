'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export interface AlertOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
}

export interface PromptOptions {
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

interface ActiveDialogState {
  mode: 'confirm' | 'alert' | 'prompt';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isDestructive: boolean;
  hideCancel: boolean;
  inputPlaceholder?: string;
  defaultValue?: string;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<ActiveDialogState | null>(null);
  const resolverRef = useRef<((value: unknown) => void) | null>(null);

  const closeWith = useCallback((value: unknown) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    resolve?.(value);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve as (v: unknown) => void;
      setDialog({
        mode: 'confirm',
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        isDestructive: options.isDestructive ?? true,
        hideCancel: false,
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setDialog({
        mode: 'alert',
        title: opts.title || 'Notice',
        message: opts.message,
        confirmLabel: opts.confirmLabel || 'OK',
        cancelLabel: 'Cancel',
        isDestructive: false,
        hideCancel: true,
      });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve as (v: unknown) => void;
      setDialog({
        mode: 'prompt',
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        isDestructive: options.isDestructive ?? false,
        hideCancel: false,
        inputPlaceholder: options.placeholder ?? '',
        defaultValue: options.defaultValue ?? '',
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm, alert, prompt }}>
      {children}
      {dialog && (
        <ConfirmDialog
          isOpen={true}
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          isDestructive={dialog.isDestructive}
          hideCancel={dialog.hideCancel}
          inputPlaceholder={dialog.inputPlaceholder}
          defaultValue={dialog.defaultValue}
          onConfirm={(val) => {
            if (dialog.mode === 'confirm') closeWith(true);
            else if (dialog.mode === 'prompt') closeWith(val ?? '');
            else closeWith(undefined);
          }}
          onCancel={() => {
            if (dialog.mode === 'confirm') closeWith(false);
            else if (dialog.mode === 'prompt') closeWith(null);
            else closeWith(undefined);
          }}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx;
}
