import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Classroom tablets and phones need a 44×44 px hit area (WCAG 2.5.8).
 *
 * A link embedded in running text (a credit line, a citation) is allowed
 * to stay text-sized: its container carries `data-tap-target="text"`,
 * checked here by ancestry rather than by computed style, since a flex
 * parent blockifies its children's `display` regardless of intent.
 */
const MIN_HEIGHT = 44;
const VIEWPORT = { width: 375, height: 812 };
const EXEMPT_ANCESTOR = '[data-tap-target="text"]';

const PAGES = [
  "/en",
  "/he",
  "/en/about",
  "/en/modules/smell-memory",
  "/en/modules/compass",
  "/en/modules/escape",
];

async function label(el: Locator): Promise<string> {
  const tag = await el.evaluate((node) => node.tagName.toLowerCase());
  const text = (await el.textContent())
    ?.trim()
    .replace(/\s+/g, " ")
    .slice(0, 50);
  return `${tag} "${text}"`;
}

async function undersizedControls(page: Page): Promise<string[]> {
  const found: string[] = [];
  const controls = page.locator("a, button, [role='button']");
  const count = await controls.count();
  for (let index = 0; index < count; index++) {
    const el = controls.nth(index);
    if (!(await el.isVisible())) continue;
    // sr-only until focused (a skip link): Playwright's isVisible() doesn't
    // know about the clip-path trick, but a screen reader user never taps it.
    if (await el.evaluate((n) => n.classList.contains("sr-only"))) continue;
    // Next.js's own dev-mode indicator, in a shadow root: not this app's markup.
    if (await el.evaluate((n) => n.getRootNode() !== document)) continue;
    if (
      (await el
        .locator(`xpath=ancestor-or-self::*[${toXpathAttr(EXEMPT_ANCESTOR)}]`)
        .count()) > 0
    ) {
      continue;
    }
    const box = await el.boundingBox();
    if (!box) continue;
    if (box.height < MIN_HEIGHT) {
      found.push(`${await label(el)}: ${Math.round(box.height)}px`);
    }
  }
  return found;
}

/** `[data-tap-target="text"]` as the equivalent XPath attribute test. */
function toXpathAttr(selector: string): string {
  const match = /\[data-tap-target="([^"]+)"\]/.exec(selector);
  if (!match) throw new Error(`unsupported selector ${selector}`);
  return `@data-tap-target="${match[1]}"`;
}

test.describe("tap targets at 375×812", () => {
  for (const path of PAGES) {
    test(`every control on ${path} is at least ${MIN_HEIGHT}px tall`, async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORT);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const undersized = await undersizedControls(page);
      expect(undersized, undersized.join("\n")).toEqual([]);
    });
  }
});
