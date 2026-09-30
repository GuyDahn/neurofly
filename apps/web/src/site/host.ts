import { SITE_URL } from "./site.js";

/**
 * Addresses WiredMind used to live at. Links to them still exist (share
 * links, bookmarks, search results), so each moves to the same path on
 * SITE_URL for good.
 */
export const RETIRED_HOSTS = [
  "wiredmind-edu.vercel.app",
  "neurofly-web.vercel.app",
] as const;

export type HostDecision =
  | { kind: "redirect"; status: 308; url: string }
  /** A preview or per-deployment URL: served, but kept out of search. */
  | { kind: "noindex" }
  | { kind: "serve" };

/**
 * What the middleware does with a request's host, before any language
 * routing. Pure, so tests can check it without a server.
 */
export function routeHost({
  host,
  pathname,
  search,
}: {
  host: string | null | undefined;
  pathname: string;
  /** The query string with its "?", or "": share links' ?r= must survive. */
  search: string;
}): HostDecision {
  const name = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  if ((RETIRED_HOSTS as readonly string[]).includes(name)) {
    return {
      kind: "redirect",
      status: 308,
      url: `${SITE_URL}${pathname}${search}`,
    };
  }
  // Every other *.vercel.app address is a preview (`*-git-*`) or one
  // deployment's own URL. They keep working for review, but must never
  // compete with the real site in search.
  if (name.endsWith(".vercel.app")) return { kind: "noindex" };
  return { kind: "serve" };
}
