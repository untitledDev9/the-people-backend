import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export const AUTH_COOKIE = "admin_token";

declare module "express-serve-static-core" {
  interface Request {
    adminId?: string;
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return next(new AppError(401, "Authentication required"));
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    req.adminId = payload.sub;
    next();
  } catch {
    next(new AppError(401, "Session expired. Please sign in again."));
  }
}

/**
 * CSRF defence for cookie auth: state-changing requests must carry a custom
 * header (which cross-site forms cannot set) and, when an Origin is sent, it
 * must be one of our configured client origins. Combined with SameSite=Lax.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("X-Requested-With") !== "XMLHttpRequest") {
    return next(new AppError(403, "Missing CSRF header"));
  }
  const origin = req.get("Origin");
  if (origin && !env.clientOrigins.includes(origin)) {
    return next(new AppError(403, "Origin not allowed"));
  }
  next();
}
