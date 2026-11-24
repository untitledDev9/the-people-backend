import type { z } from "zod";
import { DEFAULT_SETTINGS, Settings } from "../models/Settings.js";
import { Participant } from "../models/Participant.js";
import { assertImageSize } from "../middleware/upload.js";
import { deleteAsset, uploadBuffer, type MediaAsset } from "./mediaService.js";
import { toPublic } from "./participantService.js";
import type { settingsInput } from "../validators/participant.js";

async function loadRaw() {
  const doc = await Settings.findOneAndUpdate(
    { key: "main" },
    { $setOnInsert: { key: "main" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return doc!;
}

function shape(s: any) {
  return {
    projectName: s.projectName ?? DEFAULT_SETTINGS.projectName,
    brandName: s.brandName ?? DEFAULT_SETTINGS.brandName,
    tagline: s.tagline ?? DEFAULT_SETTINGS.tagline,
    description: s.description ?? DEFAULT_SETTINGS.description,
    aboutText: s.aboutText ?? DEFAULT_SETTINGS.aboutText,
    contactEmail: s.contactEmail ?? "",
    whatsapp: s.whatsapp ?? "",
    phone: s.phone ?? "",
    socialLinks: {
      tiktok: s.socialLinks?.tiktok ?? "",
      instagram: s.socialLinks?.instagram ?? "",
      youtube: s.socialLinks?.youtube ?? "",
    },
    heroImageUrl: (s.heroImage?.url as string | undefined) ?? null,
    featuredNumbers: (s.featuredParticipants ?? []) as number[],
    updatedAt: s.updatedAt ?? null,
  };
}

export async function getAdminSettings() {
  return shape(await loadRaw());
}

export async function getPublicSettings() {
  const s = shape(await loadRaw());
  const nums = s.featuredNumbers;
  let featured: ReturnType<typeof toPublic>[] = [];
  if (nums.length) {
    const found = await Participant.find({
      participantNumber: { $in: nums },
      isPublished: true,
      consentConfirmed: true,
    }).lean();
    const byNum = new Map(found.map((p) => [p.participantNumber, p]));
    featured = nums.map((n) => byNum.get(n)).filter(Boolean).map(toPublic);
  }
  const { featuredNumbers: _omit, updatedAt: _u, ...rest } = s;
  return { ...rest, featuredParticipants: featured };
}

export async function updateSettings(input: z.infer<typeof settingsInput>, hero?: Express.Multer.File) {
  const current = await loadRaw();
  const oldHero = current.heroImage as MediaAsset | null;

  let newHero: MediaAsset | undefined;
  if (hero) {
    assertImageSize(hero);
    newHero = await uploadBuffer(hero.buffer, { resourceType: "image", folder: "site" });
  }

  const update: Record<string, unknown> = {
    projectName: input.projectName,
    brandName: input.brandName,
    tagline: input.tagline,
    description: input.description,
    aboutText: input.aboutText,
    contactEmail: input.contactEmail,
    whatsapp: input.whatsapp,
    phone: input.phone,
    "socialLinks.tiktok": input.tiktok,
    "socialLinks.instagram": input.instagram,
    "socialLinks.youtube": input.youtube,
    featuredParticipants: input.featuredParticipants,
  };
  const replaceHero = Boolean(newHero) || input.removeHeroImage;
  if (replaceHero) update.heroImage = newHero ?? null;

  try {
    await Settings.updateOne({ key: "main" }, { $set: update }, { upsert: true });
  } catch (err) {
    await deleteAsset(newHero, "image");
    throw err;
  }
  if (replaceHero) await deleteAsset(oldHero, "image");
  return getAdminSettings();
}
