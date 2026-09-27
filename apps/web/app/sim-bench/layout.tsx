import type { ReactNode } from "react";
import "../globals.css";

/**
 * The simulator bench is a developer tool, not a page for classrooms: it stays
 * in English, outside the language routes, and out of search results.
 */
export default function SimBenchLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
