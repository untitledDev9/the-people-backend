import { Schema, model } from "mongoose";

/**
 * Atomic counters. The participant counter only ever increments: it is the highest number ever
 * handed out. Numbers below it that no longer have a person are EMPTY slots, which the next new
 * person fills first (see createInNextSlot in participantService).
 */
const counterSchema = new Schema<{ _id: string; seq: number }>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = model("Counter", counterSchema);

export async function nextSequence(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return doc!.seq;
}
