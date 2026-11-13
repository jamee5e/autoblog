import {
  AIAgentType,
  AIRunProvider,
  AIRunStatus,
  SystemLogLevel
} from "@prisma/client";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { createSystemLog } from "./system-log.service";
import {
  createArticleResearch,
  CreateResearchInput,
  retryArticleResearch
} from "./research.service";
import { writeArticleDraft } from "./writer.service";
import {
  reviewArticleQuality,
  reviseArticleFromQuality
} from "./quality.service";
import {
  buildResearchInputFromTopicFocus,
  getTopicFocusForWebsite,
  markTopicFocusUsed,
  selectTopicFocusForWebsite
} from "./topic-focus.service";

export interface OrchestrateArticleInput extends CreateResearchInput {}

type ResearchResult = Awaited<ReturnType<typeof createArticleResearch>>;

const runWorkflowAfterResearch = async (
  input: {
    companyId: string;
    websiteId: string;
  },
  research: ResearchResult
) => {
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
      throw new HttpError(error.statusCode, error.message, {
        phase: "POST_RESEARCH",
        articleId: research.articleId,
        providerDetails: error.details
      });
    }

    throw new HttpError(502, "AI orchestration failed", {
      phase: "POST_RESEARCH",
      articleId: research.articleId
    });
  }
};

export const orchestrateArticle = async (input: OrchestrateArticleInput) => {
  const research = await createArticleResearch(input);

  return runWorkflowAfterResearch(
    {
      companyId: input.companyId,
      websiteId: input.websiteId
    },
    research
  );
};

export const resumeArticleWorkflow = async (input: {
  companyId: string;
  websiteId: string;
  articleId: string;
}) => {
  const research = await retryArticleResearch({
    companyId: input.companyId,
    articleId: input.articleId
  });

  return runWorkflowAfterResearch(
    {
      companyId: input.companyId,
      websiteId: input.websiteId
    },
    research
  );
};

export interface OrchestrateTopicFocusInput {
  companyId: string;
  websiteId: string;
  topicFocusId?: string;
}

export const orchestrateArticleFromTopicFocus = async (
  input: OrchestrateTopicFocusInput
) => {
  const focus = input.topicFocusId
    ? await getTopicFocusForWebsite(
        input.companyId,
        input.websiteId,
        input.topicFocusId
      )
    : await selectTopicFocusForWebsite(
        input.companyId,
        input.websiteId
      );

  if (!focus) {
    throw new HttpError(
      409,
      "No active Blog Topic Focus is available for this website and date"
    );
  }

  const brief = buildResearchInputFromTopicFocus(focus);

  try {
    const result = await orchestrateArticle({
      companyId: input.companyId,
      websiteId: input.websiteId,
      topic: brief.topic,
      primaryKeyword: brief.primaryKeyword,
      additionalInstructions: brief.additionalInstructions,
      contentFormat: brief.contentFormat,
      targetWordMin: brief.targetWordMin,
      targetWordMax: brief.targetWordMax,
      suggestedSections: brief.suggestedSections
    });

    await markTopicFocusUsed(focus.id);

    await createSystemLog({
      module: "topic-focus",
      level: SystemLogLevel.INFO,
      message: "Blog Topic Focus used for full AI workflow",
      metadata: {
        articleId: result.articleId,
        websiteId: input.websiteId,
        topicFocusId: focus.id,
        topicFocusTitle: focus.title,
        autoSelected: !input.topicFocusId
      }
    });

    return {
      ...result,
      topicFocus: {
        id: focus.id,
        title: focus.title,
        focusTopic: focus.focusTopic,
        priority: focus.priority,
        contentFormat: focus.contentFormat,
        targetWordMin: focus.targetWordMin,
        targetWordMax: focus.targetWordMax,
        suggestedSections: focus.suggestedSections
      }
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw new HttpError(error.statusCode, error.message, {
        ...(error.details && typeof error.details === "object"
          ? error.details
          : { providerDetails: error.details }),
        topicFocusId: focus.id
      });
    }

    throw error;
  }
};
