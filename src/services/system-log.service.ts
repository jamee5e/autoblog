import { Prisma, SystemLogLevel } from "@prisma/client";
import { prisma } from "../config/database";
import { sanitizeMetadata } from "../utils/sanitize-metadata";

const toPrismaJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

export const createSystemLog = async (params: {
  module: string;
  level: SystemLogLevel;
  message: string;
  metadata?: unknown;
}): Promise<void> => {
  await prisma.systemLog.create({
    data: {
      module: params.module,
      level: params.level,
      message: params.message,
      metadata:
        params.metadata === undefined
          ? undefined
          : toPrismaJsonValue(sanitizeMetadata(params.metadata))
    }
  });
};
