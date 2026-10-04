import { Router } from "express";
import {
  createWebsite,
  createWordPressTestDraft,
  getWebsiteById,
  listWebsites,
  testWordPressConnection,
  updateWebsite
} from "../controllers/website.controller";
import { authorizeRoles } from "../middlewares/auth.middleware";
import { UserRole } from "@prisma/client";

export const websiteRouter = Router();

websiteRouter.post("/", authorizeRoles(UserRole.ADMIN), createWebsite);
websiteRouter.get("/", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), listWebsites);
websiteRouter.get("/:id", authorizeRoles(UserRole.ADMIN, UserRole.EDITOR), getWebsiteById);
websiteRouter.put("/:id", authorizeRoles(UserRole.ADMIN), updateWebsite);
websiteRouter.post("/:id/test-connection", authorizeRoles(UserRole.ADMIN), testWordPressConnection);
websiteRouter.post("/:id/test-draft", authorizeRoles(UserRole.ADMIN), createWordPressTestDraft);
