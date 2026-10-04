import { UserRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { verifyAccessToken } from "../auth/jwt";
import { AuthenticatedUser } from "../auth/auth.types";

const getBearerToken = (header?: string): string => {
  if (!header) {
    throw new HttpError(401, "Missing authorization token");
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Invalid authorization format");
  }

  return token;
};

export const authenticateRequest = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = getBearerToken(req.header("authorization"));
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub }
    });

    if (!user) {
      throw new HttpError(401, "User not found for token");
    }

    req.authUser = {
      id: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      name: user.name
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const authorizeRoles =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.authUser;

    if (!user) {
      next(new HttpError(401, "Authentication required"));
      return;
    }

    if (!roles.includes(user.role)) {
      next(new HttpError(403, "Forbidden"));
      return;
    }

    next();
  };

export const requireAuthUser = (req: Request): AuthenticatedUser => {
  const user = req.authUser;

  if (!user) {
    throw new HttpError(401, "Authentication required");
  }

  return user;
};
