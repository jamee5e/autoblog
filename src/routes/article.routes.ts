import { Router } from "express";
import { UserRole } from "@prisma/client";
import {
  getArticlePermissions,
  getArticlePreview,
  listArticles,
  orchestrateArticleWorkflow,
  orchestrateTopicFocusWorkflow,
  publishWordPressArticle,
  researchArticle,
  reviewArticle,
  reviseArticle,
  saveWordPressDraft,
  writeArticle
} from "../controllers/article.controller";
import { authorizeRoles } from "../middlewares/auth.middleware";

export const articleRouter = Router();

articleRouter.get("/", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), listArticles);
articleRouter.post("/research", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), researchArticle);
articleRouter.post("/orchestrate", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), orchestrateArticleWorkflow);
articleRouter.post("/orchestrate-topic-focus", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), orchestrateTopicFocusWorkflow);
articleRouter.post("/:id/write", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), writeArticle);
articleRouter.post("/:id/quality", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), reviewArticle);
articleRouter.post("/:id/revise", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), reviseArticle);
articleRouter.post("/:id/wordpress-draft", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), saveWordPressDraft);
articleRouter.post("/:id/publish", authorizeRoles(UserRole.ADMIN), publishWordPressArticle);
articleRouter.get("/permissions", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), getArticlePermissions);
articleRouter.get("/:id", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), getArticlePreview);
