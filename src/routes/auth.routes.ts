import { Router } from "express";
import { getMe, login } from "../controllers/auth.controller";
import { authenticateRequest } from "../middlewares/auth.middleware";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.get("/me", authenticateRequest, getMe);
