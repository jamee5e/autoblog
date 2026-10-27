import {
  AIAgentType,
  AIRunProvider,
  AIRunStatus,
  ArticleStatus,
  Prisma,
  SystemLogLevel
} from "@prisma/client";
import { getGeminiQualityModel, getGeminiWriterModel } from "../ai/gemini.client";
import { qualityReviewSchema, runQualityAgent } from "../ai/quality.agent";
import { runWriterAgent } from "../ai/writer.agent";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { createSystemLog } from "./system-log.service";
import { resolveArticleCta } from "./article-cta.service";
import {
  getAllowedInternalLinksForArticle,
  recordArticleInternalLinks,
  sanitizeArticleInternalLinks
} from "./internal-link.service";

const MAX_REVISIONS = 2;

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const getArticleForQuality = async (companyId: string, articleId: string) => {
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      website: {
        companyId
      }
    },
    include: {
      website: {
        include: {
          brandProfiles: {
            orderBy: { createdAt: "asc" },
            take: 1
          }
        }
      }
    }
  });

  if (!article) {
    throw new HttpError(404, "Article not found");
  }

  return article;
};

export const reviewArticleQuality = async (input: {
  companyId: string;
  articleId: string;
}) => {
  const article = await getArticleForQuality(input.companyId, input.articleId);

  if (!article.researchData) {
    throw new HttpError(409, "Research must be completed before quality review");
  }

  if (!article.title || !article.content) {
    throw new HttpError(409, "Writer draft must be completed before quality review");
  }

  const brandProfile = article.website.brandProfiles[0];
  const model = getGeminiQualityModel();

  await prisma.aIRun.updateMany({
    where: {
      articleId: article.id,
      agentType: AIAgentType.QUALITY,
      status: AIRunStatus.RUNNING
    },
    data: {
      status: AIRunStatus.FAILED,
      errorMessage: "Superseded by a new quality run",
      completedAt: new Date()
    }
  });

  const aiRun = await prisma.aIRun.create({
    data: {
      articleId: article.id,
      provider: AIRunProvider.GEMINI,
      agentType: AIAgentType.QUALITY,
      model,
      status: AIRunStatus.RUNNING
    }
  });

  await prisma.article.update({
    where: { id: article.id },
    data: { status: ArticleStatus.CHECKING }
  });

  try {
    const result = await runQualityAgent({
      websiteName: article.website.name,
      topic: article.topic,
      primaryKeyword: article.primaryKeyword,
      researchData: article.researchData,
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      language: brandProfile?.language,
      brandContext: brandProfile
        ? {
            tone: brandProfile.tone,
            targetAudience: brandProfile.targetAudience,
            brandPrompt: brandProfile.brandPrompt,
            seoRules: brandProfile.seoRules,
            prohibitedTerms: brandProfile.prohibitedTerms
          }
        : undefined
    });

    const nextStatus =
      result.review.decision === "PASS"
        ? ArticleStatus.READY
        : ArticleStatus.REVISION;

    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: {
          qualityData: toJsonValue(result.review),
          qualityScore: result.review.qualityScore,
          seoScore: result.review.seoScore,
          metaDescription: result.review.metaDescription,
          status: nextStatus
        }
      }),
      prisma.aIRun.update({
        where: { id: aiRun.id },
        data: {
          status: AIRunStatus.SUCCESS,
          model: result.model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          completedAt: new Date()
        }
      })
    ]);

    await createSystemLog({
      module: "gemini-quality",
      level: SystemLogLevel.INFO,
      message: "Gemini quality review completed",
      metadata: {
        articleId: article.id,
        websiteId: article.websiteId,
        model: result.model,
        decision: result.review.decision,
        seoScore: result.review.seoScore,
        qualityScore: result.review.qualityScore,
        revisionCount: article.revisionCount,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens
      }
    });

    return {
      articleId: article.id,
      status: nextStatus,
      model: result.model,
      usage: result.usage,
      review: result.review,
      revisionCount: article.revisionCount,
      maxRevisions: MAX_REVISIONS,
      canRevise:
        result.review.decision === "REVISION_REQUIRED" &&
        article.revisionCount < MAX_REVISIONS
    };
  } catch (error) {
    const safeMessage =
      error instanceof HttpError ? error.message : "Gemini quality review failed";

    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: { status: ArticleStatus.DRAFT }
      }),
      prisma.aIRun.update({
        where: { id: aiRun.id },
        data: {
          status: AIRunStatus.FAILED,
          errorMessage: safeMessage,
          completedAt: new Date()
        }
      })
    ]);

    await createSystemLog({
      module: "gemini-quality",
      level: SystemLogLevel.ERROR,
      message: safeMessage,
      metadata: {
        articleId: article.id,
        websiteId: article.websiteId,
        model,
        details: error instanceof HttpError ? error.details : undefined
      }
    });

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(502, "Gemini quality review failed");
  }
};

export const reviseArticleFromQuality = async (input: {
  companyId: string;
  articleId: string;
}) => {
  const article = await getArticleForQuality(input.companyId, input.articleId);

  if (!article.researchData || !article.title || !article.content) {
    throw new HttpError(409, "A completed draft is required before revision");
  }

  if (!article.qualityData) {
    throw new HttpError(409, "Quality review is required before revision");
  }

  const parsedReview = qualityReviewSchema.safeParse(article.qualityData);

  if (!parsedReview.success || parsedReview.data.decision !== "REVISION_REQUIRED") {
    throw new HttpError(409, "Article does not require revision");
  }

  if (article.revisionCount >= MAX_REVISIONS) {
    throw new HttpError(409, "Maximum revision limit reached");
  }

  const brandProfile = article.website.brandProfiles[0];
  const model = getGeminiWriterModel();

  await prisma.aIRun.updateMany({
    where: {
      articleId: article.id,
      agentType: AIAgentType.WRITER,
      status: AIRunStatus.RUNNING
    },
    data: {
      status: AIRunStatus.FAILED,
      errorMessage: "Superseded by a new revision run",
      completedAt: new Date()
    }
  });

  const aiRun = await prisma.aIRun.create({
    data: {
      articleId: article.id,
      provider: AIRunProvider.GEMINI,
      agentType: AIAgentType.WRITER,
      model,
      status: AIRunStatus.RUNNING
    }
  });

  await prisma.article.update({
    where: { id: article.id },
    data: { status: ArticleStatus.REVISION }
  });

  try {
    const allowedInternalLinks = await getAllowedInternalLinksForArticle(
      input.companyId,
      article.id,
      4
    );

    const result = await runWriterAgent({
      websiteName: article.website.name,
      topic: article.topic,
      primaryKeyword: article.primaryKeyword,
      additionalInstructions: article.additionalInstructions,
      researchData: article.researchData,
      currentDraft: {
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content
      },
      revisionInstructions: parsedReview.data.revisionInstructions,
      allowedInternalLinks: allowedInternalLinks.map((link) => ({
        title: link.pageTitle,
        url: link.url,
        targetKeywords: link.targetKeywords,
        anchorSuggestions: link.anchorSuggestions
      })),
      language: brandProfile?.language,
      brandContext: brandProfile
        ? {
            tone: brandProfile.tone,
            targetAudience: brandProfile.targetAudience,
            brandPrompt: brandProfile.brandPrompt,
            seoRules: brandProfile.seoRules,
            prohibitedTerms: brandProfile.prohibitedTerms,
            defaultCta: brandProfile.defaultCta
          }
        : undefined
    });

    const nextRevisionCount = article.revisionCount + 1;
    const sanitizedContent = sanitizeArticleInternalLinks(
      result.draft.content,
      allowedInternalLinks
    );
    const finalCta = resolveArticleCta(
      result.draft.finalCta,
      allowedInternalLinks
    );

    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: {
          title: result.draft.title,
          slug: result.draft.slug,
          excerpt: result.draft.excerpt,
          content: sanitizedContent,
          ctaData: finalCta
            ? (JSON.parse(JSON.stringify(finalCta)) as Prisma.InputJsonValue)
            : Prisma.DbNull,
          qualityData: Prisma.DbNull,
          qualityScore: null,
          seoScore: null,
          metaDescription: null,
          revisionCount: nextRevisionCount,
          status: ArticleStatus.DRAFT
        }
      }),
      prisma.aIRun.update({
        where: { id: aiRun.id },
        data: {
          status: AIRunStatus.SUCCESS,
          model: result.model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          completedAt: new Date()
        }
      })
    ]);

    const internalLinkCount = await recordArticleInternalLinks(
      article.id,
      sanitizedContent,
      allowedInternalLinks
    );

    await createSystemLog({
      module: "gemini-writer",
      level: SystemLogLevel.INFO,
      message: "Gemini writer revision completed",
      metadata: {
        articleId: article.id,
        websiteId: article.websiteId,
        model: result.model,
        revisionCount: nextRevisionCount,
        maxRevisions: MAX_REVISIONS,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
        internalLinkCount,
        finalCtaUrl: finalCta?.url ?? null
      }
    });

    return {
      articleId: article.id,
      status: ArticleStatus.DRAFT,
      model: result.model,
      usage: result.usage,
      draft: {
        ...result.draft,
        content: sanitizedContent
      },
      finalCta,
      internalLinkCount,
      revisionCount: nextRevisionCount,
      maxRevisions: MAX_REVISIONS
    };
  } catch (error) {
    const safeMessage =
      error instanceof HttpError ? error.message : "Gemini writer revision failed";

    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: { status: ArticleStatus.REVISION }
      }),
      prisma.aIRun.update({
        where: { id: aiRun.id },
        data: {
          status: AIRunStatus.FAILED,
          errorMessage: safeMessage,
          completedAt: new Date()
        }
      })
    ]);

    await createSystemLog({
      module: "gemini-writer",
      level: SystemLogLevel.ERROR,
      message: safeMessage,
      metadata: {
        articleId: article.id,
        websiteId: article.websiteId,
        model,
        revisionCount: article.revisionCount,
        details: error instanceof HttpError ? error.details : undefined
      }
    });

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(502, "Gemini writer revision failed");
  }
};
