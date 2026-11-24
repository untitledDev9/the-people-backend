import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, "Not found"));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: "Validation failed",
      details: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: "Invalid identifier" });
  }
  if ((err as { code?: number })?.code === 11000) {
    return res.status(409).json({ error: "Duplicate value" });
  }
  console.error(err);
  res.status(500).json({ error: env.isProd ? "Internal server error" : String((err as Error)?.message ?? err) });
}
