/**
 * Light/dark mode: a manual choice remembered in `localStorage`, or the
 * system's preference until someone picks one. No cookie, so the about
 * page's promise (the only cookie is the language) stays true.
 */

export const THEME_STORAGE_KEY = "wiredmind:theme";

/**
 * Runs before paint, as the first thing in `<body>`, so the page never
 * flashes the wrong theme. Plain ES5: it must parse standalone, with no
 * bundling or module system.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)},s=localStorage.getItem(k),d=s?s==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#09090b" : "#ffffff");
}
