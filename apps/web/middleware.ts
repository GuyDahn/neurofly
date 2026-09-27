import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "./src/i18n/locales";
import { routeRequest } from "./src/i18n/route";

/** Language routing. The rules, and why, are in src/i18n/route.ts. */
export function middleware(request: NextRequest) {
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
  // Pages only: no Next.js or Vercel internals, API routes, the simulator
  // bench, or files (data, icons, share images, sitemaps, manifests).
  matcher: ["/((?!_|api(?:/|$)|sim-bench|.*\\..*).*)"],
};
