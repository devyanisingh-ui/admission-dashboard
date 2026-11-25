/**
 * Stand-in for "next/link" in the single-file build (aliased in vite.config.ts).
 * Renders a normal <a> pointing at the hash route, so open-in-new-tab and copy-link still work.
 */
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { navigate, toHash } from "./router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, replace, scroll, prefetch: _prefetch, onClick, target, ...rest }, ref) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    // Let the browser handle new-tab / modified clicks and anything already handled.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (target && target !== "_self")) return;
    e.preventDefault();
    navigate(href, { replace, scroll });
  };
  return <a ref={ref} href={toHash(href)} target={target} onClick={handle} {...rest} />;
});

export default Link;
