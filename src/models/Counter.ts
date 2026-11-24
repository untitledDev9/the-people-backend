import { Schema, model } from "mongoose";

/**
 * Atomic counters. The participant counter only ever increments, so a number
 * that was handed out (even to a later-deleted participant) is never reused.
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
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return doc!.seq;
}
