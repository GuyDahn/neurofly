import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "./src/i18n/locales";
import { routeRequest } from "./src/i18n/route";
import { routeHost } from "./src/site/host";

/**
 * Pages get language routing: not Next.js or Vercel internals, API routes,
 * the simulator bench, or files (icons, share images, sitemaps, manifests).
 */
const PAGE = /^\/(?!_|api(?:\/|$)|sim-bench|.*\..*)/;

/**
 * Old addresses move to wiredmind.app, then pages get language routing.
 * The host rules are in src/site/host.ts, the language rules in
 * src/i18n/route.ts, each with its reasons.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = routeHost({
    host: request.headers.get("host") ?? request.nextUrl.host,
    pathname,
    search,
  });
  if (host.kind === "redirect") {
    return NextResponse.redirect(host.url, host.status);
  }
  const response = PAGE.test(pathname)
    ? routeLanguage(request)
    : NextResponse.next();
  if (host.kind === "noindex" && !response.headers.has("X-Robots-Tag")) {
    response.headers.set("X-Robots-Tag", "noindex");
  }
  return response;
}

function routeLanguage(request: NextRequest): NextResponse {
  const decision = routeRequest({
    pathname: request.nextUrl.pathname,
    hasReplay: request.nextUrl.searchParams.has("r"),
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
    country: request.headers.get("x-vercel-ip-country"),
  });
  if (decision.kind === "next") return NextResponse.next();
  const target = request.nextUrl.clone();
  target.pathname = decision.pathname;
  if (decision.kind === "rewrite") {
    const response = NextResponse.rewrite(target);
    // Its canonical link points at /en, so keep this copy out of search.
    response.headers.set("X-Robots-Tag", "noindex, follow");
    return response;
  }
  const response = NextResponse.redirect(target, decision.status);
  if (decision.vary) response.headers.set("Vary", decision.vary);
  return response;
}

export const config = {
  // Everything but build output and the big data files, so an old address
  // redirects its robots.txt, sitemaps, and share images too.
  matcher: ["/((?!_next/|_vercel/|data/|draco/).*)"],
};
