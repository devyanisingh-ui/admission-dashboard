"use client";

import clsx from "clsx";
import { Check, ChevronDown, Lock } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  /** Optional secondary text shown on the right of the option. */
  hint?: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: DropdownOption<T>[];
  label?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
  /** Fixed trigger width class (e.g. "w-56") so dropdowns in a column line up. */
  triggerWidth?: string;
  tone?: "default" | "danger";
  ariaLabel?: string;
}

const MENU_MIN_WIDTH = 180;

/**
 * Styled replacement for <select>: button trigger + popover listbox.
 * The menu is portalled and fixed-positioned so it is never clipped by scrolling tables.
 */
export function Dropdown<T extends string>({
  value, onChange, options, label, disabled, className, size = "md", tone = "default", ariaLabel, triggerWidth,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{
    top: number; left: number; width: number; maxHeight: number; up: boolean; triggerLeft: number; triggerRight: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", t: 0 });
  const id = useId();

  const selectedIdx = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIdx];

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, MENU_MIN_WIDTH);
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 220 && above > below;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos({
      top: up ? r.top - 4 : r.bottom + 4,
      left,
      width,
      // Tall enough for ~12 options without scrolling; longer lists scroll.
      maxHeight: Math.min(400, up ? above : below),
      up,
      triggerLeft: r.left,
      triggerRight: r.right,
    });
  }, []);

  // The menu can be wider than the trigger (long labels, board hints). Measure it before paint and
  // keep it inside the viewport: left-align with the trigger if it fits, otherwise right-align with it.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!open || !pos || !el) return;
    const menuW = el.offsetWidth;
    const vw = document.documentElement.clientWidth;
    let left = pos.triggerLeft;
    if (left + menuW > vw - 8) left = pos.triggerRight - menuW;
    left = Math.max(8, Math.min(left, vw - menuW - 8));
    el.style.left = `${left}px`;
  }, [open, pos]);

  const openMenu = () => {
    if (disabled) return;
    place();
    setActive(selectedIdx);
    setOpen(true);
  };
  const close = (focus = true) => {
    setOpen(false);
    if (focus) btnRef.current?.focus();
  };
  const choose = (i: number) => {
    const o = options[i];
    if (o && o.value !== value) onChange(o.value);
    close();
  };

  // Close on outside click, scroll or resize.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !listRef.current?.contains(t)) close(false);
    };
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Keep the active option in view.
  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKey = (e: KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (e.key.length === 1) {
          const now = Date.now();
          const ta = typeahead.current;
          ta.text = now - ta.t > 600 ? e.key.toLowerCase() : ta.text + e.key.toLowerCase();
          ta.t = now;
          const i = options.findIndex((o) => o.label.toLowerCase().startsWith(ta.text));
          if (i >= 0) setActive(i);
        }
    }
  };

  const trigger = (
    <button
      ref={btnRef}
      type="button"
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      aria-label={ariaLabel || label ? `${ariaLabel ?? label}: ${selected?.label ?? ""}` : undefined}
      onClick={() => (open ? close() : openMenu())}
      onKeyDown={onKey}
      className={clsx(
        "group inline-flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-white text-left text-slate-800 shadow-[0_1px_1px_rgba(15,23,42,0.04)] transition",
        triggerWidth,
        "outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/20",
        size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-sm",
        open ? "border-brand-500 ring-2 ring-brand-500/20" : tone === "danger" ? "border-rose-300 text-rose-700" : "border-slate-200 hover:border-slate-300",
        disabled && "cursor-not-allowed bg-slate-50 text-slate-500 shadow-none hover:border-slate-200",
      )}
    >
      <span className="truncate">{selected?.label ?? "Select…"}</span>
      {disabled ? (
        <Lock size={12} className="shrink-0 text-slate-400" />
      ) : (
        <ChevronDown size={14} className={clsx("shrink-0 text-slate-400 transition-transform group-hover:text-slate-600", open && "rotate-180 text-brand-600")} />
      )}
    </button>
  );

  const menu =
    open && pos
      ? createPortal(
          <ul
            ref={listRef}
            id={id}
            role="listbox"
            aria-activedescendant={`${id}-${active}`}
            tabIndex={-1}
            style={{
              position: "fixed",
              left: pos.left,
              minWidth: pos.width,
              maxHeight: pos.maxHeight,
              ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
            className={clsx(
              "z-[100] max-w-[min(360px,calc(100vw-16px))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg shadow-slate-900/10 scroll-thin",
              "animate-[dropdown-in_120ms_ease-out]",
            )}
          >
            {options.map((o, i) => {
              const isSel = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${id}-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                  className={clsx(
                    "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5",
                    i === active ? "bg-slate-100" : "",
                    isSel ? "font-medium text-brand-700" : "text-slate-700",
                  )}
                >
                  <Check size={14} className={clsx("shrink-0", isSel ? "text-brand-600" : "invisible")} />
                  <span className="flex-1 whitespace-nowrap">{o.label}</span>
                  {o.hint && <span className="ml-3 text-xs text-slate-400">{o.hint}</span>}
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  if (!label)
    return (
      <span className={clsx("inline-flex", className)}>
        {trigger}
        {menu}
      </span>
    );

  return (
    <div className={clsx("flex items-center gap-1.5", className)}>
      <span className="whitespace-nowrap text-xs font-medium text-slate-500">{label}</span>
      {trigger}
      {menu}
    </div>
  );
}
