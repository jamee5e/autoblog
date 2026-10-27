import {
  ArticleImageRole,
  ImageAsset
} from "@prisma/client";
import { wordpressAdapter } from "../adapters/wordpress.adapter";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";

export interface ImageAssetUpdateInput {
  title?: string;
  altText?: string | null;
  keywords?: string[];
  priority?: number;
  active?: boolean;
}

const getAuthorizedWebsite = async (companyId: string, websiteId: string) => {
  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      companyId
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!website) {
    throw new HttpError(404, "Website not found");
  }

  return website;
};

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const filenameKeywords = (sourceUrl: string) => {
  try {
    const pathname = new URL(sourceUrl).pathname;
    const filename = pathname.split("/").pop() || "";
    return filename
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
  } catch {
    return "";
  }
};

const starterKeywords = (input: {
  title: string;
  altText: string;
  sourceUrl: string;
}) =>
  [...new Set([
    stripHtml(input.title),
    stripHtml(input.altText),
    filenameKeywords(input.sourceUrl)
  ].filter(Boolean))];

export const listImageAssets = async (
  companyId: string,
  websiteId?: string
) =>
  prisma.imageAsset.findMany({
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
      { title: "asc" }
    ]
  });

export const updateImageAsset = async (
  companyId: string,
  imageAssetId: string,
  input: ImageAssetUpdateInput
) => {
  const existing = await prisma.imageAsset.findFirst({
    where: {
      id: imageAssetId,
      website: {
        companyId
      }
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new HttpError(404, "Image asset not found");
  }

  return prisma.imageAsset.update({
    where: {
      id: existing.id
    },
    data: {
      title: input.title,
      altText:
        input.altText === undefined ? undefined : input.altText || null,
      keywords: input.keywords,
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

export const syncImageAssetsFromWordPress = async (
  companyId: string,
  websiteId: string
) => {
  const website = await getAuthorizedWebsite(companyId, websiteId);
  const media = await wordpressAdapter.getMediaLibrary(website.id);
  const existing = await prisma.imageAsset.findMany({
    where: {
      websiteId: website.id
    }
  });

  const existingByMediaId = new Map(
    existing.map((item) => [item.wordpressMediaId, item])
  );

  const now = new Date();
  const syncedIds: number[] = [];
  let created = 0;
  let updated = 0;

  for (const item of media) {
    syncedIds.push(item.id);
    const current = existingByMediaId.get(item.id);
    const cleanTitle = stripHtml(item.title) || `WordPress Image ${item.id}`;
    const cleanAlt = stripHtml(item.altText);
    const cleanCaption = stripHtml(item.caption);
    const cleanDescription = stripHtml(item.description);

    if (current) {
      await prisma.imageAsset.update({
        where: {
          id: current.id
        },
        data: {
          title: cleanTitle,
          sourceUrl: item.sourceUrl,
          altText: current.altText || cleanAlt || null,
          caption: cleanCaption || null,
          description: cleanDescription || null,
          mimeType: item.mimeType,
          width: item.width,
          height: item.height,
          ...(current.keywords.length === 0
            ? {
                keywords: starterKeywords({
                  title: cleanTitle,
                  altText: cleanAlt,
                  sourceUrl: item.sourceUrl
                })
              }
            : {}),
          lastSyncedAt: now
        }
      });
      updated += 1;
      continue;
    }

    await prisma.imageAsset.create({
      data: {
        websiteId: website.id,
        wordpressMediaId: item.id,
        title: cleanTitle,
        sourceUrl: item.sourceUrl,
        altText: cleanAlt || null,
        caption: cleanCaption || null,
        description: cleanDescription || null,
        keywords: starterKeywords({
          title: cleanTitle,
          altText: cleanAlt,
          sourceUrl: item.sourceUrl
        }),
        mimeType: item.mimeType,
        width: item.width,
        height: item.height,
        priority: 5,
        active: true,
        lastSyncedAt: now
      }
    });
    created += 1;
  }

  const deactivated = await prisma.imageAsset.updateMany({
    where: {
      websiteId: website.id,
      active: true,
      ...(syncedIds.length > 0
        ? {
            wordpressMediaId: {
              notIn: syncedIds
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
    totalFromWordPress: media.length,
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

const imageRelevance = (
  image: ImageAsset,
  contextTokens: Set<string>
) => {
  const keywordMatches = intersectionSize(
    contextTokens,
    tokenize(image.keywords.join(" "))
  );
  const titleMatches = intersectionSize(
    contextTokens,
    tokenize(image.title)
  );
  const altMatches = intersectionSize(
    contextTokens,
    tokenize(image.altText || "")
  );
  const filenameMatches = intersectionSize(
    contextTokens,
    tokenize(filenameKeywords(image.sourceUrl))
  );

  return (
    keywordMatches * 5 +
    titleMatches * 3 +
    altMatches * 3 +
    filenameMatches
  );
};

const dimensionScore = (image: ImageAsset, featured: boolean) => {
  if (!image.width || !image.height) return 0;

  const ratio = image.width / image.height;
  let score = 0;

  if (image.width >= 1200) score += 3;
  else if (image.width >= 800) score += 1;

  if (featured && ratio >= 1.35 && ratio <= 2.2) score += 4;
  if (!featured && ratio >= 1.1 && ratio <= 2.2) score += 2;

  return score;
};

const rankImages = (
  images: ImageAsset[],
  contextTokens: Set<string>,
  featured: boolean
) =>
  images
    .map((image) => {
      const relevance = imageRelevance(image, contextTokens);
      const recentPenalty =
        image.lastUsedAt &&
        Date.now() - image.lastUsedAt.getTime() < 7 * 24 * 60 * 60 * 1000
          ? 2
          : 0;

      return {
        image,
        relevance,
        score:
          relevance +
          image.priority +
          dimensionScore(image, featured) -
          Math.min(3, Math.floor(image.useCount / 5)) -
          recentPenalty
      };
    })
    .filter((item) => {
      const largeEnough =
        !item.image.width ||
        !item.image.height ||
        item.image.width >= 600;

      return item.relevance > 0 && largeEnough;
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.image.priority !== b.image.priority) {
        return b.image.priority - a.image.priority;
      }
      return a.image.useCount - b.image.useCount;
    });

export const autoAssignArticleImages = async (
  companyId: string,
  articleId: string,
  options?: {
    force?: boolean;
    inlineCount?: number;
  }
) => {
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      website: {
        companyId
      }
    },
    include: {
      images: {
        include: {
          imageAsset: true
        },
        orderBy: [
          { role: "asc" },
          { sortOrder: "asc" }
        ]
      }
    }
  });

  if (!article) {
    throw new HttpError(404, "Article not found");
  }

  if (article.images.length > 0 && !options?.force) {
    return article.images;
  }

  const assets = await prisma.imageAsset.findMany({
    where: {
      websiteId: article.websiteId,
      active: true
    }
  });

  if (assets.length === 0) {
    if (options?.force) {
      await prisma.articleImage.deleteMany({
        where: {
          articleId: article.id
        }
      });
    }

    return [];
  }

  const contextTokens = tokenize(
    [
      article.topic,
      article.primaryKeyword,
      article.title || "",
      article.researchData ? JSON.stringify(article.researchData) : "",
      article.content ? stripHtml(article.content) : ""
    ].join(" ")
  );

  const featuredRanked = rankImages(assets, contextTokens, true);
  const featured = featuredRanked[0]?.image ?? null;
  const remaining = featured
    ? assets.filter((image) => image.id !== featured.id)
    : assets;
  const inlineCount = Math.max(0, Math.min(4, options?.inlineCount ?? 2));
  const inline = rankImages(remaining, contextTokens, false)
    .slice(0, inlineCount)
    .map((item) => item.image);

  const selected = [
    ...(featured
      ? [{
          image: featured,
          role: ArticleImageRole.FEATURED,
          sortOrder: 0
        }]
      : []),
    ...inline.map((image, index) => ({
      image,
      role: ArticleImageRole.INLINE,
      sortOrder: index
    }))
  ];

  const previous = await prisma.articleImage.findMany({
    where: {
      articleId: article.id
    },
    select: {
      imageAssetId: true
    }
  });
  const previousIds = new Set(previous.map((item) => item.imageAssetId));

  await prisma.$transaction(async (tx) => {
    await tx.articleImage.deleteMany({
      where: {
        articleId: article.id
      }
    });

    if (selected.length > 0) {
      await tx.articleImage.createMany({
        data: selected.map((item) => ({
          articleId: article.id,
          imageAssetId: item.image.id,
          role: item.role,
          sortOrder: item.sortOrder,
          altText: item.image.altText || item.image.title
        }))
      });

      const selectedIds = selected.map((item) => item.image.id);

      await tx.imageAsset.updateMany({
        where: {
          id: {
            in: selectedIds
          }
        },
        data: {
          lastUsedAt: new Date()
        }
      });

      for (const id of selectedIds.filter((id) => !previousIds.has(id))) {
        await tx.imageAsset.update({
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
    }
  });

  return prisma.articleImage.findMany({
    where: {
      articleId: article.id
    },
    include: {
      imageAsset: true
    },
    orderBy: [
      { role: "asc" },
      { sortOrder: "asc" }
    ]
  });
};

export const getArticleImages = async (
  companyId: string,
  articleId: string
) => {
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      website: {
        companyId
      }
    },
    select: {
      id: true
    }
  });

  if (!article) {
    throw new HttpError(404, "Article not found");
  }

  return prisma.articleImage.findMany({
    where: {
      articleId: article.id
    },
    include: {
      imageAsset: true
    },
    orderBy: [
      { role: "asc" },
      { sortOrder: "asc" }
    ]
  });
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const renderInlineImage = (input: {
  sourceUrl: string;
  altText: string;
  width: number | null;
  height: number | null;
}) => {
  const dimensions =
    input.width && input.height
      ? ` width="${input.width}" height="${input.height}"`
      : "";

  return [
    "",
    '<figure class="ksd-blog-image" style="margin:28px 0;">',
    `<img src="${escapeHtml(input.sourceUrl)}" alt="${escapeHtml(input.altText)}" loading="lazy"${dimensions} style="display:block;width:100%;height:auto;border-radius:6px;" />`,
    "</figure>",
    ""
  ].join("");
};

export const insertInlineImagesIntoContent = (
  content: string,
  images: Array<{
    role: ArticleImageRole;
    sortOrder: number;
    altText: string | null;
    imageAsset: {
      sourceUrl: string;
      title: string;
      width: number | null;
      height: number | null;
    };
  }>
) => {
  const inline = images
    .filter((item) => item.role === ArticleImageRole.INLINE)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (inline.length === 0) return content;

  const h2Matches = [...content.matchAll(/<h2\b[^>]*>/gi)];
  let output = content;
  const insertions: Array<{ index: number; html: string }> = [];

  inline.forEach((item, index) => {
    const preferredHeadingIndex = index === 0 ? 1 : 3 + (index - 1) * 2;
    const match =
      h2Matches[Math.min(preferredHeadingIndex, h2Matches.length - 1)];

    const html = renderInlineImage({
      sourceUrl: item.imageAsset.sourceUrl,
      altText: item.altText || item.imageAsset.title,
      width: item.imageAsset.width,
      height: item.imageAsset.height
    });

    if (match && match.index !== undefined) {
      insertions.push({
        index: match.index,
        html
      });
    } else {
      insertions.push({
        index: output.length,
        html
      });
    }
  });

  for (const insertion of insertions.sort((a, b) => b.index - a.index)) {
    output =
      output.slice(0, insertion.index) +
      insertion.html +
      output.slice(insertion.index);
  }

  return output;
};

export const getFeaturedWordPressMediaId = (
  images: Array<{
    role: ArticleImageRole;
    imageAsset: {
      wordpressMediaId: number;
    };
  }>
) =>
  images.find((item) => item.role === ArticleImageRole.FEATURED)
    ?.imageAsset.wordpressMediaId;
