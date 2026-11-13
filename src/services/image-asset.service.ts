import {
  ArticleImageRole,
  ImageAsset,
  SystemLogLevel
} from "@prisma/client";
import { wordpressAdapter } from "../adapters/wordpress.adapter";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { createSystemLog } from "./system-log.service";

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
      { selectionReady: "desc" },
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
      ...(input.keywords !== undefined
        ? { selectionReady: input.keywords.length > 0 }
        : {}),
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
        keywords: [],
        selectionReady: false,
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

  const deactivated =
    syncedIds.length > 0
      ? await prisma.imageAsset.updateMany({
          where: {
            websiteId: website.id,
            active: true,
            wordpressMediaId: {
              notIn: syncedIds
            }
          },
          data: {
            active: false,
            lastSyncedAt: now
          }
        })
      : { count: 0 };

  await createSystemLog({
    module: "image-library",
    level:
      media.length > 0
        ? SystemLogLevel.INFO
        : SystemLogLevel.WARN,
    message:
      media.length > 0
        ? "WordPress image library sync completed"
        : "WordPress image library returned zero images",
    metadata: {
      websiteId: website.id,
      websiteName: website.name,
      totalFromWordPress: media.length,
      created,
      updated,
      deactivated: deactivated.count
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

const normalizeToken = (value: string) => {
  if (/^[a-z]+$/i.test(value)) {
    if (value.length > 4 && value.endsWith("ies")) {
      return `${value.slice(0, -3)}y`;
    }

    if (
      value.length > 4 &&
      value.endsWith("s") &&
      !value.endsWith("ss")
    ) {
      return value.slice(0, -1);
    }
  }

  return value;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, " ")
    .split(/\s+/)
    .map((part) => normalizeToken(part.trim()))
    .filter(Boolean)
    .join(" ")
    .trim();

const tokenize = (value: string) =>
  new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((part) => part.length >= 2)
  );

const intersectionSize = (a: Set<string>, b: Set<string>) => {
  let count = 0;

  for (const value of a) {
    if (b.has(value)) count += 1;
  }

  return count;
};

const keywordMatchPoints = (
  keywords: string[],
  contextText: string
) => {
  const normalizedContext = normalizeText(contextText);
  const contextTokens = tokenize(contextText);
  let points = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    const keywordTokens = tokenize(keyword);

    if (!normalizedKeyword || keywordTokens.size === 0) {
      continue;
    }

    if (
      normalizedKeyword.length >= 3 &&
      normalizedContext.includes(normalizedKeyword)
    ) {
      points += 12 + Math.min(6, keywordTokens.size * 2);
      continue;
    }

    const matched = intersectionSize(contextTokens, keywordTokens);

    if (matched === keywordTokens.size) {
      points += 8 + Math.min(6, keywordTokens.size * 2);
    } else if (matched > 0) {
      points += Math.max(
        2,
        Math.round((matched / keywordTokens.size) * 6)
      );
    }
  }

  return points;
};

const imageKeywordScore = (
  image: ImageAsset,
  contextText: string,
  primaryContext: string
) => {
  const generalPoints = keywordMatchPoints(image.keywords, contextText);
  const primaryPoints = keywordMatchPoints(
    image.keywords,
    primaryContext
  );

  return Math.min(70, generalPoints + primaryPoints * 2);
};

const imageSuitabilityScore = (
  image: ImageAsset,
  featured: boolean
) => {
  if (!image.width || !image.height) return 2;

  const ratio = image.width / image.height;
  let score = 0;

  if (image.width >= 1200) score += 4;
  else if (image.width >= 800) score += 2;

  if (featured && ratio >= 1.35 && ratio <= 2.2) {
    score += 6;
  } else if (!featured && ratio >= 1.1 && ratio <= 2.2) {
    score += 4;
  }

  return Math.min(10, score);
};

const rankImages = (
  images: ImageAsset[],
  contextText: string,
  primaryContext: string,
  featured: boolean
) =>
  images
    .map((image) => {
      const keywordScore = imageKeywordScore(
        image,
        contextText,
        primaryContext
      );
      const priorityScore = Math.max(
        2,
        Math.min(20, image.priority * 2)
      );
      const suitabilityScore = imageSuitabilityScore(
        image,
        featured
      );
      const usagePenalty = Math.min(
        6,
        Math.floor(image.useCount / 4)
      );
      const recentPenalty =
        image.lastUsedAt &&
        Date.now() - image.lastUsedAt.getTime() <
          7 * 24 * 60 * 60 * 1000
          ? 4
          : 0;

      return {
        image,
        keywordScore,
        score:
          keywordScore +
          priorityScore +
          suitabilityScore -
          usagePenalty -
          recentPenalty
      };
    })
    .filter((item) => {
      const largeEnough =
        !item.image.width ||
        item.image.width >= 600;

      return item.keywordScore > 0 && largeEnough;
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.keywordScore !== b.keywordScore) {
        return b.keywordScore - a.keywordScore;
      }
      if (a.image.priority !== b.image.priority) {
        return b.image.priority - a.image.priority;
      }
      return a.image.useCount - b.image.useCount;
    });

const extractH2Headings = (content: string) =>
  [...content.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((match) => stripHtml(match[1] || ""))
    .filter(Boolean);

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
      active: true,
      selectionReady: true
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

    await createSystemLog({
      module: "image-selection",
      level: SystemLogLevel.INFO,
      message: "No curated active images are available for selection",
      metadata: {
        articleId: article.id,
        websiteId: article.websiteId,
        strategy: "LOCAL_KEYWORD_RANKING",
        aiApiRequests: 0,
        candidateCount: 0,
        selectedCount: 0
      }
    });

    return [];
  }

  const articleContext = [
    article.topic,
    article.primaryKeyword,
    article.title || "",
    article.researchData ? JSON.stringify(article.researchData) : "",
    article.content ? stripHtml(article.content) : ""
  ].join(" ");

  const primaryContext = [
    article.primaryKeyword,
    article.topic,
    article.title || ""
  ].join(" ");

  const featuredRanked = rankImages(
    assets,
    articleContext,
    primaryContext,
    true
  );
  const featured = featuredRanked[0]?.image ?? null;
  let remaining = featured
    ? assets.filter((image) => image.id !== featured.id)
    : [...assets];

  const inlineCount = Math.max(
    0,
    Math.min(4, options?.inlineCount ?? 2)
  );
  const headings = extractH2Headings(article.content || "");
  const inline: ImageAsset[] = [];

  for (let index = 0; index < inlineCount; index += 1) {
    const preferredHeadingIndex =
      index === 0 ? 1 : 3 + (index - 1) * 2;
    const heading =
      headings[
        Math.min(preferredHeadingIndex, headings.length - 1)
      ] || "";

    const sectionContext = [
      article.primaryKeyword,
      article.topic,
      heading,
      articleContext
    ].join(" ");

    const ranked = rankImages(
      remaining,
      sectionContext,
      [
        article.primaryKeyword,
        heading
      ].join(" "),
      false
    );

    const selectedImage = ranked[0]?.image;

    if (!selectedImage) {
      continue;
    }

    inline.push(selectedImage);
    remaining = remaining.filter(
      (image) => image.id !== selectedImage.id
    );
  }

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

  await createSystemLog({
    module: "image-selection",
    level: SystemLogLevel.INFO,
    message:
      selected.length > 0
        ? "Article images selected with local keyword ranking"
        : "No curated image keywords matched the article",
    metadata: {
      articleId: article.id,
      websiteId: article.websiteId,
      strategy: "LOCAL_KEYWORD_RANKING",
      aiApiRequests: 0,
      candidateCount: assets.length,
      selectedCount: selected.length
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
