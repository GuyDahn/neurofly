"use client";

import { useEffect, useState } from "react";
import { applyTheme, THEME_STORAGE_KEY } from "./theme.js";

/** The header's light/dark switch. Starts blank so the server and the first client render agree; the inline theme script has already set the real class by then. */
export function ThemeToggle({
  light,
  dark,
}: {
  /** Accessible label when dark is active, for the switch to light. */
  light: string;
  /** Accessible label when light is active, for the switch to dark. */
  dark: string;
}) {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        // Storage can be off; treat it as no explicit choice.
      }
      if (stored === "light" || stored === "dark") return;
      applyTheme(event.matches);
      setIsDark(event.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = !(isDark ?? true);
    applyTheme(next);
    setIsDark(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Nothing to remember it in; it just follows the system again next visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark === null ? undefined : isDark ? light : dark}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-fg-subtle transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {isDark === null ? (
        <span className="block size-5" />
      ) : isDark ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5 shrink-0 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="10" cy="10" r="3.75" />
      <path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M15.66 4.34l-1.42 1.42M5.76 14.24l-1.42 1.42M15.66 15.66l-1.42-1.42M5.76 5.76 4.34 4.34" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5 shrink-0 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M17.5 12.13A7.75 7.75 0 1 1 7.87 2.5a6.25 6.25 0 0 0 9.63 9.63Z" />
    </svg>
  );
}
