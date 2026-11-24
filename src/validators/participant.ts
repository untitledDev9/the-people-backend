import { z } from "zod";

// Multipart bodies arrive as strings, so booleans need explicit parsing.
const bool = z.preprocess((v) => {
  if (typeof v === "string") return v === "true" || v === "1" || v === "on";
  return v;
}, z.boolean());

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const participantInput = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(80),
  biography: optionalText(2000),
  quote: optionalText(300),
  dateMet: z.coerce.date({ message: "A valid date is required" }),
  eventName: optionalText(120),
  location: optionalText(120),
  consentConfirmed: bool.optional().default(false),
  isPublished: bool.optional().default(false),
  confirmNew: bool.optional().default(false),
  removePortrait: bool.optional().default(false),
  removeVideo: bool.optional().default(false),
});

export const publishInput = z.object({ isPublished: bool });

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  q: z.string().trim().max(80).optional().default(""),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  location: z.string().trim().max(120).optional().default(""),
  event: z.string().trim().max(120).optional().default(""),
  status: z.enum(["all", "published", "draft"]).optional().default("all"), // admin only
});

export const settingsInput = z.object({
  projectName: z.string().trim().min(1).max(120),
  brandName: z.string().trim().min(1).max(120),
  tagline: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(3000),
  aboutText: z.string().trim().min(1).max(10000),
  contactEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).default(""),
  tiktok: urlOrEmpty(),
  instagram: urlOrEmpty(),
  youtube: urlOrEmpty(),
  // comma separated participant numbers, e.g. "1, 5, 12"
  featuredParticipants: z
    .string()
    .optional()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map(Number),
    )
    .pipe(z.array(z.number().int().min(1)).max(12, "At most 12 featured participants")),
  removeHeroImage: bool.optional().default(false),
});

function urlOrEmpty() {
  return z
    .string()
    .trim()
    .max(300)
    .optional()
    .default("")
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "Must start with http:// or https://");
}

export const loginInput = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});
