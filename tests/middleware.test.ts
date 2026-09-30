import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { RETIRED_HOSTS, routeHost } from "../apps/web/src/site/host.js";
import { SITE_URL } from "../apps/web/src/site/site.js";

// Next.js is the web app's dependency, not the repo root's, and the
// middleware is built by Next.js, not by the scripts' TypeScript setup:
// load both at runtime, from the web app.
const { NextRequest } = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
)("next/server") as {
  NextRequest: new (url: string, init?: RequestInit) => Request;
};
const MIDDLEWARE = new URL("../apps/web/middleware.ts", import.meta.url).href;
const { middleware } = (await import(MIDDLEWARE)) as {
  middleware: (request: Request) => Response;
};

function request(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    headers: { host: new URL(url).host, ...headers },
  });
}

describe("host routing", () => {
  it("lives at wiredmind.app", () => {
    assert.equal(SITE_URL, "https://wiredmind.app");
  });

  it("moves an old address to the same page on wiredmind.app, keeping ?r=", () => {
    const response = middleware(
      request("https://wiredmind-edu.vercel.app/he/modules/escape?r=abc"),
    );
    assert.equal(response.status, 308);
    assert.equal(
      response.headers.get("location"),
      "https://wiredmind.app/he/modules/escape?r=abc",
    );
  });

  it("moves every retired host, files and the bare root included", () => {
    for (const host of RETIRED_HOSTS) {
      for (const path of ["/", "/robots.txt", "/sitemap.xml", "/en/about"]) {
        const response = middleware(request(`https://${host}${path}`));
        assert.equal(response.status, 308, `${host}${path}`);
        assert.equal(
          response.headers.get("location"),
          `https://wiredmind.app${path}`,
        );
      }
    }
  });

  it("leaves wiredmind.app itself alone", () => {
    const response = middleware(
      request("https://wiredmind.app/he/modules/escape?r=abc"),
    );
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(response.headers.get("x-robots-tag"), null);
  });

  it("still routes languages on wiredmind.app", () => {
    const response = middleware(
      request("https://wiredmind.app/", { "accept-language": "he" }),
    );
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://wiredmind.app/he");
  });

  it("serves previews, but keeps them out of search", () => {
    for (const host of [
      "wiredmind-edu-git-fix-mobile-header-guy-dev.vercel.app",
      "wiredmind-edu-3k9x2ab1c-guy-dev.vercel.app",
    ]) {
      const response = middleware(
        request(`https://${host}/he/modules/escape?r=abc`),
      );
      assert.equal(response.headers.get("location"), null, host);
      assert.equal(response.headers.get("x-robots-tag"), "noindex", host);
      const file = middleware(request(`https://${host}/robots.txt`));
      assert.equal(file.headers.get("x-robots-tag"), "noindex", host);
    }
  });

  it("ignores case and ports in the host", () => {
    assert.deepEqual(
      routeHost({
        host: "WiredMind-EDU.vercel.app:443",
        pathname: "/",
        search: "",
      }),
      { kind: "redirect", status: 308, url: "https://wiredmind.app/" },
    );
    assert.deepEqual(
      routeHost({ host: "localhost:3000", pathname: "/", search: "" }),
      { kind: "serve" },
    );
  });
});
