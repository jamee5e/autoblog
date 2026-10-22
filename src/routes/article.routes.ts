import { Router } from "express";
import { UserRole } from "@prisma/client";
import {
  getArticlePermissions,
  getArticlePreview,
  listArticles,
  researchArticle,
  reviewArticle,
  reviseArticle,
  writeArticle
} from "../controllers/article.controller";
import { authorizeRoles } from "../middlewares/auth.middleware";

export const articleRouter = Router();

articleRouter.get("/", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), listArticles);
articleRouter.post("/research", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), researchArticle);
articleRouter.post("/:id/write", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), writeArticle);
articleRouter.post("/:id/quality", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), reviewArticle);
articleRouter.post("/:id/revise", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), reviseArticle);
articleRouter.get("/permissions", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), getArticlePermissions);
articleRouter.get("/:id", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), getArticlePreview);
