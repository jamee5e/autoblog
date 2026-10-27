import { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../errors/http.error";
import { requireAuthUser } from "../middlewares/auth.middleware";
import {
  createInternalLink,
  deleteInternalLink,
  listInternalLinks,
  syncInternalLinksFromWordPress,
  updateInternalLink
} from "../services/internal-link.service";

const internalLinkIdSchema = z.string().min(1);

const internalLinkBaseSchema = z.object({
  websiteId: z.string().min(1),
  pageTitle: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(2000),
  targetKeywords: z.array(z.string().trim().min(1).max(120)).max(60),
  anchorSuggestions: z.array(z.string().trim().min(1).max(200)).max(30),
  contentType: z.string().trim().max(100).nullable().optional(),
  priority: z.number().int().min(1).max(10),
  active: z.boolean()
});

const createInternalLinkSchema = internalLinkBaseSchema.extend({
  targetKeywords: internalLinkBaseSchema.shape.targetKeywords.default([]),
  anchorSuggestions: internalLinkBaseSchema.shape.anchorSuggestions.default([]),
  priority: internalLinkBaseSchema.shape.priority.default(5),
  active: internalLinkBaseSchema.shape.active.default(true)
});

const updateInternalLinkSchema = internalLinkBaseSchema.partial();

const syncSchema = z.object({
  websiteId: z.string().min(1)
});

export const getInternalLinks = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const websiteId =
    typeof req.query.websiteId === "string" && req.query.websiteId.length > 0
      ? req.query.websiteId
      : undefined;

  const data = await listInternalLinks(authUser.companyId, websiteId);

  res.status(200).json({
    success: true,
    data
  });
};

export const createInternalLinkItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsed = createInternalLinkSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid internal link payload");
  }

  const data = await createInternalLink(authUser.companyId, parsed.data);

  res.status(201).json({
    success: true,
    data
  });
};

export const updateInternalLinkItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = internalLinkIdSchema.safeParse(req.params.id);
  const parsed = updateInternalLinkSchema.safeParse(req.body);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid internal link id");
  }

  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    throw new HttpError(400, "Invalid internal link payload");
  }

  const data = await updateInternalLink(
    authUser.companyId,
    parsedId.data,
    parsed.data
  );

  res.status(200).json({
    success: true,
    data
  });
};

export const removeInternalLinkItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = internalLinkIdSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid internal link id");
  }

  await deleteInternalLink(authUser.companyId, parsedId.data);

  res.status(200).json({
    success: true
  });
};

export const syncInternalLinks = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsed = syncSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid WordPress sync payload");
  }

  const data = await syncInternalLinksFromWordPress(
    authUser.companyId,
    parsed.data.websiteId
  );

  res.status(200).json({
    success: true,
    data
  });
};
