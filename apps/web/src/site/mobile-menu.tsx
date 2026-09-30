"use client";

import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Tailwind's `md`, where the inline header takes over. */
const WIDE = "(min-width: 48rem)";

const noSubscribe = () => () => {};

/**
 * One site menu per page, so a fixed id. Not useId(): the button's
 * aria-controls comes from the server HTML, which hydration never corrects,
 * while the sheet is rendered only in the browser, where a lesson page's
 * tree can give useId() a different answer.
 */
const SHEET_ID = "site-menu";

/**
 * Below `md`, the header's links and switches fold into one button that opens
 * a full-width sheet under the header.
 *
 * The sheet renders into <body>, so no stacking context can cover it (a
 * lesson's panel paints over its stage on phones). It stays mounted, hidden
 * with `visibility` and `inert`, so it can fade out as well as in.
 */
export function MobileMenu({
  openLabel,
  closeLabel,
  children,
  className = "",
  buttonClassName = "text-fg-muted hover:text-fg focus-visible:outline-ring",
}: {
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
  /** The button's colors, e.g. light-on-dark over a lesson's stage. */
  buttonClassName?: string;
}) {
  const pathname = usePathname();
  // The page the menu was opened on: moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn !== null && openOn === pathname;
  // Each opening starts the sheet fresh, e.g. with the language list folded.
  const [session, setSession] = useState(0);
  const [top, setTop] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  // <body> exists only in the browser; the server renders the button alone.
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

  function show() {
    const header = button.current?.closest("header");
    setTop(header?.getBoundingClientRect().bottom ?? 0);
    setSession((value) => value + 1);
    setOpenOn(pathname);
  }

  /** `refocusButton` sends focus back to the button; not after following a link. */
  function hide(refocusButton: boolean) {
    refocus.current = refocusButton;
    setOpenOn(null);
  }

  useEffect(() => {
    if (!open) {
      // After the render, so it wins over anything inside the sheet that
      // moved focus on the same key press.
      if (refocus.current) button.current?.focus();
      refocus.current = false;
      return;
    }
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";

    const close = (refocusButton: boolean) => {
      refocus.current = refocusButton;
      setOpenOn(null);
    };
    // The button, then the sheet: the sheet sits at the end of <body>, so
    // Tab moves between them by hand, round and round.
    const focusables = () =>
      [
        button.current,
        ...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
      ].filter(
        (el): el is HTMLElement => !!el && el.getClientRects().length > 0,
      );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close(true);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      event.preventDefault();
      const at = items.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      const next = at === -1 ? 0 : (at + step + items.length) % items.length;
      items[next]!.focus();
    };
    const onClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      if (button.current?.contains(target) || panel.current?.contains(target)) {
        return;
      }
      close(true);
    };
    // Rotating a tablet past `md` brings the inline header back.
    const wide = window.matchMedia(WIDE);
    const onWide = (event: MediaQueryListEvent) => {
      if (event.matches) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  function onPanelClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as Element).closest("a[href]")) hide(false);
  }

  // Opening shows the sheet at once, so focus can land in it; closing keeps
  // it visible until the fade ends. Without motion, both are instant.
  const fade = open
    ? "visible opacity-100 motion-safe:transition-[opacity,translate]"
    : "invisible opacity-0 motion-safe:transition-[opacity,translate,visibility]";

  return (
    <div className={className}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={SHEET_ID}
        aria-label={open ? closeLabel : openLabel}
        onClick={() => (open ? hide(true) : show())}
        className={`flex min-h-11 min-w-11 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${buttonClassName}`}
      >
        <MenuIcon open={open} />
      </button>
      {hydrated
        ? createPortal(
            <>
              <div
                aria-hidden="true"
                style={{ top }}
                className={`fixed inset-x-0 bottom-0 z-40 bg-black/40 motion-safe:duration-200 md:hidden ${fade}`}
              />
              <div
                ref={panel}
                id={SHEET_ID}
                inert={!open}
                onClick={onPanelClick}
                style={{ top, maxHeight: `calc(100dvh - ${top}px)` }}
                className={`fixed inset-x-0 z-50 overflow-y-auto overscroll-contain border-b border-border bg-canvas text-start text-fg shadow-[0_12px_32px_rgb(0_0_0/0.25)] motion-safe:duration-200 motion-safe:ease-out md:hidden dark:shadow-[0_12px_32px_rgb(0_0_0/0.5)] ${fade} ${open ? "translate-y-0" : "-translate-y-2"}`}
              >
                <div
                  key={session}
                  className="mx-auto flex max-w-6xl flex-col px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"
                >
                  {children}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5 shrink-0 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      {open ? (
        <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
      ) : (
        <path d="M3 5.5h14M3 10h14M3 14.5h14" />
      )}
    </svg>
  );
}
