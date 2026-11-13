import { Router } from "express";
import { UserRole } from "@prisma/client";
import {
  autoSelectImagesForArticle,
  getImageAssets,
  syncImageAssets,
  updateImageAssetItem
} from "../controllers/image-asset.controller";
import { authorizeRoles } from "../middlewares/auth.middleware";

export const imageAssetRouter = Router();

imageAssetRouter.get(
  "/",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  getImageAssets
);

imageAssetRouter.post(
  "/sync",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  syncImageAssets
);

imageAssetRouter.put(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  updateImageAssetItem
);

imageAssetRouter.post(
  "/articles/:articleId/auto-select",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  autoSelectImagesForArticle
);
