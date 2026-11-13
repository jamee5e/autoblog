import { Router } from "express";
import { UserRole } from "@prisma/client";
import {
  createInternalLinkItem,
  getInternalLinks,
  removeInternalLinkItem,
  syncInternalLinks,
  updateInternalLinkItem
} from "../controllers/internal-link.controller";
import { authorizeRoles } from "../middlewares/auth.middleware";

export const internalLinkRouter = Router();

internalLinkRouter.get(
  "/",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  getInternalLinks
);

internalLinkRouter.post(
  "/",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  createInternalLinkItem
);

internalLinkRouter.post(
  "/sync",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  syncInternalLinks
);

internalLinkRouter.put(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  updateInternalLinkItem
);

internalLinkRouter.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN),
  removeInternalLinkItem
);
