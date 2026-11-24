import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { env } from "../config/env.js";
import { Admin } from "../models/Admin.js";
import { AUTH_COOKIE, csrfGuard, requireAdmin } from "../middleware/auth.js";
import { participantUpload, settingsUpload } from "../middleware/upload.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listQuery, loginInput, participantInput, publishInput, settingsInput } from "../validators/participant.js";
import * as participants from "../services/participantService.js";
import { adminOverview } from "../services/statsService.js";
import { getAdminSettings, updateSettings } from "../services/settingsService.js";

export const adminRouter = Router();

adminRouter.use(csrfGuard);

/* ---------- Auth ---------- */

// Tiny in-memory login throttle (per IP). Enough for a single-admin site.
const attempts = new Map<string, { count: number; reset: number }>();
function throttle(ip: string) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.reset < now) {
    attempts.set(ip, { count: 1, reset: now + 15 * 60_000 });
    return;
  }
  rec.count += 1;
  if (rec.count > 10) throw new AppError(429, "Too many attempts. Try again in a few minutes.");
}

const cookieOptions = {
  httpOnly: true,
  // SameSite=None requires Secure, so force it on in that case.
  secure: env.isProd || env.COOKIE_SAMESITE === "none",
  sameSite: env.COOKIE_SAMESITE,
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

adminRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    throttle(req.ip ?? "unknown");
    const { email, password } = loginInput.parse(req.body);
    const admin = await Admin.findOne({ email }).select("+passwordHash");
    // Compare even when the user is missing to keep timing uniform.
    const hash = admin?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali";
    const ok = await bcrypt.compare(password, hash);
    if (!admin || !ok) throw new AppError(401, "Incorrect email or password");
    const token = jwt.sign({ sub: String(admin._id) }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });
    res.cookie(AUTH_COOKIE, token, cookieOptions);
    res.json({ email: admin.email });
  }),
);

adminRouter.post("/auth/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

// Everything below requires a valid admin session.
adminRouter.use(requireAdmin);

adminRouter.get(
  "/auth/me",
  asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.adminId).lean();
    if (!admin) throw new AppError(401, "Account no longer exists");
    res.json({ email: admin.email });
  }),
);

adminRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    res.json(await adminOverview());
  }),
);

/* ---------- Participants ---------- */

function idParam(raw: string | string[]) {
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!isValidObjectId(id)) throw new AppError(400, "Invalid participant id");
  return id;
}

adminRouter.get(
  "/participants",
  asyncHandler(async (req, res) => {
    res.json(await participants.listParticipants(listQuery.parse(req.query), false));
  }),
);

adminRouter.get(
  "/participants/:id",
  asyncHandler(async (req, res) => {
    res.json(participants.toAdmin(await participants.getById(idParam(req.params.id))));
  }),
);

adminRouter.post(
  "/participants",
  participantUpload,
  asyncHandler(async (req, res) => {
    const input = participantInput.parse(req.body);
    const created = await participants.createParticipant(input, (req.files ?? {}) as participants.UploadedFiles);
    res.status(201).json(created);
  }),
);

adminRouter.put(
  "/participants/:id",
  participantUpload,
  asyncHandler(async (req, res) => {
    const input = participantInput.parse(req.body);
    res.json(
      await participants.updateParticipant(idParam(req.params.id), input, (req.files ?? {}) as participants.UploadedFiles),
    );
  }),
);

adminRouter.patch(
  "/participants/:id/publish",
  asyncHandler(async (req, res) => {
    const { isPublished } = publishInput.parse(req.body);
    res.json(await participants.setPublished(idParam(req.params.id), isPublished));
  }),
);

adminRouter.post(
  "/participants/:id/returning",
  asyncHandler(async (req, res) => {
    res.json(await participants.logReturning(idParam(req.params.id)));
  }),
);

adminRouter.delete(
  "/participants/:id",
  asyncHandler(async (req, res) => {
    await participants.deleteParticipant(idParam(req.params.id));
    res.json({ ok: true });
  }),
);

/* ---------- Settings ---------- */

adminRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    res.json(await getAdminSettings());
  }),
);

adminRouter.put(
  "/settings",
  settingsUpload,
  asyncHandler(async (req, res) => {
    const input = settingsInput.parse(req.body);
    const hero = (req.files as { heroImage?: Express.Multer.File[] } | undefined)?.heroImage?.[0];
    res.json(await updateSettings(input, hero));
  }),
);
