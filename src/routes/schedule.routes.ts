import { Router } from "express";
import { UserRole } from "@prisma/client";
import {
  cancelSchedule,
  createRecurringSchedule,
  createSchedule,
  getSchedules
} from "../controllers/schedule.controller";
import { authorizeRoles } from "../middlewares/auth.middleware";

export const scheduleRouter = Router();

scheduleRouter.get(
  "/",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  getSchedules
);

scheduleRouter.post(
  "/",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  createSchedule
);

scheduleRouter.post(
  "/recurring",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  createRecurringSchedule
);

scheduleRouter.post(
  "/:id/cancel",
  authorizeRoles(UserRole.ADMIN, UserRole.EDITOR),
  cancelSchedule
);
