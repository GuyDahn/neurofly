import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { CASCADE_FILE, readCascade } from "@/src/site/cascade";
import { cascadeSvg } from "@/src/site/cascade-svg";
import { siteCopy } from "@/src/site/copy";
import { SITE_NAME, SITE_URL } from "@/src/site/site";

const copy = siteCopy();

export const alt = copy.meta.shareAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ART = { width: 760, height: 475 };

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#38BDF8"/><stop offset="0.55" stop-color="#F87171"/><stop offset="1" stop-color="#FACC15"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="#18181b"/><path d="M4.5 18.5h6.5l2.6-11 3.6 17 2.4-9.5h7.9" fill="none" stroke="url(#g)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function dataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The loop's still frame, when the build fetched the circuit data. */
async function cascadeArt(): Promise<string | null> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), "public", "data", CASCADE_FILE),
      "utf8",
    );
    return dataUri(
      cascadeSvg(readCascade(JSON.parse(raw)), ART.width, ART.height),
    );
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const art = await cascadeArt();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background:
          "radial-gradient(circle at 78% 40%, rgba(56,189,248,0.16), rgba(9,9,11,0) 55%), #09090b",
        color: "#fafafa",
      }}
    >
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={art}
          width={ART.width}
          height={ART.height}
          style={{ position: "absolute", right: 8, top: 96 }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 560,
          height: "100%",
          padding: "56px 0 52px 64px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={dataUri(MARK)} width={56} height={56} />
          <div style={{ fontSize: 40, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 54, lineHeight: 1.08, letterSpacing: -1.5 }}>
            {copy.meta.shareTitle}
          </div>
          <div style={{ fontSize: 26, lineHeight: 1.3, color: "#a1a1aa" }}>
            {copy.meta.shareSubtitle}
          </div>
        </div>
        <div style={{ fontSize: 22, color: "#71717a" }}>
          {SITE_URL.replace("https://", "")}
        </div>
      </div>
    </div>,
    size,
  );
}
