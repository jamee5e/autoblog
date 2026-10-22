import {
  ScheduledJobAction,
  ScheduledJobStatus,
  SystemLogLevel
} from "@prisma/client";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { orchestrateArticle } from "./orchestration.service";
import { saveArticleToWordPressDraft } from "./publication.service";
import { createSystemLog } from "./system-log.service";

export interface CreateScheduledJobInput {
  companyId: string;
  createdById: string;
  websiteId: string;
  topic: string;
  primaryKeyword: string;
  additionalInstructions?: string;
  scheduledAt: Date;
  timezone: string;
  action: ScheduledJobAction;
}

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

  const job = await prisma.scheduledJob.create({
    data: {
      companyId: input.companyId,
      websiteId: website.id,
      createdById: input.createdById,
      topic: input.topic,
      primaryKeyword: input.primaryKeyword,
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
      }
    },
    orderBy: [
      { scheduledAt: "asc" },
      { createdAt: "desc" }
    ],
    take: 100
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
    const result = await orchestrateArticle({
      companyId: job.companyId,
      websiteId: job.websiteId,
      topic: job.topic,
      primaryKeyword: job.primaryKeyword,
      additionalInstructions: job.additionalInstructions ?? undefined
    });

    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        articleId: result.articleId
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
