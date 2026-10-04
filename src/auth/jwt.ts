import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { JwtPayload } from "./auth.types";
import { HttpError } from "../errors/http.error";

export const createAccessToken = (userId: string): string => {
  const signOptions: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  };

  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    ...signOptions
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
      throw new HttpError(401, "Invalid access token");
    }

    return { sub: payload.sub };
  } catch {
    throw new HttpError(401, "Invalid access token");
  }
};
