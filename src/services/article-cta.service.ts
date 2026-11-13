import { InternalLink } from "@prisma/client";
import { z } from "zod";

export const articleCtaSchema = z.object({
  heading: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(500),
  buttonText: z.string().trim().min(1).max(100),
  url: z.string().trim().url().max(2000),
  internalLinkId: z.string().min(1)
});

export type ArticleCtaData = z.infer<typeof articleCtaSchema>;

export interface WriterFinalCta {
  enabled: boolean;
  heading: string;
  description: string;
  buttonText: string;
  url: string;
}

const fallbackCta = (link: InternalLink): ArticleCtaData => ({
  heading: `Explore ${link.pageTitle}`,
  description:
    "See the available options and find the experience that best fits your trip.",
  buttonText: `View ${link.pageTitle}`,
  url: link.url,
  internalLinkId: link.id
});

export const resolveArticleCta = (
  writerCta: WriterFinalCta,
  allowedLinks: InternalLink[]
): ArticleCtaData | null => {
  if (allowedLinks.length === 0) {
    return null;
  }

  const matched = allowedLinks.find(
    (link) => writerCta.enabled && link.url === writerCta.url
  );

  if (!matched) {
    return fallbackCta(allowedLinks[0]);
  }

  const heading = writerCta.heading.trim();
  const description = writerCta.description.trim();
  const buttonText = writerCta.buttonText.trim();

  if (!heading || !description || !buttonText) {
    return fallbackCta(matched);
  }

  return {
    heading,
    description,
    buttonText,
    url: matched.url,
    internalLinkId: matched.id
  };
};

export const parseArticleCta = (value: unknown): ArticleCtaData | null => {
  const parsed = articleCtaSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const renderArticleCtaHtml = (cta: ArticleCtaData): string => {
  const heading = escapeHtml(cta.heading);
  const description = escapeHtml(cta.description);
  const buttonText = escapeHtml(cta.buttonText);
  const url = escapeHtml(cta.url);

  return [
    "",
    '<div class="ksd-blog-cta" style="margin-top:40px;padding:28px;border:1px solid #d9e0e6;border-radius:6px;background:#fff;">',
    `<h2 style="margin:0 0 10px;font-size:30px;line-height:1.2;">${heading}</h2>`,
    `<p style="margin:0 0 22px;font-size:16px;line-height:1.65;">${description}</p>`,
    `<a class="ksd-blog-cta-button" href="${url}" style="display:inline-block;padding:14px 22px;border-radius:5px;background:#f47b20;color:#fff;text-decoration:none;font-weight:700;">${buttonText} &rarr;</a>`,
    "</div>"
  ].join("");
};

export const appendArticleCta = (
  content: string,
  ctaValue: unknown
): string => {
  const cta = parseArticleCta(ctaValue);

  if (!cta) {
    return content;
  }

  return `${content}${renderArticleCtaHtml(cta)}`;
};
