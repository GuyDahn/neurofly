/**
 * Fills `{name}` placeholders. Only for the few messages a client component
 * formats on every frame; `pnpm i18n:check` keeps those messages to plain
 * placeholders.
 */
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
