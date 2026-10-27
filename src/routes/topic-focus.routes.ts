import { Router } from "express";
import { UserRole } from "@prisma/client";
import {
  createBlogTopicFocus,
  getTopicFocuses,
  removeBlogTopicFocus,
  updateBlogTopicFocus
} from "../controllers/topic-focus.controller";
import { authorizeRoles } from "../middlewares/auth.middleware";

export const topicFocusRouter = Router();

topicFocusRouter.get(
  "/",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  getTopicFocuses
);

topicFocusRouter.post(
  "/",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  createBlogTopicFocus
);

topicFocusRouter.put(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  updateBlogTopicFocus
);

topicFocusRouter.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN),
  removeBlogTopicFocus
);
