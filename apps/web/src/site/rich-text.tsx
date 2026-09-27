import Link from "next/link";
import type { ReactNode } from "react";
import { isExternal, type Rich } from "./text.js";

export const LINK_CLASS =
  "underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** A link that opens a new tab when it leaves the site, and says so to screen readers. */
export function SiteLink({
  href,
  children,
  newTab,
  className = LINK_CLASS,
}: {
  href: string;
  children: ReactNode;
  /** Screen-reader note for links that open a new tab. */
  newTab: string;
  className?: string;
}) {
  if (isExternal(href)) {
    return (
      <a href={href} target="_blank" rel="noopener" className={className}>
        {children}
        <span className="sr-only"> {newTab}</span>
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function RichText({ parts, newTab }: { parts: Rich; newTab: string }) {
  return (
    <>
      {parts.map((part, index) =>
        typeof part === "string" ? (
          part
        ) : (
          <SiteLink key={index} href={part.href} newTab={newTab}>
            {part.text}
          </SiteLink>
        ),
      )}
    </>
  );
}
