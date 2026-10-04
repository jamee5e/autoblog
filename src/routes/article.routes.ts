import { Router } from "express";
import { UserRole } from "@prisma/client";
import { getArticlePermissions, getArticlePreview, listArticles } from "../controllers/article.controller";
import { authorizeRoles } from "../middlewares/auth.middleware";

export const articleRouter = Router();

articleRouter.get("/", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), listArticles);
articleRouter.get("/permissions", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), getArticlePermissions);
articleRouter.get("/:id", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), getArticlePreview);
