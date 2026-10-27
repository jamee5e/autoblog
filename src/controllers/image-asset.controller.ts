import { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../errors/http.error";
import { requireAuthUser } from "../middlewares/auth.middleware";
import {
  autoAssignArticleImages,
  listImageAssets,
  syncImageAssetsFromWordPress,
  updateImageAsset
} from "../services/image-asset.service";

const imageAssetIdSchema = z.string().min(1);
const articleIdSchema = z.string().min(1);

const imageAssetUpdateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  altText: z.string().trim().max(500).nullable().optional(),
  keywords: z.array(z.string().trim().min(1).max(120)).max(60).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  active: z.boolean().optional()
});

const syncSchema = z.object({
  websiteId: z.string().min(1)
});

const autoSelectSchema = z.object({
  inlineCount: z.number().int().min(0).max(4).default(2)
});

export const getImageAssets = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const websiteId =
    typeof req.query.websiteId === "string" && req.query.websiteId.length > 0
      ? req.query.websiteId
      : undefined;

  const data = await listImageAssets(authUser.companyId, websiteId);

  res.status(200).json({
    success: true,
    data
  });
};

export const updateImageAssetItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = imageAssetIdSchema.safeParse(req.params.id);
  const parsed = imageAssetUpdateSchema.safeParse(req.body);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid image asset id");
  }

  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    throw new HttpError(400, "Invalid image asset payload");
  }

  const data = await updateImageAsset(
    authUser.companyId,
    parsedId.data,
    parsed.data
  );

  res.status(200).json({
    success: true,
    data
  });
};

export const syncImageAssets = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsed = syncSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid WordPress image sync payload");
  }

  const data = await syncImageAssetsFromWordPress(
    authUser.companyId,
    parsed.data.websiteId
  );

  res.status(200).json({
    success: true,
    data
  });
};

export const autoSelectImagesForArticle = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = articleIdSchema.safeParse(req.params.articleId);
  const parsedBody = autoSelectSchema.safeParse(req.body ?? {});

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid article id");
  }

  if (!parsedBody.success) {
    throw new HttpError(400, "Invalid image selection payload");
  }

  const data = await autoAssignArticleImages(
    authUser.companyId,
    parsedId.data,
    {
      force: true,
      inlineCount: parsedBody.data.inlineCount
    }
  );

  res.status(200).json({
    success: true,
    data
  });
};
