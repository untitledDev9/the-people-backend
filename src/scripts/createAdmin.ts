import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "../config/db.js";
import { Admin } from "../models/Admin.js";

// Usage: npm run create-admin -- you@example.com "a-strong-password"
const [email, password] = process.argv.slice(2);

async function main() {
  if (!email || !password) {
    console.error('Usage: npm run create-admin -- <email> "<password>"');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Password must be at least 10 characters.");
    process.exit(1);
  }
  await connectDb();
  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.findOneAndUpdate({ email: email.toLowerCase() }, { email, passwordHash }, { upsert: true, new: true });
  console.log(`Admin ready: ${email}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
