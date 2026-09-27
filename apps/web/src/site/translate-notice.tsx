"use client";

import { useEffect, useState } from "react";
import { canonicalLocale, isFallbackLocale, LOCALES } from "../i18n/locales.js";

const DISMISSED = "wiredmind:translate-notice:";

/** Languages the site is written in, by their base subtag. Malay readers get Indonesian. */
const WRITTEN = new Set([...LOCALES.map((locale) => base(locale)), "ms"]);

function base(tag: string): string {
  return tag.split("-")[0]!.toLowerCase();
}

/**
 * The language this reader wanted and did not get: the one in a fallback URL
 * such as /fa/about, or their browser's first choice.
 */
function missingLanguage(): string | null {
  const segment = window.location.pathname.split("/")[1] ?? "";
  const named = canonicalLocale(segment);
  if (named && isFallbackLocale(named)) return named;
  const first = navigator.languages?.[0] ?? navigator.language;
  if (!first) return null;
  try {
    const [tag] = Intl.getCanonicalLocales(first);
    if (!tag || WRITTEN.has(base(tag))) return null;
    return tag;
  } catch {
    return null;
  }
}

/** "Persian (فارسی)": the English name for this English page, then the language's own. */
function languageName(tag: string): string | null {
  try {
    const english = new Intl.DisplayNames(["en"], { type: "language" }).of(tag);
    const own = new Intl.DisplayNames([tag], { type: "language" }).of(tag);
    if (!english || english === tag) return null;
    return own && own !== english ? `${english} (${own})` : english;
  } catch {
    return null;
  }
}

/**
 * A one-line note on English pages for readers whose language WiredMind is
 * not written in yet, pointing at how to add it. It shows nothing on the
 * server and nothing to readers the site already speaks to.
 */
export function TranslateNotice({
  notice,
  cta,
  dismiss,
  href,
  className = "",
}: {
  /** The note, with {language} where the language's name goes. */
  notice: string;
  cta: string;
  dismiss: string;
  href: string;
  className?: string;
}) {
  const [missing, setMissing] = useState<{ tag: string; name: string } | null>(
    null,
  );

  useEffect(() => {
    const tag = missingLanguage();
    if (!tag) return;
    try {
      if (window.localStorage.getItem(DISMISSED + base(tag))) return;
    } catch {
      // Storage can be off; show the note anyway.
    }
    const name = languageName(tag);
    if (name) setMissing({ tag, name });
  }, []);

  if (!missing) return null;
  const [before = "", after = ""] = notice.split("{language}");

  function close() {
    try {
      window.localStorage.setItem(DISMISSED + base(missing!.tag), "1");
    } catch {
      // Nothing to remember it in; it just closes for now.
    }
    setMissing(null);
  }

  return (
    <div
      role="note"
      className={`flex items-start gap-3 bg-sky-400/10 px-4 py-2.5 text-sm text-sky-100 ${className}`}
    >
      <p className="flex-1 leading-snug">
        {before}
        <bdi>{missing.name}</bdi>
        {after}{" "}
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className="font-semibold underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {cta}
        </a>
      </p>
      <button
        type="button"
        onClick={close}
        aria-label={dismiss}
        className="-my-1 flex size-8 shrink-0 items-center justify-center rounded-md text-sky-200 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4 fill-none stroke-current"
          strokeWidth="1.8"
        >
          <path d="m4 4 8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}
