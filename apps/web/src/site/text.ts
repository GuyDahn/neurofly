/** A link inside a sentence of site copy. */
export type Link = { text: string; href: string };

/**
 * A sentence split into plain runs and links, in reading order, so a
 * translation can put the link anywhere in the sentence.
 */
export type Rich = readonly (string | Link)[];

/** Fills `{name}` placeholders in a copy template. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/** Links that leave the site open in a new tab. */
export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}
