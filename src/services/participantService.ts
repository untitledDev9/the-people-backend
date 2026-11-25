import type { QueryFilter as FilterQuery } from "mongoose";
import { Participant } from "../models/Participant.js";
import { Counter, nextSequence } from "../models/Counter.js";
import { AppError } from "../utils/AppError.js";
import { assertImageSize } from "../middleware/upload.js";
import { assertOwnAsset, deleteAsset, uploadBuffer, type MediaAsset } from "./mediaService.js";
import type { z } from "zod";
import type { listQuery, participantInput } from "../validators/participant.js";

type Input = z.infer<typeof participantInput>;
type ListQuery = z.infer<typeof listQuery>;
export type UploadedFiles = { portrait?: Express.Multer.File[]; video?: Express.Multer.File[] };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------- Serialisation ---------- */

/** The ONLY shape ever sent to public visitors. */
export function toPublic(p: any) {
  return {
    number: p.participantNumber as number,
    displayName: p.displayName as string,
    biography: p.biography || "",
    quote: p.quote || "",
    portraitUrl: p.portrait?.url ?? null,
    videoUrl: p.video?.url ?? null,
    dateMet: p.dateMet as Date,
    eventName: p.eventName || "",
    location: p.location || "",
  };
}

export function toAdmin(p: any) {
  return {
    id: String(p._id),
    number: p.participantNumber as number,
    displayName: p.displayName as string,
    biography: p.biography || "",
    quote: p.quote || "",
    portraitUrl: p.portrait?.url ?? null,
    videoUrl: p.video?.url ?? null,
    dateMet: p.dateMet as Date,
    eventName: p.eventName || "",
    location: p.location || "",
    consentConfirmed: p.consentConfirmed as boolean,
    isPublished: p.isPublished as boolean,
    returnCount: (p.returnCount ?? 0) as number,
    lastSeenAt: p.lastSeenAt ?? null,
    createdAt: p.createdAt as Date,
    updatedAt: p.updatedAt as Date,
  };
}

/* ---------- Queries ---------- */

function buildFilter(q: ListQuery, publicOnly: boolean): FilterQuery<any> {
  const filter: FilterQuery<any> = {};
  if (publicOnly) {
    filter.isPublished = true;
    filter.consentConfirmed = true;
  } else if (q.status === "published") filter.isPublished = true;
  else if (q.status === "draft") filter.isPublished = false;

  if (q.q) {
    const digits = q.q.replace(/^#/, "");
    const or: FilterQuery<any>[] = [{ displayName: { $regex: escapeRegex(q.q), $options: "i" } }];
    if (/^\d{1,6}$/.test(digits)) or.push({ participantNumber: Number(digits) });
    filter.$or = or;
  }
  if (q.location) filter.location = q.location;
  if (q.event) filter.eventName = q.event;
  return filter;
}

export async function listParticipants(q: ListQuery, publicOnly: boolean) {
  const filter = buildFilter(q, publicOnly);
  const sort = { participantNumber: q.sort === "newest" ? -1 : 1 } as const;
  const [items, total] = await Promise.all([
    Participant.find(filter)
      .sort(sort)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Participant.countDocuments(filter),
  ]);
  return {
    items: items.map(publicOnly ? toPublic : toAdmin),
    page: q.page,
    limit: q.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.limit)),
  };
}

export async function latestPublished(limit = 8) {
  const items = await Participant.find({ isPublished: true, consentConfirmed: true })
    .sort({ participantNumber: -1 })
    .limit(limit)
    .lean();
  return items.map(toPublic);
}

export async function getPublicByNumber(num: number) {
  const base = { isPublished: true, consentConfirmed: true };
  const p = await Participant.findOne({ ...base, participantNumber: num }).lean();
  if (!p) throw new AppError(404, "Participant not found");
  const [prev, next] = await Promise.all([
    Participant.findOne({ ...base, participantNumber: { $lt: num } })
      .sort({ participantNumber: -1 })
      .select("participantNumber displayName")
      .lean(),
    Participant.findOne({ ...base, participantNumber: { $gt: num } })
      .sort({ participantNumber: 1 })
      .select("participantNumber displayName")
      .lean(),
  ]);
  const nav = (x: any) => (x ? { number: x.participantNumber as number, displayName: x.displayName as string } : null);
  return { ...toPublic(p), prev: nav(prev), next: nav(next) };
}

export async function publicFilters() {
  const base = { isPublished: true, consentConfirmed: true };
  const [locations, events] = await Promise.all([
    Participant.distinct("location", { ...base, location: { $ne: "" } }),
    Participant.distinct("eventName", { ...base, eventName: { $ne: "" } }),
  ]);
  return { locations: locations.sort(), events: events.sort() };
}

export async function getById(id: string) {
  const p = await Participant.findById(id).lean();
  if (!p) throw new AppError(404, "Participant not found");
  return p;
}

/* ---------- Numbering ---------- */

/**
 * Numbers are slots 1..N. A number belongs to one person for as long as they exist and never
 * changes. When someone is deleted their slot becomes EMPTY (nobody shifts down), and the next
 * person you add fills the lowest empty slot before a brand-new number is handed out.
 */
async function slotInfo() {
  const counter = await Counter.findById("participant").lean();
  const seq = counter?.seq ?? 0;
  const used = new Set((await Participant.find({}, { participantNumber: 1 }).lean()).map((p) => p.participantNumber));
  const vacant: number[] = [];
  for (let n = 1; n <= seq; n++) if (!used.has(n)) vacant.push(n);
  return { seq, vacant };
}

export async function getSlots() {
  const { seq, vacant } = await slotInfo();
  // `seq` is the highest number ever handed out; numbers after the empty ones continue from seq + 1.
  return { next: vacant[0] ?? seq + 1, vacant, seq };
}

/** Creates a participant in the lowest empty slot (or the next new number). Retries on a rare race. */
export async function createInNextSlot(data: Record<string, unknown>) {
  for (let attempt = 0; ; attempt++) {
    const { vacant } = await slotInfo();
    const participantNumber = vacant[0] ?? (await nextSequence("participant"));
    try {
      return await Participant.create({ ...data, participantNumber });
    } catch (err: any) {
      if (err?.code === 11000 && err?.keyPattern?.participantNumber && attempt < 4) continue;
      throw err;
    }
  }
}

/* ---------- Writes ---------- */

/** Files uploaded straight to Cloudinary by the browser (preferred) or sent as multipart. */
async function resolveMedia(input: Input, files: UploadedFiles) {
  const portraitAsset = input.portraitAsset ? assertOwnAsset(input.portraitAsset, "image") : undefined;
  const videoAsset = input.videoAsset ? assertOwnAsset(input.videoAsset, "video") : undefined;
  const uploaded = await uploadFiles({
    portrait: portraitAsset ? undefined : files.portrait,
    video: videoAsset ? undefined : files.video,
  });
  return { portrait: portraitAsset ?? uploaded.portrait, video: videoAsset ?? uploaded.video, uploaded };
}

async function uploadFiles(files: UploadedFiles) {
  let portrait: MediaAsset | undefined;
  let video: MediaAsset | undefined;
  try {
    const pf = files.portrait?.[0];
    if (pf) {
      assertImageSize(pf);
      portrait = await uploadBuffer(pf.buffer, { resourceType: "image", folder: "portraits" });
    }
    const vf = files.video?.[0];
    if (vf) video = await uploadBuffer(vf.buffer, { resourceType: "video", folder: "videos" });
  } catch (err) {
    await Promise.all([deleteAsset(portrait, "image"), deleteAsset(video, "video")]);
    throw err;
  }
  return { portrait, video };
}

export async function createParticipant(input: Input, files: UploadedFiles) {
  if (input.isPublished && !input.consentConfirmed) {
    throw new AppError(400, "Consent must be confirmed before a participant can be published");
  }

  // Guard against registering the same person twice. They must be explicitly
  // confirmed as a different person, or logged as a returning encounter.
  if (!input.confirmNew) {
    const dupes = await Participant.find({ displayName: input.displayName })
      .collation({ locale: "en", strength: 2 })
      .select("participantNumber displayName dateMet")
      .lean();
    if (dupes.length) {
      throw new AppError(409, "Someone with this name is already in the project.", {
        code: "POSSIBLE_DUPLICATE",
        duplicates: dupes.map((d) => ({
          id: String(d._id),
          number: d.participantNumber,
          displayName: d.displayName,
          dateMet: d.dateMet,
        })),
      });
    }
  }

  // Media first, so a failed upload never takes a number.
  const media = await resolveMedia(input, files);
  try {
    const doc = await createInNextSlot({
      displayName: input.displayName,
      biography: input.biography,
      quote: input.quote,
      dateMet: input.dateMet,
      eventName: input.eventName,
      location: input.location,
      consentConfirmed: input.consentConfirmed,
      isPublished: input.isPublished,
      portrait: media.portrait ?? null,
      video: media.video ?? null,
    });
    return toAdmin(doc.toObject());
  } catch (err) {
    // Only clean up what THIS request uploaded; browser-uploaded files stay so the form can retry.
    await Promise.all([deleteAsset(media.uploaded.portrait, "image"), deleteAsset(media.uploaded.video, "video")]);
    throw err;
  }
}

export async function updateParticipant(id: string, input: Input, files: UploadedFiles) {
  const existing = await Participant.findById(id);
  if (!existing) throw new AppError(404, "Participant not found");

  const consent = input.consentConfirmed;
  if (input.isPublished && !consent) {
    throw new AppError(400, "Consent must be confirmed before a participant can be published");
  }

  const media = await resolveMedia(input, files);
  const oldPortrait = existing.portrait as MediaAsset | null;
  const oldVideo = existing.video as MediaAsset | null;
  const dropPortrait = Boolean(media.portrait) || input.removePortrait;
  const dropVideo = Boolean(media.video) || input.removeVideo;

  existing.set({
    displayName: input.displayName,
    biography: input.biography,
    quote: input.quote,
    dateMet: input.dateMet,
    eventName: input.eventName,
    location: input.location,
    consentConfirmed: consent,
    // Withdrawing consent always takes the profile offline.
    isPublished: consent ? input.isPublished : false,
  });
  if (dropPortrait) existing.set("portrait", media.portrait ?? null);
  if (dropVideo) existing.set("video", media.video ?? null);

  try {
    await existing.save();
  } catch (err) {
    await Promise.all([deleteAsset(media.uploaded.portrait, "image"), deleteAsset(media.uploaded.video, "video")]);
    throw err;
  }
  // Only remove replaced media once the new state is safely stored.
  if (dropPortrait) await deleteAsset(oldPortrait, "image");
  if (dropVideo) await deleteAsset(oldVideo, "video");
  return toAdmin(existing.toObject());
}

export async function setPublished(id: string, isPublished: boolean) {
  const p = await Participant.findById(id);
  if (!p) throw new AppError(404, "Participant not found");
  if (isPublished && !p.consentConfirmed) {
    throw new AppError(400, "Consent must be confirmed before a participant can be published");
  }
  p.isPublished = isPublished;
  await p.save();
  return toAdmin(p.toObject());
}

/** Log meeting an existing person again. Does NOT create a new number. */
export async function logReturning(id: string) {
  const p = await Participant.findByIdAndUpdate(
    id,
    { $inc: { returnCount: 1 }, $set: { lastSeenAt: new Date() } },
    { new: true },
  ).lean();
  if (!p) throw new AppError(404, "Participant not found");
  return toAdmin(p);
}

export async function deleteParticipant(id: string) {
  const p = await Participant.findByIdAndDelete(id).lean();
  if (!p) throw new AppError(404, "Participant not found");
  await Promise.all([deleteAsset(p.portrait as MediaAsset | null, "image"), deleteAsset(p.video as MediaAsset | null, "video")]);
}
