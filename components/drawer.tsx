"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Right-hand side drawer. Closes on Esc, overlay click or the close button,
 * locks page scroll while open and returns focus to the trigger on close.
 */
export function Drawer({
  open, onClose, title, subtitle, headerExtra, footer, children, width = "max-w-[520px]",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Keep the latest onClose without re-running the open/close effect (which would steal focus on every render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 animate-[fade-in_150ms_ease-out] bg-slate-900/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className={clsx(
          "absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl shadow-slate-900/20",
          "animate-[drawer-in_220ms_cubic-bezier(0.2,0.8,0.2,1)]",
          width,
        )}
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
          </div>
          {headerExtra}
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-brand-500/30"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer && <footer className="flex items-center gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}
