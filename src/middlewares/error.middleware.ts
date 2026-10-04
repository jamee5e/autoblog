import { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors/http.error";

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new HttpError(404, "Route not found"));
};

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
    return;
  }

  console.error("Unhandled error", error);

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
};
