import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Nothing on a phone should drag sideways. `html, body` carry
 * `overflow-x: clip` as a safety net, which would make the page pass on its
 * own, so each check lifts the net first and measures the real layout.
 *
 * Checked in English, both right-to-left scripts (where overflow shows up on
 * the other side), and German for its long words.
 */
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
];

export const OVERFLOW_PAGES = [
  "/en",
  "/he",
  "/ar",
  "/de",
  "/en/about",
  "/en/modules/smell-memory",
  "/en/modules/compass",
  "/en/modules/escape",
];

/** Lifts the safety net, then names every element that reaches past either edge. */
export async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    for (const el of [document.documentElement, document.body]) {
      el.style.overflowX = "visible";
    }
    const width = window.innerWidth;
    // An element inside its own scroller can't widen the page, and can
    // still be reached. One cut off by an `overflow: hidden` parent can't,
    // so that still counts.
    const scrolled = (el: Element) => {
      for (
        let node = el.parentElement;
        node && node !== document.body;
        node = node.parentElement
      ) {
        const { overflowX } = getComputedStyle(node);
        if (overflowX === "auto" || overflowX === "scroll") return true;
      }
      return false;
    };
    const offenders = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return false;
        return (box.right > width + 1 || box.left < -1) && !scrolled(el);
      })
      .map((el) => {
        const box = el.getBoundingClientRect();
        const name = el.id ? `#${el.id}` : "";
        const text = (el.textContent ?? "").trim().slice(0, 40);
        return `${el.tagName.toLowerCase()}${name} [${Math.round(box.left)}, ${Math.round(box.right)}] "${text}"`;
      });
    const scrollWidth = document.documentElement.scrollWidth;
    for (const el of [document.documentElement, document.body]) {
      el.style.overflowX = "";
    }
    return { scrollWidth, width, offenders };
  });
}

/** The phone menu's button, by its label in the page's language. */
function menuButton(page: Page, path: string) {
  const locale = path.split("/")[1]!;
  const url = new URL(
    `../../apps/web/messages/${locale}.json`,
    import.meta.url,
  );
  const { menuOpen } = JSON.parse(readFileSync(url, "utf8")).nav;
  return page.getByRole("button", { name: menuOpen, exact: true });
}

for (const viewport of VIEWPORTS) {
  test.describe(`no sideways scroll at ${viewport.width}×${viewport.height}`, () => {
    for (const path of OVERFLOW_PAGES) {
      test(path, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const { scrollWidth, width, offenders } = await measureOverflow(page);
        expect(offenders, offenders.join("\n")).toEqual([]);
        expect(scrollWidth).toBeLessThanOrEqual(width);
      });

      test(`${path} with the menu open`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const sheetId = await menuButton(page, path).getAttribute(
          "aria-controls",
        );
        // By what it controls: its label changes to "Close menu" once open.
        const button = page.locator(`button[aria-controls="${sheetId}"]`);
        await button.click();
        await expect(button).toHaveAttribute("aria-expanded", "true");
        const sheet = page.locator(`[id="${sheetId}"]`);
        // Unfold the language list inside the sheet too.
        await sheet.locator("button[aria-expanded]").last().click();
        const { scrollWidth, width, offenders } = await measureOverflow(page);
        expect(offenders, offenders.join("\n")).toEqual([]);
        expect(scrollWidth).toBeLessThanOrEqual(width);
      });
    }
  });
}
