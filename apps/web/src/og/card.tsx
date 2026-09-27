import { ImageResponse } from "next/og";
import { direction, type Locale } from "../i18n/locales.js";
import { readCascade } from "../site/cascade.js";
import { readCascadeFile } from "../site/cascade-file.js";
import { cascadeSvg } from "../site/cascade-svg.js";
import type { SharePage } from "../site/page-meta.js";
import { SITE_NAME, SITE_URL } from "../site/site.js";
import { fontsFor } from "./fonts.js";
import { shareCard, SHARE_PAGES } from "./share-card.js";
import { textImage, type TextImage } from "./text.js";

export const CARD_SIZE = { width: 1200, height: 630 };

const ART = { width: 690, height: 431 };
const COLUMN = 516;
const PAD = 64;

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#38BDF8"/><stop offset="0.55" stop-color="#F87171"/><stop offset="1" stop-color="#FACC15"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="#18181b"/><path d="M4.5 18.5h6.5l2.6-11 3.6 17 2.4-9.5h7.9" fill="none" stroke="url(#g)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function dataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The loop's still frame, when the build fetched the circuit data. */
async function cascadeArt(): Promise<string | null> {
  const file = await readCascadeFile();
  if (!file) return null;
  try {
    return dataUri(
      cascadeSvg(readCascade(JSON.parse(file.raw)), ART.width, ART.height),
    );
  } catch {
    return null;
  }
}

type Lines = { title: TextImage; subtitle: TextImage; label: TextImage | null };

async function shapeCard(locale: Locale, page: SharePage): Promise<Lines> {
  const cards = await Promise.all(
    SHARE_PAGES.map((each) => shareCard(locale, each)),
  );
  const card = cards[SHARE_PAGES.indexOf(page)];
  if (!card) throw new Error(`No share card for ${page}`);
  // Every card's words at once, so the language's fonts download once.
  const text = cards
    .flatMap((each) => [each.title, each.subtitle, each.label ?? ""])
    .join("");
  const [bold, regular] = await Promise.all([
    fontsFor(locale, 600, text),
    fontsFor(locale, 400, text),
  ]);
  const rtl = direction(locale) === "rtl";
  const common = { rtl, locale, maxWidth: COLUMN };
  return {
    label: card.label
      ? await textImage({
          ...common,
          text: card.label,
          fonts: regular,
          size: 24,
          lineHeight: 1.3,
          maxLines: 1,
          color: "#7dd3fc",
        })
      : null,
    title: await textImage({
      ...common,
      text: card.title,
      fonts: bold,
      size: 54,
      minSize: 38,
      lineHeight: 1.12,
      maxLines: 3,
      color: "#fafafa",
    }),
    subtitle: await textImage({
      ...common,
      text: card.subtitle,
      fonts: regular,
      size: 26,
      minSize: 22,
      lineHeight: 1.3,
      maxLines: 3,
      color: "#a1a1aa",
    }),
  };
}

function Picture({ image }: { image: TextImage }) {
  return (
    <img
      alt=""
      src={dataUri(image.svg)}
      width={image.width}
      height={image.height}
    />
  );
}

/**
 * A page's share image in one language: the site's mark, the page's title
 * and line in the language's own script, and the escape loop's still frame.
 * Right-to-left languages mirror the layout; the neurons stay where they
 * are, since they are a real fly's.
 */
export async function renderShareCard(
  locale: Locale,
  page: SharePage,
): Promise<ImageResponse> {
  let lines: Lines;
  try {
    lines = await shapeCard(locale, page);
  } catch (error) {
    if (locale === "en") throw error;
    console.warn(
      `The ${locale} share card for ${page} fell back to English: ${String(error)}`,
    );
    return renderShareCard("en", page);
  }
  const rtl = direction(locale) === "rtl";
  const art = await cascadeArt();
  const edge = rtl ? "flex-end" : "flex-start";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        justifyContent: rtl ? "flex-end" : "flex-start",
        backgroundColor: "#09090b",
        backgroundImage: `radial-gradient(circle at ${rtl ? 22 : 78}% 40%, rgba(56,189,248,0.16), rgba(9,9,11,0) 55%)`,
        color: "#fafafa",
      }}
    >
      {art ? (
        <img
          alt=""
          src={art}
          width={ART.width}
          height={ART.height}
          style={{
            position: "absolute",
            top: 118,
            [rtl ? "left" : "right"]: 4,
          }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: edge,
          width: COLUMN + PAD,
          height: "100%",
          padding: rtl ? `56px ${PAD}px 52px 0` : `56px 0 52px ${PAD}px`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img alt="" src={dataUri(MARK)} width={56} height={56} />
          <div style={{ fontSize: 40, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: edge,
            gap: 18,
          }}
        >
          {lines.label ? <Picture image={lines.label} /> : null}
          <Picture image={lines.title} />
          <Picture image={lines.subtitle} />
        </div>
        <div style={{ fontSize: 22, color: "#71717a" }}>
          {SITE_URL.replace("https://", "")}
        </div>
      </div>
    </div>,
    CARD_SIZE,
  );
}
