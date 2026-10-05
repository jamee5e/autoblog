import { UserRole } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { requireAuthUser } from "../middlewares/auth.middleware";
import { createArticleResearch } from "../services/research.service";

const articleIdSchema = z.string().min(1);

const articleResearchSchema = z.object({
  websiteId: z.string().min(1),
  topic: z.string().trim().min(3).max(300),
  primaryKeyword: z.string().trim().min(1).max(200),
  additionalInstructions: z.string().trim().max(2000).optional()
});

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
    additionalInstructions: parsed.data.additionalInstructions
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
      title: true,
      metaDescription: true,
      seoScore: true,
      content: true,
      status: true,
      createdAt: true,
      website: {
        select: {
          name: true
        }
      },
      aiRuns: {
        where: {
          agentType: "RESEARCH"
        },
        select: {
          model: true,
          status: true,
          inputTokens: true,
          outputTokens: true,
          completedAt: true
        },
        orderBy: {
          startedAt: "desc"
        },
        take: 1
      }
    }
  });

  if (!article) {
    throw new HttpError(404, "Article not found");
  }

  const latestResearchRun = article.aiRuns[0] ?? null;

  res.status(200).json({
    success: true,
    data: {
      id: article.id,
      topic: article.topic,
      primaryKeyword: article.primaryKeyword,
      additionalInstructions: article.additionalInstructions,
      researchData: article.researchData,
      title: article.title,
      metaDescription: article.metaDescription,
      seoScore: article.seoScore,
      content: article.content,
      status: article.status,
      createdAt: article.createdAt,
      website: article.website.name,
      researchRun: latestResearchRun
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
