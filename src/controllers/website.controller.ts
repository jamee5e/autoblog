import { Request, Response } from "express";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { encryptSecret } from "../utils/encryption";
import { normalizeWordPressUrl } from "../utils/wordpress-url";
import { z } from "zod";
import { wordpressAdapter } from "../adapters/wordpress.adapter";
import { requireAuthUser } from "../middlewares/auth.middleware";

const websiteCreateSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1),
  wordpressUrl: z.string().min(1),
  wordpressUsername: z.string().min(1),
  wordpressApplicationPassword: z.string().min(1),
  defaultAuthor: z.string().min(1).optional(),
  defaultCategory: z.string().min(1).optional()
});

const websiteUpdateSchema = z
  .object({
    companyId: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    wordpressUrl: z.string().min(1).optional(),
    wordpressUsername: z.string().min(1).optional(),
    wordpressApplicationPassword: z.string().min(1).optional(),
    defaultAuthor: z.string().min(1).nullable().optional(),
    defaultCategory: z.string().min(1).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required for update"
  });

const websiteTestDraftSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  excerpt: z.string().optional(),
  slug: z.string().optional()
});

const websiteResponseSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  wordpressUrl: z.string(),
  wordpressUsername: z.string(),
  defaultAuthor: z.string().nullable(),
  defaultCategory: z.string().nullable(),
  status: z.string(),
  createdAt: z.date()
});

const getWebsiteIdFromRequest = (req: Request): string => {
  const parsed = z.string().min(1).safeParse(req.params.id);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid website id");
  }

  return parsed.data;
};

const toWebsiteResponse = (website: z.infer<typeof websiteResponseSchema>) => ({
  id: website.id,
  companyId: website.companyId,
  name: website.name,
  wordpressUrl: website.wordpressUrl,
  wordpressUsername: website.wordpressUsername,
  defaultAuthor: website.defaultAuthor,
  defaultCategory: website.defaultCategory,
  status: website.status,
  createdAt: website.createdAt
});

const getAuthorizedWebsite = async (websiteId: string, companyId: string) => {
  const website = await prisma.website.findUnique({
    where: { id: websiteId }
  });

  if (!website || website.companyId !== companyId) {
    throw new HttpError(404, "Website not found");
  }

  return website;
};

export const createWebsite = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsed = websiteCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid request payload");
  }

  if (parsed.data.companyId !== authUser.companyId) {
    throw new HttpError(403, "Cannot create website outside your company");
  }

  const website = await prisma.website.create({
    data: {
      companyId: parsed.data.companyId,
      name: parsed.data.name,
      wordpressUrl: normalizeWordPressUrl(parsed.data.wordpressUrl),
      wordpressUsername: parsed.data.wordpressUsername,
      wordpressApplicationPasswordEncrypted: encryptSecret(parsed.data.wordpressApplicationPassword),
      defaultAuthor: parsed.data.defaultAuthor ?? null,
      defaultCategory: parsed.data.defaultCategory ?? null
    }
  });

  res.status(201).json({
    success: true,
    data: toWebsiteResponse(websiteResponseSchema.parse(website))
  });
};

export const listWebsites = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const websites = await prisma.website.findMany({
    where: { companyId: authUser.companyId },
    orderBy: { createdAt: "desc" }
  });

  res.status(200).json({
    success: true,
    data: websites.map((website) => toWebsiteResponse(websiteResponseSchema.parse(website)))
  });
};

export const getWebsiteById = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const websiteId = getWebsiteIdFromRequest(req);
  const website = await getAuthorizedWebsite(websiteId, authUser.companyId);

  res.status(200).json({
    success: true,
    data: toWebsiteResponse(websiteResponseSchema.parse(website))
  });
};

export const updateWebsite = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const websiteId = getWebsiteIdFromRequest(req);
  const parsed = websiteUpdateSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid request payload");
  }

  await getAuthorizedWebsite(websiteId, authUser.companyId);

  if (parsed.data.companyId && parsed.data.companyId !== authUser.companyId) {
    throw new HttpError(403, "Cannot move website to another company");
  }

  const website = await prisma.website.update({
    where: { id: websiteId },
    data: {
      companyId: parsed.data.companyId,
      name: parsed.data.name,
      wordpressUrl: parsed.data.wordpressUrl ? normalizeWordPressUrl(parsed.data.wordpressUrl) : undefined,
      wordpressUsername: parsed.data.wordpressUsername,
      wordpressApplicationPasswordEncrypted: parsed.data.wordpressApplicationPassword
        ? encryptSecret(parsed.data.wordpressApplicationPassword)
        : undefined,
      defaultAuthor: parsed.data.defaultAuthor,
      defaultCategory: parsed.data.defaultCategory
    }
  });

  res.status(200).json({
    success: true,
    data: toWebsiteResponse(websiteResponseSchema.parse(website))
  });
};

export const testWordPressConnection = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const websiteId = getWebsiteIdFromRequest(req);
  await getAuthorizedWebsite(websiteId, authUser.companyId);
  const result = await wordpressAdapter.testConnection(websiteId);

  res.status(200).json({
    success: true,
    website: result.website,
    message: "WordPress connection successful"
  });
};

export const createWordPressTestDraft = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);
  const websiteId = getWebsiteIdFromRequest(req);
  await getAuthorizedWebsite(websiteId, authUser.companyId);
  const parsed = websiteTestDraftSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid request payload");
  }

  const draft = await wordpressAdapter.createDraft(websiteId, parsed.data);

  res.status(201).json({
    success: true,
    wordpressPostId: draft.wordpressPostId,
    wordpressUrl: draft.wordpressUrl,
    status: draft.status
  });
};
