import {
  AIAgentType,
  AIRunProvider,
  AIRunStatus,
  ArticleStatus,
  SystemLogLevel
} from "@prisma/client";
import { runWriterAgent } from "../ai/writer.agent";
import { getGeminiWriterModel } from "../ai/gemini.client";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { createSystemLog } from "./system-log.service";

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
    const result = await runWriterAgent({
      websiteName: article.website.name,
      topic: article.topic,
      primaryKeyword: article.primaryKeyword,
      additionalInstructions: article.additionalInstructions,
      researchData: article.researchData,
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

    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: {
          title: result.draft.title,
          slug: result.draft.slug,
          excerpt: result.draft.excerpt,
          content: result.draft.content,
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
      module: "gemini-writer",
      level: SystemLogLevel.INFO,
      message: "Gemini writer completed",
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
      draft: result.draft
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
