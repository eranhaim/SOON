/**
 * In-app dialogs and toasts (no browser / system alerts): `confirm` opens a designed dialog and
 * resolves true/false; `notify` shows a short toast. Rendered by <DialogHost /> in the root layout.
 */
import { useSyncExternalStore } from 'react';

export type ConfirmOptions = {
  /** Red confirm button (delete, block, disconnect…). Guessed from the label when not set. */
  destructive?: boolean;
  cancelLabel?: string;
};

export type DialogState = {
  id: number;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  resolve: (ok: boolean) => void;
};

export type ToastState = { id: number; title: string; message?: string; kind: 'success' | 'error' | 'info' };

type State = { dialog: DialogState | null; toast: ToastState | null };

let state: State = { dialog: null, toast: null };
const listeners = new Set<() => void>();
let nextId = 1;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const queue: DialogState[] = [];

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const DESTRUCTIVE = /מחיק|חסימ|ניתוק|איפוס|הסר|ביטול המנוי|התנתק|יציאה/;

/** Yes / no dialog. Resolves true when the user confirms. */
export function confirm(title: string, message: string, confirmLabel = 'אישור', opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const d: DialogState = {
      id: nextId++,
      title,
      message,
      confirmLabel,
      cancelLabel: opts.cancelLabel ?? 'ביטול',
      destructive: opts.destructive ?? DESTRUCTIVE.test(confirmLabel),
      resolve,
    };
    if (state.dialog) queue.push(d);
    else set({ dialog: d });
  });
}

/** Called by the host when a button is pressed. */
export function closeDialog(ok: boolean) {
  const d = state.dialog;
  if (!d) return;
  d.resolve(ok);
  set({ dialog: queue.shift() ?? null });
}

/** Short message at the bottom of the screen. Errors stay a little longer. */
export function notify(title: string, message?: string, kind?: ToastState['kind']) {
  const k = kind ?? (/נכשל|לא הצלחנו|שגיאה|לא תקין|נדחה/.test(title) ? 'error' : 'success');
  if (toastTimer) clearTimeout(toastTimer);
  set({ toast: { id: nextId++, title, message, kind: k } });
  toastTimer = setTimeout(() => set({ toast: null }), k === 'error' ? 5000 : 3200);
}

export function dismissToast() {
  if (toastTimer) clearTimeout(toastTimer);
  set({ toast: null });
}

export function useDialogState(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
