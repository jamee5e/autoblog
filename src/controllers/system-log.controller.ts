import { SystemLogLevel } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { requireAuthUser } from "../middlewares/auth.middleware";

const querySchema = z.object({
  module: z.string().min(1).optional(),
  level: z.nativeEnum(SystemLogLevel).optional()
});

export const listSystemLogs = async (req: Request, res: Response): Promise<void> => {
  requireAuthUser(req);
  const parsed = querySchema.safeParse({
    module: req.query.module,
    level: req.query.level
  });

  if (!parsed.success) {
    throw new HttpError(400, "Invalid query parameters");
  }

  const logs = await prisma.systemLog.findMany({
    where: {
      module: parsed.data.module,
      level: parsed.data.level
    },
    select: {
      id: true,
      createdAt: true,
      level: true,
      module: true,
      message: true
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  res.status(200).json({
    success: true,
    data: logs
  });
};
