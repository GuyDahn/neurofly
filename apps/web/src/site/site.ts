/** Where WiredMind lives, who made it, and what it cites. */

export const SITE_NAME = "WiredMind";
/** Production origin. Canonical links, the sitemap, and share images point here. */
export const SITE_URL = "https://wiredmind.app";
export const REPO_URL = "https://github.com/GuyDahn/wiredmind-edu";
/**
 * Where the footer's "Feedback" link and the teachers' section send a
 * question or a broken-lesson report. A GitHub issue form today; nothing
 * else should hard-code the target, so this can become a Tally or Google
 * Form link later without touching the pages that link to it.
 */
export const FEEDBACK_URL = `${REPO_URL}/issues/new?template=teacher-feedback.yml`;

export const AUTHOR = {
  name: "Guy Dahan",
  jobTitle: "Full-stack developer & SEO strategist",
  city: "Tel Aviv",
  github: "https://github.com/GuyDahn",
  website: "https://guy-dev.com",
} as const;

export const COFFEE_URL = "https://buymeacoffee.com/guydahn";

export const PAPER = {
  citation:
    "Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2026). Sexual dimorphism in the complete Drosophila male central nervous system connectome. Cell 189, 5504–5526.e15.",
  doi: "10.1016/j.cell.2026.08.015",
  url: "https://doi.org/10.1016/j.cell.2026.08.015",
} as const;

export const LINKS = {
  maleCns: "https://male-cns.janelia.org/",
  neuprint: "https://neuprint.janelia.org/?dataset=male-cns%3Av1.0",
  ccBy: "https://creativecommons.org/licenses/by/4.0/",
  shiu: "https://doi.org/10.1038/s41586-024-07763-9",
  janelia: "https://www.janelia.org/project-team/flyem",
  cambridge: "https://www.cam.ac.uk/",
  mrcLmb: "https://www2.mrc-lmb.cam.ac.uk/",
  googleResearch: "https://research.google/",
  license: `${REPO_URL}/blob/main/LICENSE`,
  dataLicense: `${REPO_URL}/blob/main/DATA_LICENSE.md`,
  issues: `${REPO_URL}/issues`,
  /** How to add or review a language. */
  translate: `${REPO_URL}/blob/main/CONTRIBUTING.md#translations`,
} as const;
