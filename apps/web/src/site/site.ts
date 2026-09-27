/** Where WiredMind lives, who made it, and what it cites. */

export const SITE_NAME = "WiredMind";
/** Production origin. Canonical links, the sitemap, and share images point here. */
export const SITE_URL = "https://wiredmind-edu.vercel.app";
export const REPO_URL = "https://github.com/GuyDahn/wiredmind-edu";

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
  cambridge: "https://www.zoo.cam.ac.uk/",
  mrcLmb: "https://mrclmb.ac.uk/",
  googleResearch: "https://research.google/",
  license: `${REPO_URL}/blob/main/LICENSE`,
  dataLicense: `${REPO_URL}/blob/main/DATA_LICENSE.md`,
  issues: `${REPO_URL}/issues`,
} as const;
