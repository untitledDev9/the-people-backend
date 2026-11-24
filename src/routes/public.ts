import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { listQuery } from "../validators/participant.js";
import * as participants from "../services/participantService.js";
import { getPublicSettings } from "../services/settingsService.js";
import { publicStats } from "../services/statsService.js";

export const publicRouter = Router();

// NOTE: static paths must be declared before "/participants/:number".
publicRouter.get(
  "/participants",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    res.json(await participants.listParticipants(q, true));
  }),
);

publicRouter.get(
  "/participants/latest",
  asyncHandler(async (req, res) => {
    const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 8));
    res.json({ items: await participants.latestPublished(limit) });
  }),
);

publicRouter.get(
  "/participants/filters",
  asyncHandler(async (_req, res) => {
    res.json(await participants.publicFilters());
  }),
);

publicRouter.get(
  "/participants/:number",
  asyncHandler(async (req, res) => {
    const num = Number(req.params.number);
    if (!Number.isInteger(num) || num < 1) throw new AppError(404, "Participant not found");
    res.json(await participants.getPublicByNumber(num));
  }),
);

publicRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    res.json(await publicStats());
  }),
);

publicRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    res.json(await getPublicSettings());
  }),
);
