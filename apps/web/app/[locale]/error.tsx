"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/src/i18n/locales";
import { readErrorCopy, type ErrorCopy } from "@/src/site/error-copy";

/** A page that crashed, in the reader's language, with a way to retry. */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ locale?: string }>();
  const locale =
    params.locale && isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const [copy, setCopy] = useState<ErrorCopy | null>(null);

  useEffect(() => {
    console.error(error);
    setCopy(readErrorCopy());
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-3xl flex-col items-start justify-center gap-4 px-4 py-16 sm:px-6"
    >
      {copy ? (
        <>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            {copy.title}
          </h1>
          <p className="text-lg leading-relaxed text-zinc-300">{copy.body}</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-zinc-50 px-5 text-base font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {copy.retry}
            </button>
            <a
              href={localePath(locale, "/")}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-5 text-base font-semibold text-zinc-100 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {copy.home}
            </a>
          </div>
        </>
      ) : null}
    </main>
  );
}
