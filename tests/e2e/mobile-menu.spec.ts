import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** Below `md`, the header folds into one menu button; from `md` up it stays inline. */
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

type Nav = {
  lessons: string;
  teachers: string;
  about: string;
  menuOpen: string;
  menuClose: string;
};
function nav(locale: string): Nav {
  const url = new URL(
    `../../apps/web/messages/${locale}.json`,
    import.meta.url,
  );
  return JSON.parse(readFileSync(url, "utf8")).nav as Nav;
}

const menuButton = (page: Page, copy: Nav) =>
  page.getByRole("button", {
    name: new RegExp(`^(${copy.menuOpen}|${copy.menuClose})$`),
  });

/** The element the button's aria-controls names. */
async function sheet(page: Page, copy: Nav) {
  const id = await menuButton(page, copy).getAttribute("aria-controls");
  return page.locator(`[id="${id}"]`);
}

async function openMenu(page: Page, copy: Nav) {
  await menuButton(page, copy).tap();
  await expect(menuButton(page, copy)).toHaveAttribute("aria-expanded", "true");
  const menu = await sheet(page, copy);
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("phone menu at 390×844", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ context }) => {
    // External links open in a new tab; keep them off the network.
    await context.route(
      /^https:\/\/(github\.com|buymeacoffee\.com)\//,
      (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<title>stub</title>",
        }),
    );
  });

  for (const locale of ["en", "he"]) {
    const copy = nav(locale);

    test(`${locale}: button instead of inline links`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(menuButton(page, copy)).toBeVisible();
      await expect(menuButton(page, copy)).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      const header = page.locator("header");
      for (const name of [copy.lessons, copy.teachers, copy.about]) {
        await expect(
          header
            .getByRole("link", { name, exact: true, includeHidden: true })
            .filter({ visible: true }),
        ).toHaveCount(0);
      }
      // Right-to-left: the button sits on the left, the sheet reads from the right.
      const box = (await menuButton(page, copy).boundingBox())!;
      if (locale === "he") expect(box.x).toBeLessThan(PHONE.width / 2);
      else expect(box.x).toBeGreaterThan(PHONE.width / 2);
    });

    test(`${locale}: focus moves in, Tab stays in, Esc closes and returns focus`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await page.waitForLoadState("networkidle");
      const menu = await openMenu(page, copy);
      const button = menuButton(page, copy);
      await expect(button).toHaveAccessibleName(copy.menuClose);

      const sheetId = (await button.getAttribute("aria-controls"))!;
      const inside = () =>
        page.evaluate((id) => {
          const active = document.activeElement;
          const sheet = document.getElementById(id);
          return (
            !!active &&
            (sheet?.contains(active) === true ||
              active.getAttribute("aria-controls") === id)
          );
        }, sheetId);
      expect(
        await menu.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
      const stops = await menu.locator("a[href], button").count();
      for (let press = 0; press < stops + 3; press++) {
        await page.keyboard.press("Tab");
        expect(await inside()).toBe(true);
      }
      for (let press = 0; press < 3; press++) {
        await page.keyboard.press("Shift+Tab");
        expect(await inside()).toBe(true);
      }

      // Every row is a comfortable tap.
      for (const row of await menu.locator("a[href], button").all()) {
        if (!(await row.isVisible())) continue;
        // Rounded: the sheet's top can sit on a fraction of a pixel.
        expect(
          Math.round((await row.boundingBox())!.height),
        ).toBeGreaterThanOrEqual(44);
      }
      // The sheet's text starts at the reading edge.
      const align = await menu
        .locator("a")
        .first()
        .evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const text = range.getBoundingClientRect();
          return { left: text.left, right: innerWidth - text.right };
        });
      if (locale === "he") expect(align.right).toBeLessThan(align.left);
      else expect(align.left).toBeLessThan(align.right);

      await page.keyboard.press("Escape");
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(menu).toBeHidden();
      await expect(button).toBeFocused();
      await expect(button).toHaveAccessibleName(copy.menuOpen);
    });

    test(`${locale}: body scroll is locked while open`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await openMenu(page, copy);
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).overflowY,
        ),
      ).toBe("hidden");
      await menuButton(page, copy).tap();
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).overflowY,
        ),
      ).not.toBe("hidden");
    });

    test(`${locale}: tapping outside closes`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const menu = await openMenu(page, copy);
      await page.touchscreen.tap(PHONE.width / 2, PHONE.height - 20);
      await expect(menu).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    });

    test(`${locale}: every link navigates and closes the menu`, async ({
      page,
      context,
    }) => {
      await page.goto(`/${locale}`);
      await page.waitForLoadState("networkidle");
      const count = await (
        await openMenu(page, copy)
      )
        .locator("a[href]")
        .count();
      expect(count).toBeGreaterThanOrEqual(9);
      await menuButton(page, copy).tap();

      for (let index = 0; index < count; index++) {
        await page.goto(`/${locale}`);
        const menu = await openMenu(page, copy);
        const link = menu.locator("a[href]").nth(index);
        const href = (await link.getAttribute("href"))!;
        if ((await link.getAttribute("target")) === "_blank") {
          const popup = context.waitForEvent("page");
          await link.tap();
          expect((await popup).url()).toBe(href);
          await (await popup).close();
          await expect(menu).toBeHidden();
        } else {
          await link.tap();
          await expect(page).toHaveURL(
            (url) => `${url.pathname}${url.hash}` === href,
          );
          await expect(await sheet(page, copy)).toBeHidden();
          await expect(menuButton(page, copy)).toHaveAttribute(
            "aria-expanded",
            "false",
          );
        }
      }
    });
  }

  test("lesson pages get the same menu", async ({ page }) => {
    const copy = nav("en");
    await page.goto("/en/modules/escape");
    const menu = await openMenu(page, copy);
    await expect(
      menu.getByRole("link", { name: copy.about, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });
});

test.describe("desktop at 1280×800", () => {
  test.use({ viewport: DESKTOP });

  for (const path of ["/en", "/he", "/en/modules/escape"]) {
    test(`${path}: no menu button`, async ({ page }) => {
      const copy = nav(path.split("/")[1]!);
      await page.goto(path);
      await expect(menuButton(page, copy)).toBeHidden();
      if (!path.includes("modules")) {
        await expect(
          page
            .locator("header")
            .getByRole("link", { name: copy.about, exact: true }),
        ).toBeVisible();
      }
    });
  }
});
