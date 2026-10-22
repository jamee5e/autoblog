import {
  AIAgentType,
  AIRunProvider,
  AIRunStatus,
  SystemLogLevel
} from "@prisma/client";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { createSystemLog } from "./system-log.service";
import { createArticleResearch, CreateResearchInput } from "./research.service";
import { writeArticleDraft } from "./writer.service";
import {
  reviewArticleQuality,
  reviseArticleFromQuality
} from "./quality.service";

export interface OrchestrateArticleInput extends CreateResearchInput {}

export const orchestrateArticle = async (input: OrchestrateArticleInput) => {
  const research = await createArticleResearch(input);

  const orchestratorRun = await prisma.aIRun.create({
    data: {
      articleId: research.articleId,
      provider: AIRunProvider.OTHER,
      agentType: AIAgentType.ORCHESTRATOR,
      model: "workflow-v1",
      status: AIRunStatus.RUNNING
    }
  });

  try {
    const writer = await writeArticleDraft({
      companyId: input.companyId,
      articleId: research.articleId
    });

    let quality = await reviewArticleQuality({
      companyId: input.companyId,
      articleId: research.articleId
    });

    while (quality.review.decision === "REVISION_REQUIRED" && quality.canRevise) {
      await reviseArticleFromQuality({
        companyId: input.companyId,
        articleId: research.articleId
      });

      quality = await reviewArticleQuality({
        companyId: input.companyId,
        articleId: research.articleId
      });
    }

    await prisma.aIRun.update({
      where: { id: orchestratorRun.id },
      data: {
        status: AIRunStatus.SUCCESS,
        completedAt: new Date()
      }
    });

    await createSystemLog({
      module: "ai-orchestrator",
      level: SystemLogLevel.INFO,
      message: "Full AI article workflow completed",
      metadata: {
        articleId: research.articleId,
        websiteId: input.websiteId,
        finalStatus: quality.status,
        decision: quality.review.decision,
        revisionCount: quality.revisionCount,
        maxRevisions: quality.maxRevisions,
        researchModel: research.model,
        writerModel: writer.model,
        qualityModel: quality.model
      }
    });

    return {
      articleId: research.articleId,
      status: quality.status,
      decision: quality.review.decision,
      revisionCount: quality.revisionCount,
      maxRevisions: quality.maxRevisions,
      research: {
        model: research.model,
        usage: research.usage
      },
      writer: {
        model: writer.model,
        usage: writer.usage
      },
      quality: {
        model: quality.model,
        usage: quality.usage,
        review: quality.review
      }
    };
  } catch (error) {
    const safeMessage =
      error instanceof HttpError ? error.message : "AI orchestration failed";

    await prisma.aIRun.update({
      where: { id: orchestratorRun.id },
      data: {
        status: AIRunStatus.FAILED,
        errorMessage: safeMessage,
        completedAt: new Date()
      }
    });

    await createSystemLog({
      module: "ai-orchestrator",
      level: SystemLogLevel.ERROR,
      message: safeMessage,
      metadata: {
        articleId: research.articleId,
        websiteId: input.websiteId,
        details: error instanceof HttpError ? error.details : undefined
      }
    });

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(502, "AI orchestration failed");
  }
};
