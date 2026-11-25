/**
 * Stand-in for "next/navigation" in the single-file build (aliased in vite.config.ts).
 * Only the calls the app uses are provided: usePathname, useSearchParams, useRouter().push/replace.
 */
import { useMemo } from "react";
import { navigate, splitUrl, useLocationString, type NavigateOptions } from "./router";

export function usePathname(): string {
  return splitUrl(useLocationString()).pathname;
}

export function useSearchParams(): URLSearchParams {
  const { search } = splitUrl(useLocationString());
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useRouter() {
  return useMemo(
    () => ({
      push: (href: string, opts?: NavigateOptions) => navigate(href, opts),
      replace: (href: string, opts?: NavigateOptions) => navigate(href, { ...opts, replace: true }),
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh: () => {},
      prefetch: () => {},
    }),
    [],
  );
}
