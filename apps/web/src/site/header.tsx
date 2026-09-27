import Link from "next/link";
import { siteCopy } from "./copy.js";
import { SITE_NAME } from "./site.js";

const NAV_LINK =
  "rounded-md px-1 py-1 text-zinc-300 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** The spike mark from the favicon: a trace that goes blue, red, then yellow, like the escape cascade. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className}>
      <defs>
        <linearGradient id="wiredmind-mark" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="0.55" stopColor="#F87171" />
          <stop offset="1" stopColor="#FACC15" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#18181b" />
      <path
        d="M4.5 18.5h6.5l2.6-11 3.6 17 2.4-9.5h7.9"
        fill="none"
        stroke="url(#wiredmind-mark)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SiteHeader() {
  const copy = siteCopy();
  return (
    <header className="border-b border-white/10">
      <a
        href="#main"
        className="sr-only rounded-md bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-950 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        {copy.a11y.skip}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label={copy.nav.home}
          className="flex items-center gap-2.5 rounded-md text-lg font-semibold tracking-tight text-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <Mark className="size-7" />
          {SITE_NAME}
        </Link>
        <nav
          aria-label="Site"
          className="flex items-center gap-3 text-sm sm:gap-5"
        >
          <Link href="/#lessons" className={NAV_LINK}>
            {copy.nav.lessons}
          </Link>
          <Link href="/#teachers" className={`${NAV_LINK} hidden sm:inline`}>
            {copy.nav.teachers}
          </Link>
          <Link href="/about" className={NAV_LINK}>
            {copy.nav.about}
          </Link>
        </nav>
      </div>
    </header>
  );
}
