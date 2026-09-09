"use client";
import { useEffect, useRef } from "react";
export function useDialog(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]'); const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    const getFocusable = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')].filter(e => e.getClientRects().length);
    const timer = setTimeout(() => getFocusable()[0]?.focus(), 0);
    const handler = (event: KeyboardEvent) => {
      const activeDialogs = document.querySelectorAll('[role="dialog"]'); if (activeDialogs[activeDialogs.length - 1] !== dialog) return;
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const focusable = getFocusable(); const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => { clearTimeout(timer); document.removeEventListener("keydown", handler); previous?.focus(); };
  }, [open]);
}
