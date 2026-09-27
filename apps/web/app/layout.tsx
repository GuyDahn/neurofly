import type { ReactNode } from "react";

/**
 * Pages render their own <html> in app/[locale]/layout.tsx, so it can carry
 * the page's language and direction. This root only passes them through, and
 * exists so app/not-found.tsx has a layout.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
