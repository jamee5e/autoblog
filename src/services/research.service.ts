import {
  AIAgentType,
  AIRunProvider,
  ContentFormat,
  AIRunStatus,
  ArticleStatus,
  Prisma,
  SystemLogLevel
} from "@prisma/client";
import { runResearchAgent } from "../ai/research.agent";
import { getGeminiModel } from "../ai/gemini.client";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { createSystemLog } from "./system-log.service";

export interface CreateResearchInput {
  companyId: string;
  websiteId: string;
  topic: string;
  primaryKeyword: string;
  additionalInstructions?: string;
  contentFormat?: ContentFormat;
  targetWordMin?: number;
  targetWordMax?: number;
  suggestedSections?: number | null;
}

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const toResearchHttpError = (
  error: unknown,
  articleId: string
): HttpError => {
  if (error instanceof HttpError) {
    return new HttpError(error.statusCode, error.message, {
      phase: "RESEARCH",
      articleId,
      providerDetails: error.details
    });
  }

  return new HttpError(502, "Gemini research failed", {
    phase: "RESEARCH",
    articleId
  });
};

const runResearchForArticle = async (params: {
  companyId: string;
  articleId: string;
}) => {
  const article = await prisma.article.findFirst({
    where: {
      id: params.articleId,
      website: {
        companyId: params.companyId
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

  const brandProfile = article.website.brandProfiles[0];
  const model = getGeminiModel();

  await prisma.aIRun.updateMany({
    where: {
      articleId: article.id,
      agentType: AIAgentType.RESEARCH,
      status: AIRunStatus.RUNNING
    },
    data: {
      status: AIRunStatus.FAILED,
      errorMessage: "Superseded by a new research run",
      completedAt: new Date()
    }
  });

  const aiRun = await prisma.aIRun.create({
    data: {
      articleId: article.id,
      provider: AIRunProvider.GEMINI,
      agentType: AIAgentType.RESEARCH,
      model,
      status: AIRunStatus.RUNNING
    }
  });

  await prisma.article.update({
    where: { id: article.id },
    data: { status: ArticleStatus.RESEARCHING }
  });

  try {
    const result = await runResearchAgent({
      websiteName: article.website.name,
      wordpressUrl: article.website.wordpressUrl,
      topic: article.topic,
      primaryKeyword: article.primaryKeyword,
      additionalInstructions: article.additionalInstructions ?? undefined,
      contentFormat: article.contentFormat,
      targetWordMin: article.targetWordMin,
      targetWordMax: article.targetWordMax,
      suggestedSections: article.suggestedSections,
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

    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: {
          researchData: toJsonValue(result.research),
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

    await createSystemLog({
      module: "gemini-research",
      level: SystemLogLevel.INFO,
      message: "Gemini research completed",
      metadata: {
        articleId: article.id,
        websiteId: article.websiteId,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens
      }
    });

    return {
      articleId: article.id,
      status: ArticleStatus.DRAFT,
      model: result.model,
      usage: result.usage,
      research: result.research
    };
  } catch (error) {
    const wrappedError = toResearchHttpError(error, article.id);

    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: { status: ArticleStatus.FAILED }
      }),
      prisma.aIRun.update({
        where: { id: aiRun.id },
        data: {
          status: AIRunStatus.FAILED,
          errorMessage: wrappedError.message,
          completedAt: new Date()
        }
      })
    ]);

    await createSystemLog({
      module: "gemini-research",
      level: SystemLogLevel.ERROR,
      message: wrappedError.message,
      metadata: {
        articleId: article.id,
        websiteId: article.websiteId,
        model,
        details: wrappedError.details
      }
    });

    throw wrappedError;
  }
};

export const createArticleResearch = async (input: CreateResearchInput) => {
  const website = await prisma.website.findFirst({
    where: {
      id: input.websiteId,
      companyId: input.companyId
    },
    select: {
      id: true
    }
  });

  if (!website) {
    throw new HttpError(404, "Website not found");
  }

  const article = await prisma.article.create({
    data: {
      websiteId: website.id,
      topic: input.topic,
      primaryKeyword: input.primaryKeyword,
      additionalInstructions: input.additionalInstructions || null,
      contentFormat: input.contentFormat ?? ContentFormat.AUTO,
      targetWordMin: input.targetWordMin ?? 700,
      targetWordMax: input.targetWordMax ?? 1000,
      suggestedSections: input.suggestedSections ?? null,
      status: ArticleStatus.RESEARCHING
    }
  });

  return runResearchForArticle({
    companyId: input.companyId,
    articleId: article.id
  });
};

export const retryArticleResearch = async (input: {
  companyId: string;
  articleId: string;
}) => {
  const article = await prisma.article.findFirst({
    where: {
      id: input.articleId,
      website: {
        companyId: input.companyId
      }
    },
    select: {
      id: true,
      researchData: true
    }
  });

  if (!article) {
    throw new HttpError(404, "Article not found");
  }

  if (article.researchData) {
    throw new HttpError(409, "Article research is already completed");
  }

  return runResearchForArticle(input);
};
