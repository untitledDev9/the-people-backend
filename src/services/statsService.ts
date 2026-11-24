import { Participant } from "../models/Participant.js";
import { toAdmin } from "./participantService.js";

export const TARGET = 5000;
export const MILESTONES = [1, 100, 500, 1000, 2500, 5000];

const PUBLISHED = { isPublished: true, consentConfirmed: true };

function milestoneInfo(count: number) {
  const reached = MILESTONES.filter((m) => m <= count);
  const next = MILESTONES.find((m) => m > count) ?? null;
  return { latestMilestone: reached.length ? reached[reached.length - 1] : null, nextMilestone: next };
}

/** Everything here is derived from real published records. */
export async function publicStats() {
  const [total, events, locations, latest, first] = await Promise.all([
    Participant.countDocuments(PUBLISHED),
    Participant.distinct("eventName", { ...PUBLISHED, eventName: { $ne: "" } }),
    Participant.distinct("location", { ...PUBLISHED, location: { $ne: "" } }),
    Participant.findOne(PUBLISHED).sort({ participantNumber: -1 }).select("participantNumber").lean(),
    Participant.findOne(PUBLISHED).sort({ dateMet: 1 }).select("dateMet").lean(),
  ]);
  return {
    target: TARGET,
    total,
    remaining: Math.max(0, TARGET - total),
    percent: Math.min(100, Number(((total / TARGET) * 100).toFixed(2))),
    events: events.length,
    locations: locations.length,
    latestNumber: latest?.participantNumber ?? null,
    startDate: first?.dateMet ?? null,
    milestones: MILESTONES,
    ...milestoneInfo(total),
  };
}

export async function adminOverview() {
  const [published, drafts, recent] = await Promise.all([
    Participant.countDocuments({ isPublished: true }),
    Participant.countDocuments({ isPublished: false }),
    Participant.find().sort({ participantNumber: -1 }).limit(5).lean(),
  ]);
  return {
    target: TARGET,
    published,
    drafts,
    remaining: Math.max(0, TARGET - published),
    percent: Math.min(100, Number(((published / TARGET) * 100).toFixed(2))),
    recent: recent.map(toAdmin),
    ...milestoneInfo(published),
  };
}
