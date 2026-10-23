import {
  AIAgentType,
  AIRunProvider,
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
}

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export const createArticleResearch = async (input: CreateResearchInput) => {
  const website = await prisma.website.findFirst({
    where: {
      id: input.websiteId,
      companyId: input.companyId
    },
    include: {
      brandProfiles: {
        orderBy: { createdAt: "asc" },
        take: 1
      }
    }
  });

  if (!website) {
    throw new HttpError(404, "Website not found");
  }

  const brandProfile = website.brandProfiles[0];
  const model = getGeminiModel();

  const article = await prisma.article.create({
    data: {
      websiteId: website.id,
      topic: input.topic,
      primaryKeyword: input.primaryKeyword,
      additionalInstructions: input.additionalInstructions || null,
      status: ArticleStatus.RESEARCHING
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

  try {
    const result = await runResearchAgent({
      websiteName: website.name,
      wordpressUrl: website.wordpressUrl,
      topic: input.topic,
      primaryKeyword: input.primaryKeyword,
      additionalInstructions: input.additionalInstructions,
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
        websiteId: website.id,
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
    const safeMessage =
      error instanceof HttpError ? error.message : "Gemini research failed";

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
      module: "gemini-research",
      level: SystemLogLevel.ERROR,
      message: safeMessage,
      metadata: {
        articleId: article.id,
        websiteId: website.id,
        model,
        details: error instanceof HttpError ? error.details : undefined
      }
    });

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(502, "Gemini research failed");
  }
};
