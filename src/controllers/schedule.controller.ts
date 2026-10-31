import {
  ScheduledContentSource,
  ScheduledJobAction
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../errors/http.error";
import { requireAuthUser } from "../middlewares/auth.middleware";
import {
  cancelScheduledJob,
  createRecurringScheduledJobs,
  createScheduledJob,
  listScheduledJobs
} from "../services/schedule.service";

const scheduledJobIdSchema = z.string().min(1);

const scheduleSourceFields = {
  websiteId: z.string().min(1),
  contentSource: z.nativeEnum(ScheduledContentSource).default(
    ScheduledContentSource.MANUAL
  ),
  topicFocusId: z.string().min(1).optional(),
  topic: z.string().trim().min(3).max(300).optional(),
  primaryKeyword: z.string().trim().min(1).max(200).optional(),
  additionalInstructions: z.string().trim().max(2000).optional(),
  timezone: z.string().trim().min(1).max(100).default("Asia/Bangkok"),
  action: z.nativeEnum(ScheduledJobAction).default(
    ScheduledJobAction.GENERATE_AND_DRAFT
  )
};

const validateScheduleSource = (
  value: {
    contentSource: ScheduledContentSource;
    topicFocusId?: string;
    topic?: string;
    primaryKeyword?: string;
  },
  context: z.RefinementCtx
) => {
  if (
    value.contentSource === ScheduledContentSource.MANUAL &&
    (!value.topic || !value.primaryKeyword)
  ) {
    context.addIssue({
      code: "custom",
      message: "Manual schedules require topic and primary keyword"
    });
  }

  if (
    value.contentSource === ScheduledContentSource.TOPIC_FOCUS_SELECTED &&
    !value.topicFocusId
  ) {
    context.addIssue({
      code: "custom",
      message: "Selected Topic Focus schedules require topicFocusId"
    });
  }
};

const createScheduleSchema = z
  .object({
    ...scheduleSourceFields,
    scheduledAt: z.string().min(1)
  })
  .superRefine(validateScheduleSource);

const createRecurringScheduleSchema = z
  .object({
    ...scheduleSourceFields,
    scheduledAtList: z.array(z.string().min(1)).min(1).max(200)
  })
  .superRefine(validateScheduleSource);



export const createSchedule = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsed = createScheduleSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid schedule payload");
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new HttpError(400, "Invalid scheduled date and time");
  }

  const result = await createScheduledJob({
    companyId: authUser.companyId,
    createdById: authUser.id,
    websiteId: parsed.data.websiteId,
    contentSource: parsed.data.contentSource,
    topicFocusId: parsed.data.topicFocusId,
    topic: parsed.data.topic,
    primaryKeyword: parsed.data.primaryKeyword,
    additionalInstructions: parsed.data.additionalInstructions,
    scheduledAt,
    timezone: parsed.data.timezone,
    action: parsed.data.action
  });

  res.status(201).json({
    success: true,
    data: result
  });
};

export const createRecurringSchedule = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsed = createRecurringScheduleSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid recurring schedule payload");
  }

  const scheduledAtList = parsed.data.scheduledAtList.map(
    (value) => new Date(value)
  );

  if (scheduledAtList.some((value) => Number.isNaN(value.getTime()))) {
    throw new HttpError(400, "Invalid recurring scheduled date and time");
  }

  const jobs = await createRecurringScheduledJobs({
    companyId: authUser.companyId,
    createdById: authUser.id,
    websiteId: parsed.data.websiteId,
    contentSource: parsed.data.contentSource,
    topicFocusId: parsed.data.topicFocusId,
    topic: parsed.data.topic,
    primaryKeyword: parsed.data.primaryKeyword,
    additionalInstructions: parsed.data.additionalInstructions,
    scheduledAtList,
    timezone: parsed.data.timezone,
    action: parsed.data.action
  });

  res.status(201).json({
    success: true,
    count: jobs.length,
    data: jobs
  });
};

export const getSchedules = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const schedules = await listScheduledJobs(authUser.companyId);

  res.status(200).json({
    success: true,
    data: schedules
  });
};

export const cancelSchedule = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authUser = requireAuthUser(req);
  const parsedId = scheduledJobIdSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    throw new HttpError(400, "Invalid scheduled job id");
  }

  const result = await cancelScheduledJob(
    authUser.companyId,
    parsedId.data
  );

  res.status(200).json({
    success: true,
    data: result
  });
};
