/** What the error pages say, in the page's language. */
export type ErrorCopy = {
  title: string;
  body: string;
  retry: string;
  home: string;
};

/** The layout writes the copy into every page here, as inert JSON. */
export const ERROR_COPY_ID = "wm-error-copy";

let cached: ErrorCopy | null = null;

/**
 * The error copy the layout wrote into the page. Read once and kept, because
 * a crashed root layout takes the element with it.
 */
export function readErrorCopy(): ErrorCopy | null {
  if (cached || typeof document === "undefined") return cached;
  const text = document.getElementById(ERROR_COPY_ID)?.textContent;
  if (!text) return null;
  try {
    cached = JSON.parse(text) as ErrorCopy;
  } catch {
    cached = null;
  }
  return cached;
}
