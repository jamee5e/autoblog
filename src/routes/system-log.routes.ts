import { Router } from "express";
import { UserRole } from "@prisma/client";
import { listSystemLogs } from "../controllers/system-log.controller";
import { authorizeRoles } from "../middlewares/auth.middleware";

export const systemLogRouter = Router();

systemLogRouter.get("/", authorizeRoles(UserRole.ADMIN), listSystemLogs);
