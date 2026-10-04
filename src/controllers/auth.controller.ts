import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { createAccessToken } from "../auth/jwt";
import { requireAuthUser } from "../middlewares/auth.middleware";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});

const toAuthUserResponse = (user: {
  id: string;
  companyId: string;
  email: string;
  name: string;
  role: string;
}) => ({
  id: user.id,
  companyId: user.companyId,
  email: user.email,
  name: user.name,
  role: user.role
});

export const login = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid request payload");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new HttpError(401, "Invalid email or password");
  }

  const accessToken = createAccessToken(user.id);

  res.status(200).json({
    success: true,
    accessToken,
    user: toAuthUserResponse(user)
  });
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  const authUser = requireAuthUser(req);

  res.status(200).json({
    success: true,
    user: toAuthUserResponse(authUser)
  });
};
