import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  // Make sure unique indexes exist before accepting traffic.
  await mongoose.connection.syncIndexes();
  console.log("MongoDB connected");
}
