import { LINKS, PAPER, REPO_URL } from "./site.js";

/**
 * Where each link tag in the copy points, e.g. `<shiu>Shiu et al.</shiu>`.
 * Every language uses the same tags, so a translation can move a link
 * anywhere in its sentence.
 */
export const LINK_TAGS = {
  malecns: LINKS.maleCns,
  janelia: LINKS.janelia,
  cambridge: LINKS.cambridge,
  mrc: LINKS.mrcLmb,
  google: LINKS.googleResearch,
  ccby: LINKS.ccBy,
  shiu: LINKS.shiu,
  neuprint: LINKS.neuprint,
  paper: PAPER.url,
  code: REPO_URL,
  simplified: "/about#real-and-simplified",
} as const;

export type LinkTag = keyof typeof LINK_TAGS;

/** Tags lesson copy uses for glossed jargon, and the one that marks a citation. */
export const TEXT_TAGS = ["term", "gloss", "cite"] as const;
