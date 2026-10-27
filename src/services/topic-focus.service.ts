import { BlogTopicFocus } from "@prisma/client";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";

export interface TopicFocusInput {
  websiteId: string;
  title: string;
  focusTopic: string;
  keywords: string[];
  angle?: string | null;
  priority: number;
  active: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  notes?: string | null;
}

const getAuthorizedWebsite = async (companyId: string, websiteId: string) => {
  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      companyId
    },
    select: {
      id: true
    }
  });

  if (!website) {
    throw new HttpError(404, "Website not found");
  }

  return website;
};

const validateDateRange = (startDate?: Date | null, endDate?: Date | null) => {
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw new HttpError(400, "Start date must be before or equal to end date");
  }
};

export const listTopicFocuses = async (
  companyId: string,
  websiteId?: string
) =>
  prisma.blogTopicFocus.findMany({
    where: {
      website: {
        companyId
      },
      ...(websiteId ? { websiteId } : {})
    },
    include: {
      website: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [
      { active: "desc" },
      { priority: "desc" },
      { createdAt: "desc" }
    ]
  });

export const createTopicFocus = async (
  companyId: string,
  input: TopicFocusInput
) => {
  await getAuthorizedWebsite(companyId, input.websiteId);
  validateDateRange(input.startDate, input.endDate);

  return prisma.blogTopicFocus.create({
    data: {
      websiteId: input.websiteId,
      title: input.title,
      focusTopic: input.focusTopic,
      keywords: input.keywords,
      angle: input.angle || null,
      priority: input.priority,
      active: input.active,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      notes: input.notes || null
    },
    include: {
      website: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
};

export const updateTopicFocus = async (
  companyId: string,
  topicFocusId: string,
  input: Partial<TopicFocusInput>
) => {
  const existing = await prisma.blogTopicFocus.findFirst({
    where: {
      id: topicFocusId,
      website: {
        companyId
      }
    }
  });

  if (!existing) {
    throw new HttpError(404, "Blog topic focus not found");
  }

  if (input.websiteId) {
    await getAuthorizedWebsite(companyId, input.websiteId);
  }

  const nextStartDate =
    input.startDate === undefined ? existing.startDate : input.startDate;
  const nextEndDate =
    input.endDate === undefined ? existing.endDate : input.endDate;

  validateDateRange(nextStartDate, nextEndDate);

  return prisma.blogTopicFocus.update({
    where: { id: existing.id },
    data: {
      websiteId: input.websiteId,
      title: input.title,
      focusTopic: input.focusTopic,
      keywords: input.keywords,
      angle: input.angle === undefined ? undefined : input.angle || null,
      priority: input.priority,
      active: input.active,
      startDate: input.startDate === undefined ? undefined : input.startDate,
      endDate: input.endDate === undefined ? undefined : input.endDate,
      notes: input.notes === undefined ? undefined : input.notes || null
    },
    include: {
      website: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
};

export const deleteTopicFocus = async (
  companyId: string,
  topicFocusId: string
) => {
  const existing = await prisma.blogTopicFocus.findFirst({
    where: {
      id: topicFocusId,
      website: {
        companyId
      }
    }
  });

  if (!existing) {
    throw new HttpError(404, "Blog topic focus not found");
  }

  await prisma.blogTopicFocus.delete({
    where: { id: existing.id }
  });
};

export const selectTopicFocusForWebsite = async (
  companyId: string,
  websiteId: string,
  now = new Date()
): Promise<BlogTopicFocus | null> => {
  await getAuthorizedWebsite(companyId, websiteId);

  const today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));

  const candidates = await prisma.blogTopicFocus.findMany({
    where: {
      websiteId,
      active: true,
      AND: [
        {
          OR: [
            { startDate: null },
            { startDate: { lte: today } }
          ]
        },
        {
          OR: [
            { endDate: null },
            { endDate: { gte: today } }
          ]
        }
      ]
    }
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }

    if (!a.lastUsedAt && b.lastUsedAt) return -1;
    if (a.lastUsedAt && !b.lastUsedAt) return 1;

    if (a.lastUsedAt && b.lastUsedAt) {
      const lastUsedDifference =
        a.lastUsedAt.getTime() - b.lastUsedAt.getTime();

      if (lastUsedDifference !== 0) {
        return lastUsedDifference;
      }
    }

    return a.useCount - b.useCount;
  });

  return candidates[0];
};

export const markTopicFocusUsed = async (topicFocusId: string) =>
  prisma.blogTopicFocus.update({
    where: { id: topicFocusId },
    data: {
      lastUsedAt: new Date(),
      useCount: {
        increment: 1
      }
    }
  });
