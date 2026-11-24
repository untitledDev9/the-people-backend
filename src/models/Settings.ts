import { Schema, model } from "mongoose";

export const DEFAULT_SETTINGS = {
  projectName: "The 5,000 People Project",
  brandName: "No Introduction Needed",
  tagline: "5,000 people. 5,000 stories. One journey.",
  description:
    "I'm setting out to meet 5,000 unique people, one introduction at a time. Different backgrounds, different personalities and different stories. I don't know who I'll meet or what I'll discover along the way. That's the beauty of the journey.",
  aboutText:
    "The 5,000 People Project is a personal social experiment. I'm meeting 5,000 unique people, one introduction at a time, and documenting each one.\n\nNo scripts. No expectations. Just real people and real connections.\n\nEveryone featured here has agreed to be shared. If you'd like to be removed at any time, get in touch and your profile comes down.",
  contactEmail: "",
  whatsapp: "",
  phone: "",
  socialLinks: { tiktok: "", instagram: "", youtube: "" },
  heroImage: null as { url: string; publicId: string } | null,
  featuredParticipants: [] as number[],
};

const mediaSchema = new Schema({ url: String, publicId: String }, { _id: false });

const settingsSchema = new Schema(
  {
    key: { type: String, default: "main", unique: true },
    projectName: { type: String, default: DEFAULT_SETTINGS.projectName, maxlength: 120 },
    brandName: { type: String, default: DEFAULT_SETTINGS.brandName, maxlength: 120 },
    tagline: { type: String, default: DEFAULT_SETTINGS.tagline, maxlength: 200 },
    description: { type: String, default: DEFAULT_SETTINGS.description, maxlength: 3000 },
    aboutText: { type: String, default: DEFAULT_SETTINGS.aboutText, maxlength: 10000 },
    contactEmail: { type: String, default: "", maxlength: 200 },
    whatsapp: { type: String, default: "", maxlength: 30 },
    phone: { type: String, default: "", maxlength: 30 },
    socialLinks: {
      tiktok: { type: String, default: "" },
      instagram: { type: String, default: "" },
      youtube: { type: String, default: "" },
    },
    heroImage: { type: mediaSchema, default: null },
    featuredParticipants: { type: [Number], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const Settings = model("Settings", settingsSchema);
