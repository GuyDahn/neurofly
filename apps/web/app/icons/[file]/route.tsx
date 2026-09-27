import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const dynamicParams = false;

/** A maskable icon keeps its art inside the middle 80%, where every launcher shape shows it. */
const ICONS = {
  "192.png": { size: 192, maskable: false },
  "512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
} as const;

type IconFile = keyof typeof ICONS;

export function generateStaticParams(): { file: string }[] {
  return Object.keys(ICONS).map((file) => ({ file }));
}

const TRACE =
  '<path d="M4.5 18.5h6.5l2.6-11 3.6 17 2.4-9.5h7.9" fill="none" stroke="url(#g)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
const GRADIENT =
  '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#38BDF8"/><stop offset="0.55" stop-color="#F87171"/><stop offset="1" stop-color="#FACC15"/></linearGradient></defs>';

/** The favicon's spike mark as a home-screen icon. */
function markSvg(maskable: boolean): string {
  const art = maskable
    ? `<g transform="translate(6.4 6.4) scale(0.6)">${TRACE}</g>`
    : TRACE;
  const corner = maskable ? 0 : 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${GRADIENT}<rect width="32" height="32" rx="${corner}" fill="#18181b"/>${art}</svg>`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!(file in ICONS)) notFound();
  const { size, maskable } = ICONS[file as IconFile];
  const src = `data:image/svg+xml;base64,${Buffer.from(markSvg(maskable)).toString("base64")}`;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      <img alt="" src={src} width={size} height={size} />
    </div>,
    { width: size, height: size },
  );
}
