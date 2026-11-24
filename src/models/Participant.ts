import { Schema, model, type InferSchemaType } from "mongoose";

const mediaSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

const participantSchema = new Schema(
  {
    participantNumber: { type: Number, required: true, unique: true, min: 1, index: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    biography: { type: String, trim: true, maxlength: 2000, default: "" },
    quote: { type: String, trim: true, maxlength: 300, default: "" },
    portrait: { type: mediaSchema, default: null },
    video: { type: mediaSchema, default: null },
    dateMet: { type: Date, required: true },
    eventName: { type: String, trim: true, maxlength: 120, default: "" },
    location: { type: String, trim: true, maxlength: 120, default: "" },
    consentConfirmed: { type: Boolean, required: true, default: false },
    isPublished: { type: Boolean, required: true, default: false },
    // Times this person has been met again after the first introduction.
    // Returning people never take a new number.
    // True only for records created by `npm run seed:demo`. Never set by the API.
    isDemo: { type: Boolean, default: false, index: true },
    returnCount: { type: Number, default: 0, min: 0 },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

participantSchema.index({ isPublished: 1, participantNumber: -1 });
participantSchema.index({ displayName: 1 });

// Publishing is only valid with consent. Enforced at the model level too.
participantSchema.pre("validate", function () {
  if (this.isPublished && !this.consentConfirmed) {
    this.invalidate("isPublished", "A participant cannot be published without consent");
  }
});

export type ParticipantDoc = InferSchemaType<typeof participantSchema> & { _id: import("mongoose").Types.ObjectId };
export const Participant = model("Participant", participantSchema);
