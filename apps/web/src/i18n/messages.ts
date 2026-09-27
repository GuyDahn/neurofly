import type en from "../../messages/en.json";

/** One language's copy, as next-intl sees it: every key of en.json but the review notes. */
export type Messages = Omit<typeof en, "_meta">;

/** A tree of copy, or a branch of one. */
export type MessageTree = { [key: string]: string | MessageTree };

/** Review notes kept in each messages file for translators. The site never shows them. */
export type MessagesMeta = {
  locale: string;
  reviewed: boolean;
  /** Keys drafted after the file was reviewed, still waiting for a reviewer. */
  unreviewedKeys?: string[];
  /** Keys whose translation really is the same as the English. */
  sameAsSource?: string[];
  model?: string;
  draftedAt?: string;
};

export function withoutMeta<T extends { _meta?: unknown }>(
  file: T,
): Omit<T, "_meta"> {
  const messages: Partial<T> = { ...file };
  delete messages._meta;
  return messages as Omit<T, "_meta">;
}

/**
 * Only the branches a page's client components read, e.g.
 * `pick(messages, ["viewer", "lessons.escape"])`. Everything else stays on
 * the server, so a page never downloads another page's copy.
 */
export function pick(
  messages: MessageTree,
  paths: readonly string[],
): MessageTree {
  const out: MessageTree = {};
  for (const path of paths) {
    const keys = path.split(".");
    let from: string | MessageTree | undefined = messages;
    for (const key of keys) {
      from = typeof from === "object" ? from[key] : undefined;
    }
    if (from === undefined) throw new Error(`No messages at ${path}`);
    let into = out;
    keys.forEach((key, index) => {
      if (index === keys.length - 1) {
        // A copy, so a later, deeper path never writes into the source.
        into[key] = typeof from === "object" ? structuredClone(from) : from;
      } else {
        const next = into[key];
        into = typeof next === "object" ? next : (into[key] = {});
      }
    });
  }
  return out;
}
