import {
  ScheduledContentSource,
  ScheduledJobAction,
  ScheduledJobStatus,
  SystemLogLevel
} from "@prisma/client";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import {
  orchestrateArticle,
  orchestrateArticleFromTopicFocus,
  resumeArticleWorkflow
} from "./orchestration.service";
import { saveArticleToWordPressDraft } from "./publication.service";
import { createSystemLog } from "./system-log.service";
import { markTopicFocusUsed } from "./topic-focus.service";

export interface CreateScheduledJobInput {
  companyId: string;
  createdById: string;
  websiteId: string;
  contentSource: ScheduledContentSource;
  topicFocusId?: string;
  topic?: string;
  primaryKeyword?: string;
  additionalInstructions?: string;
  scheduledAt: Date;
  timezone: string;
  action: ScheduledJobAction;
}

export interface CreateRecurringScheduledJobsInput
  extends Omit<CreateScheduledJobInput, "scheduledAt"> {
  scheduledAtList: Date[];
}

const MAX_RECURRING_JOBS = 200;
const AUTO_RETRY_DELAYS_MS = [5 * 60 * 1000, 15 * 60 * 1000];

const getErrorDetails = (error: unknown): Record<string, unknown> => {
  if (
    error instanceof HttpError &&
    error.details &&
    typeof error.details === "object" &&
    !Array.isArray(error.details)
  ) {
    return error.details as Record<string, unknown>;
  }

  return {};
};

const isRetryableResearchError = (error: unknown): boolean => {
  if (!(error instanceof HttpError)) return false;

  const details = getErrorDetails(error);
  const phase = details.phase;
  const message = error.message;

  if (phase !== "RESEARCH") return false;
  if (/daily quota exceeded/i.test(message)) return false;

  return [429, 502, 503, 504].includes(error.statusCode);
};

export const createScheduledJob = async (input: CreateScheduledJobInput) => {
  const website = await prisma.website.findFirst({
    where: {
      id: input.websiteId,
      companyId: input.companyId
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!website) {
    throw new HttpError(404, "Website not found");
  }

  if (input.scheduledAt.getTime() <= Date.now()) {
    throw new HttpError(400, "Scheduled date and time must be in the future");
  }

  if (
    input.contentSource === ScheduledContentSource.MANUAL &&
    (!input.topic || !input.primaryKeyword)
  ) {
    throw new HttpError(400, "Manual schedules require topic and primary keyword");
  }

  if (
    input.contentSource === ScheduledContentSource.TOPIC_FOCUS_SELECTED &&
    !input.topicFocusId
  ) {
    throw new HttpError(400, "Selected Topic Focus schedules require topicFocusId");
  }

  if (input.topicFocusId) {
    const focus = await prisma.blogTopicFocus.findFirst({
      where: {
        id: input.topicFocusId,
        websiteId: website.id,
        website: {
          companyId: input.companyId
        }
      },
      select: {
        id: true
      }
    });

    if (!focus) {
      throw new HttpError(404, "Blog Topic Focus not found");
    }
  }

  const job = await prisma.scheduledJob.create({
    data: {
      companyId: input.companyId,
      websiteId: website.id,
      createdById: input.createdById,
      contentSource: input.contentSource,
      topicFocusId: input.topicFocusId || null,
      topic: input.topic || null,
      primaryKeyword: input.primaryKeyword || null,
      additionalInstructions: input.additionalInstructions || null,
      scheduledAt: input.scheduledAt,
      timezone: input.timezone,
      action: input.action,
      status: ScheduledJobStatus.PENDING
    },
    include: {
      website: {
        select: {
          name: true
        }
      }
    }
  });

  await createSystemLog({
    module: "scheduler",
    level: SystemLogLevel.INFO,
    message: "Article workflow scheduled",
    metadata: {
      scheduledJobId: job.id,
      websiteId: job.websiteId,
      scheduledAt: job.scheduledAt,
      timezone: job.timezone,
      action: job.action
    }
  });

  return job;
};

export const createRecurringScheduledJobs = async (
  input: CreateRecurringScheduledJobsInput
) => {
  const uniqueTimes = Array.from(
    new Set(input.scheduledAtList.map((scheduledAt) => scheduledAt.getTime()))
  )
    .sort((a, b) => a - b)
    .map((time) => new Date(time));

  if (uniqueTimes.length === 0) {
    throw new HttpError(400, "Recurring schedule requires at least one run");
  }

  if (uniqueTimes.length > MAX_RECURRING_JOBS) {
    throw new HttpError(
      400,
      `Recurring schedule supports up to ${MAX_RECURRING_JOBS} runs at a time`
    );
  }

  if (
    uniqueTimes.some(
      (scheduledAt) =>
        Number.isNaN(scheduledAt.getTime()) ||
        scheduledAt.getTime() <= Date.now()
    )
  ) {
    throw new HttpError(400, "All recurring schedule times must be in the future");
  }

  const { scheduledAtList: _scheduledAtList, ...baseInput } = input;
  const jobs = [];

  for (const scheduledAt of uniqueTimes) {
    jobs.push(
      await createScheduledJob({
        ...baseInput,
        scheduledAt
      })
    );
  }

  await createSystemLog({
    module: "scheduler",
    level: SystemLogLevel.INFO,
    message: "Recurring article workflows scheduled",
    metadata: {
      websiteId: input.websiteId,
      timezone: input.timezone,
      action: input.action,
      runCount: jobs.length,
      firstRunAt: uniqueTimes[0],
      lastRunAt: uniqueTimes[uniqueTimes.length - 1]
    }
  });

  return jobs;
};

export const listScheduledJobs = async (companyId: string) =>
  prisma.scheduledJob.findMany({
    where: {
      companyId
    },
    include: {
      website: {
        select: {
          name: true
        }
      },
      article: {
        select: {
          id: true,
          status: true,
          title: true,
          wordpressPostId: true,
          wordpressUrl: true
        }
      },
      topicFocus: {
        select: {
          id: true,
          title: true,
          focusTopic: true,
          priority: true
        }
      }
    },
    orderBy: [
      { scheduledAt: "asc" },
      { createdAt: "desc" }
    ],
    take: 200
  });

export const cancelScheduledJob = async (
  companyId: string,
  scheduledJobId: string
) => {
  const job = await prisma.scheduledJob.findFirst({
    where: {
      id: scheduledJobId,
      companyId
    }
  });

  if (!job) {
    throw new HttpError(404, "Scheduled job not found");
  }

  if (job.status !== ScheduledJobStatus.PENDING) {
    throw new HttpError(409, "Only pending schedules can be cancelled");
  }

  const cancelled = await prisma.scheduledJob.update({
    where: { id: job.id },
    data: {
      status: ScheduledJobStatus.CANCELLED,
      completedAt: new Date()
    }
  });

  await createSystemLog({
    module: "scheduler",
    level: SystemLogLevel.INFO,
    message: "Scheduled article workflow cancelled",
    metadata: {
      scheduledJobId: job.id,
      websiteId: job.websiteId
    }
  });

  return cancelled;
};

const executeScheduledJob = async (scheduledJobId: string): Promise<void> => {
  const job = await prisma.scheduledJob.findUnique({
    where: { id: scheduledJobId }
  });

  if (!job || job.status !== ScheduledJobStatus.RUNNING) {
    return;
  }

  try {
    if (
      job.contentSource === ScheduledContentSource.TOPIC_FOCUS_SELECTED &&
      !job.topicFocusId
    ) {
      throw new HttpError(409, "Selected Blog Topic Focus no longer exists");
    }

    let result: Awaited<ReturnType<typeof orchestrateArticle>>;
    let resolvedTopicFocusId = job.topicFocusId;
    const isRetryResume = job.retryCount > 0 && Boolean(job.articleId);

    if (isRetryResume && job.articleId) {
      result = await resumeArticleWorkflow({
        companyId: job.companyId,
        websiteId: job.websiteId,
        articleId: job.articleId
      });

      if (
        job.contentSource !== ScheduledContentSource.MANUAL &&
        job.topicFocusId
      ) {
        await markTopicFocusUsed(job.topicFocusId);
      }
    } else if (job.contentSource === ScheduledContentSource.MANUAL) {
      result = await orchestrateArticle({
        companyId: job.companyId,
        websiteId: job.websiteId,
        topic: job.topic as string,
        primaryKeyword: job.primaryKeyword as string,
        additionalInstructions: job.additionalInstructions ?? undefined
      });
    } else {
      const topicFocusResult = await orchestrateArticleFromTopicFocus({
        companyId: job.companyId,
        websiteId: job.websiteId,
        topicFocusId:
          job.contentSource === ScheduledContentSource.TOPIC_FOCUS_SELECTED
            ? job.topicFocusId ?? undefined
            : undefined
      });

      result = topicFocusResult;
      resolvedTopicFocusId = topicFocusResult.topicFocus.id;
    }

    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        articleId: result.articleId,
        topicFocusId: resolvedTopicFocusId
      }
    });

    let wordpressDraftCreated = false;

    if (
      job.action === ScheduledJobAction.GENERATE_AND_DRAFT &&
      result.status === "READY"
    ) {
      await saveArticleToWordPressDraft({
        companyId: job.companyId,
        articleId: result.articleId
      });
      wordpressDraftCreated = true;
    }

    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        status: ScheduledJobStatus.COMPLETED,
        completedAt: new Date(),
        lastError: null
      }
    });

    await createSystemLog({
      module: "scheduler",
      level: SystemLogLevel.INFO,
      message: "Scheduled article workflow completed",
      metadata: {
        scheduledJobId: job.id,
        articleId: result.articleId,
        finalStatus: result.status,
        decision: result.decision,
        revisionCount: result.revisionCount,
        retryCount: job.retryCount,
        wordpressDraftCreated
      }
    });
  } catch (error) {
    const message =
      error instanceof HttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Scheduled article workflow failed";

    const details = getErrorDetails(error);
    const retryable =
      isRetryableResearchError(error) &&
      job.retryCount < job.maxRetries;

    if (retryable) {
      const retryDelayMs =
        AUTO_RETRY_DELAYS_MS[
          Math.min(job.retryCount, AUTO_RETRY_DELAYS_MS.length - 1)
        ];
      const nextRetryAt = new Date(Date.now() + retryDelayMs);
      const nextRetryCount = job.retryCount + 1;
      const articleId =
        typeof details.articleId === "string"
          ? details.articleId
          : job.articleId;
      const topicFocusId =
        typeof details.topicFocusId === "string"
          ? details.topicFocusId
          : job.topicFocusId;

      await prisma.scheduledJob.update({
        where: { id: job.id },
        data: {
          status: ScheduledJobStatus.PENDING,
          retryCount: nextRetryCount,
          scheduledAt: nextRetryAt,
          startedAt: null,
          completedAt: null,
          lastError:
            `Auto retry ${nextRetryCount}/${job.maxRetries} scheduled · ${message}`,
          articleId,
          topicFocusId
        }
      });

      await createSystemLog({
        module: "scheduler",
        level: SystemLogLevel.WARN,
        message: "Scheduled article research queued for automatic retry",
        metadata: {
          scheduledJobId: job.id,
          websiteId: job.websiteId,
          articleId,
          topicFocusId,
          retryCount: nextRetryCount,
          maxRetries: job.maxRetries,
          nextRetryAt,
          retryDelayMinutes: Math.round(retryDelayMs / 60_000),
          errorMessage: message
        }
      });

      return;
    }

    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        status: ScheduledJobStatus.FAILED,
        completedAt: new Date(),
        lastError: message
      }
    });

    await createSystemLog({
      module: "scheduler",
      level: SystemLogLevel.ERROR,
      message: "Scheduled article workflow failed",
      metadata: {
        scheduledJobId: job.id,
        websiteId: job.websiteId,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
        errorMessage: message
      }
    });
  }
};

let workerBusy = false;

export const processDueScheduledJobs = async (): Promise<void> => {
  if (workerBusy) return;

  workerBusy = true;

  try {
    const staleBefore = new Date(Date.now() - 30 * 60 * 1000);

    await prisma.scheduledJob.updateMany({
      where: {
        status: ScheduledJobStatus.RUNNING,
        startedAt: {
          lte: staleBefore
        }
      },
      data: {
        status: ScheduledJobStatus.PENDING,
        startedAt: null,
        lastError: "Recovered after an interrupted schedule worker"
      }
    });

    const dueJobs = await prisma.scheduledJob.findMany({
      where: {
        status: ScheduledJobStatus.PENDING,
        scheduledAt: {
          lte: new Date()
        }
      },
      orderBy: {
        scheduledAt: "asc"
      },
      take: 5,
      select: {
        id: true
      }
    });

    for (const dueJob of dueJobs) {
      const claimed = await prisma.scheduledJob.updateMany({
        where: {
          id: dueJob.id,
          status: ScheduledJobStatus.PENDING
        },
        data: {
          status: ScheduledJobStatus.RUNNING,
          startedAt: new Date(),
          lastError: null
        }
      });

      if (claimed.count === 1) {
        await executeScheduledJob(dueJob.id);
      }
    }
  } finally {
    workerBusy = false;
  }
};

const SCHEDULER_INTERVAL_MS = 15_000;

const runScheduleWorkerTick = async (): Promise<void> => {
  try {
    await processDueScheduledJobs();
  } catch (error) {
    console.error(
      "Schedule worker tick failed",
      error instanceof Error ? error.message : error
    );
  }
};

export const startScheduleWorker = (): void => {
  void runScheduleWorkerTick();

  const timer = setInterval(() => {
    void runScheduleWorkerTick();
  }, SCHEDULER_INTERVAL_MS);

  timer.unref();
};
