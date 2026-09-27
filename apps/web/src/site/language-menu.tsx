"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  direction,
  ENDONYMS,
  LOCALE_COOKIE,
  LOCALES,
  localePath,
  type Locale,
} from "../i18n/locales.js";

/** A year, so a teacher's pick survives until the next school year. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The one cookie the site sets, and only when someone picks a language. */
function rememberLocale(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/**
 * The same page in every language, as plain links a crawler can follow.
 * Each name is written in its own language and script.
 */
export function LanguageMenu({
  current,
  path,
  label,
  menuLabel,
  className = "",
}: {
  current: Locale;
  /** This page without its language, e.g. /about. */
  path: string;
  /** Accessible name of the button, naming the current language. */
  label: string;
  menuLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={list}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md px-1.5 text-fg-muted transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <GlobeIcon />
        <span className="hidden sm:inline" lang={current}>
          {ENDONYMS[current]}
        </span>
      </button>
      {open ? (
        <ul
          id={list}
          aria-label={menuLabel}
          className="absolute end-0 top-full z-50 mt-2 max-h-[min(70dvh,32rem)] w-60 overflow-y-auto overscroll-contain rounded-xl border border-border-strong bg-surface p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.25)] dark:shadow-[0_12px_32px_rgb(0_0_0/0.5)]"
        >
          {LOCALES.map((locale) => (
            <li key={locale}>
              <a
                href={localePath(locale, path)}
                hrefLang={locale}
                lang={locale}
                dir={direction(locale)}
                aria-current={locale === current ? "true" : undefined}
                onClick={() => rememberLocale(locale)}
                className={`flex min-h-11 items-center rounded-lg px-3 text-start text-sm focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${locale === current ? "bg-overlay-strong font-semibold text-fg" : "text-fg-muted hover:bg-overlay"}`}
              >
                {ENDONYMS[locale]}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5 shrink-0 fill-none stroke-current"
      strokeWidth="1.5"
    >
      <circle cx="10" cy="10" r="7.25" />
      <path d="M2.75 10h14.5M10 2.75c2 2.1 3 4.5 3 7.25s-1 5.15-3 7.25c-2-2.1-3-4.5-3-7.25s1-5.15 3-7.25Z" />
    </svg>
  );
}
