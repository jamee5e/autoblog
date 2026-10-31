import { ContentFormat } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../errors/http.error";
import { requireAuthUser } from "../middlewares/auth.middleware";
import {
  createTopicFocus,
  deleteTopicFocus,
  listTopicFocuses,
  updateTopicFocus
} from "../services/topic-focus.service";

const topicFocusIdSchema = z.string().min(1);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

const topicFocusBaseSchema = z.object({
  websiteId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  focusTopic: z.string().trim().min(2).max(300),
  keywords: z.array(z.string().trim().min(1).max(100)).max(50),
  angle: z.string().trim().max(1500).nullable().optional(),
  contentFormat: z.nativeEnum(ContentFormat),
  targetWordMin: z.number().int().min(400).max(2500),
  targetWordMax: z.number().int().min(400).max(2500),
  suggestedSections: z.number().int().min(3).max(20).nullable().optional(),
  priority: z.number().int().min(1).max(10),
  active: z.boolean(),
  startDate: dateOnlySchema,
  endDate: dateOnlySchema,
  notes: z.string().trim().max(2000).nullable().optional()
});

const topicFocusCreateSchema = topicFocusBaseSchema.extend({
  keywords: topicFocusBaseSchema.shape.keywords.default([]),
  contentFormat: topicFocusBaseSchema.shape.contentFormat.default(ContentFormat.AUTO),
  targetWordMin: topicFocusBaseSchema.shape.targetWordMin.default(700),
  targetWordMax: topicFocusBaseSchema.shape.targetWordMax.default(1000),
  priority: topicFocusBaseSchema.shape.priority.default(5),
  active: topicFocusBaseSchema.shape.active.default(true)
});

const topicFocusUpdateSchema = topicFocusBaseSchema.partial();

const parseDateOnly = (
  value: string | null | undefined
): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, "Invalid date");
  }

  return date;
};

export const getTopicFocuses = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const websiteId =
    typeof req.query.websiteId === "string" && req.query.websiteId.length > 0
      ? req.query.websiteId
      : undefined;

  const data = await listTopicFocuses(authUser.companyId, websiteId);

  res.status(200).json({
    success: true,
    data
  });
};

export const createBlogTopicFocus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsed = topicFocusCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid blog topic focus payload");
  }

  const data = await createTopicFocus(authUser.companyId, {
    ...parsed.data,
    startDate: parseDateOnly(parsed.data.startDate),
    endDate: parseDateOnly(parsed.data.endDate)
  });

  res.status(201).json({
    success: true,
    data
  });
};

export const updateBlogTopicFocus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = topicFocusIdSchema.safeParse(req.params.id);
  const parsed = topicFocusUpdateSchema.safeParse(req.body);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid blog topic focus id");
  }

  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    throw new HttpError(400, "Invalid blog topic focus payload");
  }

  const data = await updateTopicFocus(
    authUser.companyId,
    parsedId.data,
    {
      ...parsed.data,
      startDate: parseDateOnly(parsed.data.startDate),
      endDate: parseDateOnly(parsed.data.endDate)
    }
  );

  res.status(200).json({
    success: true,
    data
  });
};

export const removeBlogTopicFocus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = topicFocusIdSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid blog topic focus id");
  }

  await deleteTopicFocus(authUser.companyId, parsedId.data);

  res.status(200).json({
    success: true
  });
};
