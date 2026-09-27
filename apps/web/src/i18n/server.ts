import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./locales.js";

/** Route params as Next.js types them: any string until checked. */
export type LocaleParams = { locale: string };

/** The page's language from its URL, or a 404 for one the site is not written in. */
export async function pageLocale(
  params: Promise<LocaleParams>,
): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}
