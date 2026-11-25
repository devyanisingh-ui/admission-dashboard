/**
 * Hash router for the single-file build: the page path lives after the "#",
 * e.g. dashboard.html#/drilldown?v=Schools, so the file works from file:// with no server.
 * Exposes the same calls the app makes on next/navigation (see ./next-navigation.ts).
 */
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", notify);
  window.addEventListener("popstate", notify);
}

/** "/drilldown?v=Schools" from "#/drilldown?v=Schools"; "/" when there is no hash. */
function current(): string {
  const h = typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, "");
  return h.startsWith("/") ? h : "/";
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The current in-app URL, re-rendering whenever it changes. */
export function useLocationString(): string {
  return useSyncExternalStore(subscribe, current, () => "/");
}

export function splitUrl(url: string): { pathname: string; search: string } {
  const i = url.indexOf("?");
  const pathname = (i < 0 ? url : url.slice(0, i)) || "/";
  return { pathname: pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname, search: i < 0 ? "" : url.slice(i + 1) };
}

/** Turns an app href ("/budget", "/drilldown?loc=saket") into the file's hash link. */
export const toHash = (href: string) => `#${href.startsWith("/") ? href : `/${href}`}`;

export interface NavigateOptions {
  scroll?: boolean;
}

export function navigate(href: string, { replace = false, scroll = true }: NavigateOptions & { replace?: boolean } = {}) {
  const target = toHash(href);
  if (target === window.location.hash) return;
  if (replace) window.history.replaceState(window.history.state, "", target);
  else window.history.pushState(window.history.state, "", target);
  notify();
  if (scroll) window.scrollTo(0, 0);
}
