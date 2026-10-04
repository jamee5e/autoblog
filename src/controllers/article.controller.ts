import { UserRole } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { requireAuthUser } from "../middlewares/auth.middleware";

const articleIdSchema = z.string().min(1);

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
      title: true,
      metaDescription: true,
      seoScore: true,
      content: true,
      status: true,
      createdAt: true
    }
  });

  if (!article) {
    throw new HttpError(404, "Article not found");
  }

  res.status(200).json({
    success: true,
    data: article
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
