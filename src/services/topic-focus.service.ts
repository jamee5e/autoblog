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

  const today = toBangkokDateOnly(now);

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

  const DAY_MS = 24 * 60 * 60 * 1000;

  const selectionScore = (focus: BlogTopicFocus) => {
    const daysSinceLastUse = focus.lastUsedAt
      ? Math.min(30, Math.max(0, Math.floor((now.getTime() - focus.lastUsedAt.getTime()) / DAY_MS)))
      : 30;

    return (focus.priority * 10) + daysSinceLastUse - Math.min(20, focus.useCount * 2);
  };

  candidates.sort((a, b) => {
    const scoreDifference = selectionScore(b) - selectionScore(a);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    if (!a.lastUsedAt && b.lastUsedAt) return -1;
    if (a.lastUsedAt && !b.lastUsedAt) return 1;

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


const toBangkokDateOnly = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day));
};

const isFocusActiveForDate = (focus: BlogTopicFocus, now = new Date()) => {
  if (!focus.active) return false;

  const today = toBangkokDateOnly(now);

  if (focus.startDate && focus.startDate.getTime() > today.getTime()) {
    return false;
  }

  if (focus.endDate && focus.endDate.getTime() < today.getTime()) {
    return false;
  }

  return true;
};

export const getTopicFocusForWebsite = async (
  companyId: string,
  websiteId: string,
  topicFocusId: string,
  now = new Date()
): Promise<BlogTopicFocus> => {
  await getAuthorizedWebsite(companyId, websiteId);

  const focus = await prisma.blogTopicFocus.findFirst({
    where: {
      id: topicFocusId,
      websiteId,
      website: {
        companyId
      }
    }
  });

  if (!focus) {
    throw new HttpError(404, "Blog Topic Focus not found");
  }

  if (!isFocusActiveForDate(focus, now)) {
    throw new HttpError(409, "Selected Blog Topic Focus is inactive or outside its active date range");
  }

  return focus;
};

export const buildResearchInputFromTopicFocus = (focus: BlogTopicFocus) => {
  const keywordList = focus.keywords.filter(Boolean);
  const primaryKeyword = keywordList[0] || focus.focusTopic;

  const instructionParts = [
    `Campaign: ${focus.title}`,
    `Focus topic: ${focus.focusTopic}`,
    keywordList.length > 0 ? `Keywords to cover naturally: ${keywordList.join(", ")}` : "",
    focus.angle ? `Content angle: ${focus.angle}` : "",
    focus.notes ? `Campaign notes / restrictions: ${focus.notes}` : "",
    "Create a useful, distinct article within this focus. Do not simply repeat the campaign title as the final article title."
  ].filter(Boolean);

  return {
    topic: focus.focusTopic,
    primaryKeyword,
    additionalInstructions: instructionParts.join("\n\n")
  };
};
