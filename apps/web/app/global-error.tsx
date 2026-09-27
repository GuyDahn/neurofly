"use client";

import { useEffect } from "react";
import {
  DEFAULT_LOCALE,
  direction,
  isLocale,
  localePath,
  type Locale,
} from "@/src/i18n/locales";
import { readErrorCopy } from "@/src/site/error-copy";
import { SITE_NAME } from "@/src/site/site";

// Keep the copy the layout wrote before a crash in the root layout replaces
// the document.
if (typeof document !== "undefined") readErrorCopy();

/** The language in the URL, since the layout that knew it has crashed. */
function urlLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const segment = window.location.pathname.split("/")[1] ?? "";
  return isLocale(segment) ? segment : DEFAULT_LOCALE;
}

/**
 * Shown only when the root layout itself fails. It says what the layout
 * wrote into the page; if the layout never rendered, it offers the retry and
 * the way home without words.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = urlLocale();
  const copy = readErrorCopy();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale} dir={direction(locale)}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
        }}
      >
        <main style={{ maxWidth: "36rem", padding: "2rem 1rem" }}>
          {copy ? (
            <>
              <h1 style={{ fontSize: "1.875rem", margin: "0 0 1rem" }}>
                {copy.title}
              </h1>
              <p style={{ color: "#d4d4d8", lineHeight: 1.6 }}>{copy.body}</p>
            </>
          ) : null}
          <p style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
            <button type="button" onClick={reset} aria-label={copy?.retry}>
              {copy?.retry ?? "↻"}
            </button>
            <a href={localePath(locale, "/")} style={{ color: "#fafafa" }}>
              {copy?.home ?? SITE_NAME}
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
