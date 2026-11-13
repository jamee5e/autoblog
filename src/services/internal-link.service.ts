import {
  InternalLink,
  InternalLinkSource
} from "@prisma/client";
import { wordpressAdapter } from "../adapters/wordpress.adapter";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";

export interface InternalLinkInput {
  websiteId: string;
  pageTitle: string;
  url: string;
  targetKeywords: string[];
  anchorSuggestions: string[];
  contentType?: string | null;
  priority: number;
  active: boolean;
}

const getAuthorizedWebsite = async (companyId: string, websiteId: string) => {
  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      companyId
    },
    select: {
      id: true,
      name: true,
      wordpressUrl: true
    }
  });

  if (!website) {
    throw new HttpError(404, "Website not found");
  }

  return website;
};

const normalizeHostname = (hostname: string) =>
  hostname.toLowerCase().replace(/^www\./, "");

const normalizeInternalUrl = (value: string, websiteUrl: string) => {
  let parsed: URL;
  let website: URL;

  try {
    parsed = new URL(value);
    website = new URL(websiteUrl);
  } catch {
    throw new HttpError(400, "Internal link URL must be a valid absolute URL");
  }

  if (normalizeHostname(parsed.hostname) !== normalizeHostname(website.hostname)) {
    throw new HttpError(400, "Internal link URL must belong to the selected website");
  }

  parsed.hash = "";

  return parsed.toString();
};

const cleanWordPressTitle = (value: string) =>
  value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

export const listInternalLinks = async (
  companyId: string,
  websiteId?: string
) =>
  prisma.internalLink.findMany({
    where: {
      website: {
        companyId
      },
      ...(websiteId ? { websiteId } : {})
    },
    include: {
      website: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [
      { active: "desc" },
      { priority: "desc" },
      { pageTitle: "asc" }
    ]
  });

export const createInternalLink = async (
  companyId: string,
  input: InternalLinkInput
) => {
  const website = await getAuthorizedWebsite(companyId, input.websiteId);
  const url = normalizeInternalUrl(input.url, website.wordpressUrl);

  const existing = await prisma.internalLink.findUnique({
    where: {
      websiteId_url: {
        websiteId: website.id,
        url
      }
    }
  });

  if (existing) {
    throw new HttpError(409, "This URL already exists in the Internal Link Library");
  }

  return prisma.internalLink.create({
    data: {
      websiteId: website.id,
      pageTitle: input.pageTitle,
      url,
      targetKeywords: input.targetKeywords,
      anchorSuggestions: input.anchorSuggestions,
      contentType: input.contentType || null,
      priority: input.priority,
      active: input.active,
      source: InternalLinkSource.MANUAL
    },
    include: {
      website: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
};

export const updateInternalLink = async (
  companyId: string,
  internalLinkId: string,
  input: Partial<InternalLinkInput>
) => {
  const existing = await prisma.internalLink.findFirst({
    where: {
      id: internalLinkId,
      website: {
        companyId
      }
    },
    include: {
      website: {
        select: {
          wordpressUrl: true
        }
      }
    }
  });

  if (!existing) {
    throw new HttpError(404, "Internal link not found");
  }

  let websiteId = existing.websiteId;
  let websiteUrl = existing.website.wordpressUrl;

  if (input.websiteId && input.websiteId !== existing.websiteId) {
    const website = await getAuthorizedWebsite(companyId, input.websiteId);
    websiteId = website.id;
    websiteUrl = website.wordpressUrl;
  }

  const url =
    input.url !== undefined
      ? normalizeInternalUrl(input.url, websiteUrl)
      : input.websiteId && input.websiteId !== existing.websiteId
        ? normalizeInternalUrl(existing.url, websiteUrl)
        : undefined;

  if (url) {
    const duplicate = await prisma.internalLink.findFirst({
      where: {
        websiteId,
        url,
        id: {
          not: existing.id
        }
      },
      select: {
        id: true
      }
    });

    if (duplicate) {
      throw new HttpError(409, "This URL already exists in the Internal Link Library");
    }
  }

  return prisma.internalLink.update({
    where: {
      id: existing.id
    },
    data: {
      websiteId: input.websiteId,
      pageTitle: input.pageTitle,
      url,
      targetKeywords: input.targetKeywords,
      anchorSuggestions: input.anchorSuggestions,
      contentType:
        input.contentType === undefined ? undefined : input.contentType || null,
      priority: input.priority,
      active: input.active
    },
    include: {
      website: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
};

export const deleteInternalLink = async (
  companyId: string,
  internalLinkId: string
) => {
  const existing = await prisma.internalLink.findFirst({
    where: {
      id: internalLinkId,
      website: {
        companyId
      }
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new HttpError(404, "Internal link not found");
  }

  await prisma.internalLink.delete({
    where: {
      id: existing.id
    }
  });
};

export const syncInternalLinksFromWordPress = async (
  companyId: string,
  websiteId: string
) => {
  const website = await getAuthorizedWebsite(companyId, websiteId);
  const content = await wordpressAdapter.getPublishedContent(website.id);
  const existing = await prisma.internalLink.findMany({
    where: {
      websiteId: website.id
    }
  });

  const existingByUrl = new Map(existing.map((item) => [item.url, item]));
  const now = new Date();
  let created = 0;
  let updated = 0;
  const syncedUrls: string[] = [];

  for (const item of content) {
    const url = normalizeInternalUrl(item.url, website.wordpressUrl);
    const cleanTitle = cleanWordPressTitle(item.title);
    const slugKeyword = item.slug.replace(/[-_]+/g, " ").trim();
    const starterKeywords = [...new Set([cleanTitle, slugKeyword].filter(Boolean))];
    syncedUrls.push(url);
    const current = existingByUrl.get(url);

    if (current) {
      await prisma.internalLink.update({
        where: {
          id: current.id
        },
        data: {
          ...(current.source === InternalLinkSource.WORDPRESS
            ? {
                pageTitle: cleanTitle,
                contentType: item.type === "post" ? "Post" : "Page",
                ...(current.targetKeywords.length === 0
                  ? { targetKeywords: starterKeywords }
                  : {}),
                ...(current.anchorSuggestions.length === 0
                  ? { anchorSuggestions: [cleanTitle] }
                  : {})
              }
            : {}),
          wordpressObjectId: item.id,
          wordpressObjectType: item.type,
          lastSyncedAt: now
        }
      });
      updated += 1;
      continue;
    }

    await prisma.internalLink.create({
      data: {
        websiteId: website.id,
        pageTitle: cleanTitle,
        url,
        targetKeywords: starterKeywords,
        anchorSuggestions: [cleanTitle],
        contentType: item.type === "post" ? "Post" : "Page",
        priority: 5,
        active: true,
        source: InternalLinkSource.WORDPRESS,
        wordpressObjectId: item.id,
        wordpressObjectType: item.type,
        lastSyncedAt: now
      }
    });
    created += 1;
  }

  const deactivated = await prisma.internalLink.updateMany({
    where: {
      websiteId: website.id,
      source: InternalLinkSource.WORDPRESS,
      active: true,
      ...(syncedUrls.length > 0
        ? {
            url: {
              notIn: syncedUrls
            }
          }
        : {})
    },
    data: {
      active: false,
      lastSyncedAt: now
    }
  });

  return {
    websiteId: website.id,
    websiteName: website.name,
    totalFromWordPress: content.length,
    created,
    updated,
    deactivated: deactivated.count,
    syncedAt: now
  };
};

const tokenize = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, " ")
      .split(/\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2)
  );

const intersectionSize = (a: Set<string>, b: Set<string>) => {
  let count = 0;
  for (const value of a) {
    if (b.has(value)) count += 1;
  }
  return count;
};

export const selectInternalLinksForArticle = async (
  companyId: string,
  articleId: string,
  limit = 4
): Promise<InternalLink[]> => {
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      website: {
        companyId
      }
    },
    select: {
      id: true,
      websiteId: true,
      topic: true,
      primaryKeyword: true,
      researchData: true,
      wordpressUrl: true
    }
  });

  if (!article) {
    throw new HttpError(404, "Article not found");
  }

  const links = await prisma.internalLink.findMany({
    where: {
      websiteId: article.websiteId,
      active: true,
      ...(article.wordpressUrl ? { url: { not: article.wordpressUrl } } : {})
    }
  });

  if (links.length === 0) {
    return [];
  }

  const contextTokens = tokenize(
    [
      article.topic,
      article.primaryKeyword,
      article.researchData ? JSON.stringify(article.researchData) : ""
    ].join(" ")
  );

  const scored = links
    .map((link) => {
      const keywordTokens = tokenize(link.targetKeywords.join(" "));
      const titleTokens = tokenize(link.pageTitle);
      const keywordMatches = intersectionSize(contextTokens, keywordTokens);
      const titleMatches = intersectionSize(contextTokens, titleTokens);
      const relevance = (keywordMatches * 4) + (titleMatches * 2);
      const recencyPenalty =
        link.lastUsedAt &&
        Date.now() - link.lastUsedAt.getTime() < 7 * 24 * 60 * 60 * 1000
          ? 2
          : 0;

      return {
        link,
        relevance,
        score:
          relevance +
          link.priority -
          Math.min(3, Math.floor(link.useCount / 5)) -
          recencyPenalty
      };
    })
    .filter((item) => item.relevance > 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.link.priority !== b.link.priority) {
        return b.link.priority - a.link.priority;
      }
      return a.link.useCount - b.link.useCount;
    });

  return scored.slice(0, Math.max(0, limit)).map((item) => item.link);
};

const stripHtml = (value: string) =>
  value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export const recordArticleInternalLinks = async (
  articleId: string,
  content: string,
  allowedLinks: InternalLink[]
) => {
  const allowedByUrl = new Map(allowedLinks.map((link) => [link.url, link]));
  const used = new Map<string, { link: InternalLink; anchorText: string }>();
  const anchorPattern = /<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(content)) !== null) {
    const url = match[2].trim();
    const link = allowedByUrl.get(url);

    if (!link) continue;

    used.set(link.id, {
      link,
      anchorText: stripHtml(match[3]).slice(0, 300)
    });
  }

  const existing = await prisma.articleInternalLink.findMany({
    where: {
      articleId
    },
    select: {
      internalLinkId: true
    }
  });

  const existingIds = new Set(existing.map((item) => item.internalLinkId));
  const usedIds = [...used.keys()];
  const newlyUsedIds = usedIds.filter((id) => !existingIds.has(id));

  await prisma.$transaction(async (tx) => {
    await tx.articleInternalLink.deleteMany({
      where: {
        articleId
      }
    });

    if (usedIds.length > 0) {
      await tx.articleInternalLink.createMany({
        data: usedIds.map((id) => ({
          articleId,
          internalLinkId: id,
          anchorText: used.get(id)?.anchorText || null
        }))
      });

      await tx.internalLink.updateMany({
        where: {
          id: {
            in: usedIds
          }
        },
        data: {
          lastUsedAt: new Date()
        }
      });
    }

    for (const id of newlyUsedIds) {
      await tx.internalLink.update({
        where: {
          id
        },
        data: {
          useCount: {
            increment: 1
          }
        }
      });
    }
  });

  return usedIds.length;
};


export const getAllowedInternalLinksForArticle = async (
  companyId: string,
  articleId: string,
  limit = 4
): Promise<InternalLink[]> => {
  const existing = await prisma.articleInternalLink.findMany({
    where: {
      articleId,
      article: {
        website: {
          companyId
        }
      },
      internalLink: {
        active: true
      }
    },
    include: {
      internalLink: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const selected = await selectInternalLinksForArticle(
    companyId,
    articleId,
    limit
  );

  const combined = new Map<string, InternalLink>();

  for (const item of existing) {
    combined.set(item.internalLink.id, item.internalLink);
  }

  for (const link of selected) {
    if (combined.size >= limit) break;
    combined.set(link.id, link);
  }

  return [...combined.values()].slice(0, limit);
};

export const sanitizeArticleInternalLinks = (
  content: string,
  allowedLinks: InternalLink[]
) => {
  const allowedByUrl = new Map(allowedLinks.map((link) => [link.url, link]));
  const anchorPattern = /<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  return content.replace(anchorPattern, (_full, _quote, rawUrl, innerHtml) => {
    const url = String(rawUrl).trim();

    if (!allowedByUrl.has(url)) {
      return innerHtml;
    }

    return `<a href="${url}">${innerHtml}</a>`;
  });
};
