import Link from "next/link";
import type { ReactNode } from "react";
import { localePath } from "../i18n/locales.js";
import { LINK_TAGS, type LinkTag } from "./links.js";
import { isExternal } from "./text.js";

export const LINK_CLASS =
  "underline decoration-fg-subtle/50 underline-offset-4 transition-colors hover:text-fg hover:decoration-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * A link that opens a new tab when it leaves the site, and says so to screen
 * readers. Its text is isolated with dir="auto", so a name like
 * "Shiu et al. (2024)" keeps its parentheses in a right-to-left sentence.
 */
export function SiteLink({
  href,
  children,
  newTab,
  className = LINK_CLASS,
  label,
  title,
  isolate = true,
}: {
  href: string;
  children: ReactNode;
  /** Screen-reader note for links that open a new tab. */
  newTab: string;
  className?: string;
  /** Accessible name, when the visible text alone says too little. */
  label?: string;
  title?: string;
  /**
   * Set the link's direction from its own text (dir="auto"). Off for a
   * full-width row, which should follow the page's direction.
   */
  isolate?: boolean;
}) {
  const dir = isolate ? "auto" : undefined;
  if (isExternal(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        dir={dir}
        aria-label={label ? `${label} ${newTab}` : undefined}
        title={title}
        className={className}
      >
        {children}
        {label ? null : <span className="sr-only"> {newTab}</span>}
      </a>
    );
  }
  return (
    <Link
      href={href}
      dir={dir}
      aria-label={label}
      title={title}
      className={className}
    >
      {children}
    </Link>
  );
}

/** Renderers for `t.rich`: each link tag becomes a link, site pages in the reader's language. */
export function richLinks(
  locale: string,
  newTab: string,
): Record<LinkTag, (chunks: ReactNode) => ReactNode> {
  const entries = Object.entries(LINK_TAGS).map(([tag, href]) => {
    const target = isExternal(href) ? href : localePath(locale, href);
    const render = (chunks: ReactNode) => (
      <SiteLink href={target} newTab={newTab}>
        {chunks}
      </SiteLink>
    );
    return [tag, render] as const;
  });
  return Object.fromEntries(entries) as Record<
    LinkTag,
    (chunks: ReactNode) => ReactNode
  >;
}

/** An arrow that points the way the reader reads. */
export function ForwardArrow() {
  return (
    <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
      →
    </span>
  );
}
