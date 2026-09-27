import Link from "next/link";
import { siteCopy } from "./copy.js";
import { LINK_CLASS, SiteLink } from "./rich-text.js";
import { REPO_URL } from "./site.js";

/**
 * The credit line on every page. The coffee link is left out wherever a lesson
 * is running, so students are never asked for anything mid-lesson.
 */
export function CreditLine({ coffee }: { coffee: boolean }) {
  const copy = siteCopy();
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Link href="/about#who-made-this" className={LINK_CLASS}>
        {copy.footer.builtBy}
      </Link>
      <span aria-hidden="true">·</span>
      <SiteLink href={REPO_URL} newTab={copy.a11y.newTab}>
        {copy.footer.github}
      </SiteLink>
      {coffee ? (
        <>
          <span aria-hidden="true">·</span>
          <SiteLink href={copy.support.coffee.href} newTab={copy.a11y.newTab}>
            {copy.support.coffee.text}
          </SiteLink>
        </>
      ) : (
        <>
          <span aria-hidden="true">·</span>
          <Link href="/about" className={LINK_CLASS}>
            {copy.footer.about}
          </Link>
        </>
      )}
    </p>
  );
}

export function SiteFooter() {
  const copy = siteCopy();
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <CreditLine coffee />
        <p className="text-xs text-zinc-500">
          <Link href="/about" className={LINK_CLASS}>
            {copy.footer.about}
          </Link>
          <span aria-hidden="true"> · </span>
          {copy.footer.license}
        </p>
      </div>
    </footer>
  );
}
