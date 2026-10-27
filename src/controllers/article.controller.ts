import { AIAgentType, ContentFormat, UserRole } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { requireAuthUser } from "../middlewares/auth.middleware";
import { createArticleResearch } from "../services/research.service";
import {
  orchestrateArticle,
  orchestrateArticleFromTopicFocus
} from "../services/orchestration.service";
import { reviewArticleQuality, reviseArticleFromQuality } from "../services/quality.service";
import {
  publishArticleToWordPress,
  saveArticleToWordPressDraft
} from "../services/publication.service";
import { writeArticleDraft } from "../services/writer.service";

const articleIdSchema = z.string().min(1);

const articleResearchSchema = z.object({
  websiteId: z.string().min(1),
  topic: z.string().trim().min(3).max(300),
  primaryKeyword: z.string().trim().min(1).max(200),
  additionalInstructions: z.string().trim().max(2000).optional(),
  contentFormat: z.nativeEnum(ContentFormat).optional(),
  targetWordMin: z.number().int().min(400).max(2500).optional(),
  targetWordMax: z.number().int().min(400).max(2500).optional(),
  suggestedSections: z.number().int().min(3).max(20).nullable().optional()
}).refine(
  (value) =>
    value.targetWordMin === undefined ||
    value.targetWordMax === undefined ||
    value.targetWordMin <= value.targetWordMax,
  {
    message: "Minimum word target must be less than or equal to maximum"
  }
);

const topicFocusOrchestrationSchema = z.object({
  websiteId: z.string().min(1),
  topicFocusId: z.string().min(1).optional()
});

export const saveWordPressDraft = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = articleIdSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid article id");
  }

  const result = await saveArticleToWordPressDraft({
    companyId: authUser.companyId,
    articleId: parsedId.data
  });

  res.status(200).json({
    success: true,
    data: result
  });
};

export const publishWordPressArticle = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = articleIdSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid article id");
  }

  const result = await publishArticleToWordPress({
    companyId: authUser.companyId,
    articleId: parsedId.data
  });

  res.status(200).json({
    success: true,
    data: result
  });
};

export const reviewArticle = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = articleIdSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid article id");
  }

  const result = await reviewArticleQuality({
    companyId: authUser.companyId,
    articleId: parsedId.data
  });

  res.status(200).json({
    success: true,
    data: result
  });
};

export const reviseArticle = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = articleIdSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid article id");
  }

  const result = await reviseArticleFromQuality({
    companyId: authUser.companyId,
    articleId: parsedId.data
  });

  res.status(200).json({
    success: true,
    data: result
  });
};

export const writeArticle = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = articleIdSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid article id");
  }

  const result = await writeArticleDraft({
    companyId: authUser.companyId,
    articleId: parsedId.data
  });

  res.status(200).json({
    success: true,
    data: result
  });
};

export const orchestrateTopicFocusWorkflow = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsed = topicFocusOrchestrationSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid Topic Focus orchestration payload");
  }

  const result = await orchestrateArticleFromTopicFocus({
    companyId: authUser.companyId,
    websiteId: parsed.data.websiteId,
    topicFocusId: parsed.data.topicFocusId
  });

  res.status(201).json({
    success: true,
    data: result
  });
};

export const orchestrateArticleWorkflow = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsed = articleResearchSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid orchestration request payload");
  }

  const result = await orchestrateArticle({
    companyId: authUser.companyId,
    websiteId: parsed.data.websiteId,
    topic: parsed.data.topic,
    primaryKeyword: parsed.data.primaryKeyword,
    additionalInstructions: parsed.data.additionalInstructions,
    contentFormat: parsed.data.contentFormat,
    targetWordMin: parsed.data.targetWordMin,
    targetWordMax: parsed.data.targetWordMax,
    suggestedSections: parsed.data.suggestedSections
  });

  res.status(201).json({
    success: true,
    data: result
  });
};

export const researchArticle = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsed = articleResearchSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid research request payload");
  }

  const result = await createArticleResearch({
    companyId: authUser.companyId,
    websiteId: parsed.data.websiteId,
    topic: parsed.data.topic,
    primaryKeyword: parsed.data.primaryKeyword,
    additionalInstructions: parsed.data.additionalInstructions,
    contentFormat: parsed.data.contentFormat,
    targetWordMin: parsed.data.targetWordMin,
    targetWordMax: parsed.data.targetWordMax,
    suggestedSections: parsed.data.suggestedSections
  });

  res.status(201).json({
    success: true,
    data: result
  });
};

export const listArticles = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);

  const articles = await prisma.article.findMany({
    where: {
      website: {
        companyId: authUser.companyId
      }
    },
    select: {
      id: true,
      topic: true,
      title: true,
      primaryKeyword: true,
      seoScore: true,
      status: true,
      createdAt: true,
      website: {
        select: {
          name: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  res.status(200).json({
    success: true,
    data: articles.map((article) => ({
      id: article.id,
      topic: article.topic,
      title: article.title,
      website: article.website.name,
      primaryKeyword: article.primaryKeyword,
      seoScore: article.seoScore,
      status: article.status,
      createdAt: article.createdAt
    }))
  });
};

export const getArticlePreview = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = articleIdSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid article id");
  }

  const article = await prisma.article.findFirst({
    where: {
      id: parsedId.data,
      website: {
        companyId: authUser.companyId
      }
    },
    select: {
      id: true,
      topic: true,
      primaryKeyword: true,
      additionalInstructions: true,
      researchData: true,
      qualityData: true,
      qualityScore: true,
      revisionCount: true,
      title: true,
      slug: true,
      excerpt: true,
      metaDescription: true,
      ctaData: true,
      seoScore: true,
      content: true,
      status: true,
      wordpressPostId: true,
      wordpressUrl: true,
      publishedAt: true,
      createdAt: true,
      website: {
        select: {
          name: true
        }
      },
      internalLinks: {
        include: {
          internalLink: {
            select: {
              id: true,
              pageTitle: true,
              url: true,
              contentType: true,
              priority: true
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      aiRuns: {
        where: {
          agentType: {
            in: [AIAgentType.RESEARCH, AIAgentType.WRITER, AIAgentType.QUALITY]
          }
        },
        select: {
          agentType: true,
          model: true,
          status: true,
          inputTokens: true,
          outputTokens: true,
          completedAt: true,
          startedAt: true
        },
        orderBy: {
          startedAt: "desc"
        },
        take: 12
      }
    }
  });

  if (!article) {
    throw new HttpError(404, "Article not found");
  }

  const latestResearchRun =
    article.aiRuns.find((run) => run.agentType === AIAgentType.RESEARCH) ?? null;
  const latestWriterRun =
    article.aiRuns.find((run) => run.agentType === AIAgentType.WRITER) ?? null;
  const latestQualityRun =
    article.aiRuns.find((run) => run.agentType === AIAgentType.QUALITY) ?? null;

  res.status(200).json({
    success: true,
    data: {
      id: article.id,
      topic: article.topic,
      primaryKeyword: article.primaryKeyword,
      additionalInstructions: article.additionalInstructions,
      researchData: article.researchData,
      qualityData: article.qualityData,
      qualityScore: article.qualityScore,
      revisionCount: article.revisionCount,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      metaDescription: article.metaDescription,
      ctaData: article.ctaData,
      seoScore: article.seoScore,
      content: article.content,
      status: article.status,
      wordpressPostId: article.wordpressPostId,
      wordpressUrl: article.wordpressUrl,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      website: article.website.name,
      internalLinks: article.internalLinks,
      researchRun: latestResearchRun,
      writerRun: latestWriterRun,
      qualityRun: latestQualityRun
    }
  });
};

export const getArticlePermissions = (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    data: {
      editableRoles: [UserRole.ADMIN, UserRole.EDITOR],
      regenerateEnabled: false,
      saveDraftEnabled: false,
      publishEnabled: false
    }
  });
};
