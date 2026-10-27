import {
  AIAgentType,
  AIRunProvider,
  AIRunStatus,
  ArticleStatus,
  Prisma,
  SystemLogLevel
} from "@prisma/client";
import { runWriterAgent } from "../ai/writer.agent";
import { getGeminiWriterModel } from "../ai/gemini.client";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { createSystemLog } from "./system-log.service";
import { resolveArticleCta } from "./article-cta.service";
import {
  getAllowedInternalLinksForArticle,
  recordArticleInternalLinks,
  sanitizeArticleInternalLinks
} from "./internal-link.service";

export interface WriteArticleInput {
  companyId: string;
  articleId: string;
}

export const writeArticleDraft = async (input: WriteArticleInput) => {
  const article = await prisma.article.findFirst({
    where: {
      id: input.articleId,
      website: {
        companyId: input.companyId
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

  if (!article.researchData) {
    throw new HttpError(409, "Research must be completed before writing");
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
      errorMessage: "Superseded by a new writer run",
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
    data: { status: ArticleStatus.WRITING }
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
      contentFormat: article.contentFormat,
      targetWordMin: article.targetWordMin,
      targetWordMax: article.targetWordMax,
      suggestedSections: article.suggestedSections,
      researchData: article.researchData,
      allowedInternalLinks: allowedInternalLinks.map((link) => ({
        title: link.pageTitle,
        url: link.url,
        contentType: link.contentType,
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

    const contentForLinkTracking = finalCta
      ? `${sanitizedContent}<a href="${finalCta.url}">${finalCta.buttonText}</a>`
      : sanitizedContent;

    const internalLinkCount = await recordArticleInternalLinks(
      article.id,
      contentForLinkTracking,
      allowedInternalLinks
    );

    await createSystemLog({
      module: "gemini-writer",
      level: SystemLogLevel.INFO,
      message: "Gemini writer completed",
      metadata: {
        articleId: article.id,
        websiteId: article.websiteId,
        model: result.model,
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
      internalLinkCount
    };
  } catch (error) {
    const safeMessage =
      error instanceof HttpError ? error.message : "Gemini writer failed";

    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: { status: ArticleStatus.FAILED }
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
        details: error instanceof HttpError ? error.details : undefined
      }
    });

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(502, "Gemini writer failed");
  }
};
