import mongoose from "mongoose";
import { connectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { Counter } from "../models/Counter.js";
import { Participant } from "../models/Participant.js";
import { Settings } from "../models/Settings.js";
import { createInNextSlot } from "../services/participantService.js";

/**
 * DEMO DATA, for previewing the design only.
 *   npm run seed:demo                          add 5 clearly labelled demo people (+ hero placeholder)
 *   npm run seed:demo -- --base=https://my-site.vercel.app
 *                                              serve the placeholder images from your deployed site
 *   npm run seed:demo:remove                   remove ONLY the demo records again
 * Refuses to run when NODE_ENV=production.
 *
 * Demo people are real database rows, so they show on whatever site uses this database. Placeholder
 * portraits are the SVGs in client/public/demo; the sample videos are Cloudinary's public demo clips.
 * Removing demo people leaves their numbers EMPTY, and your first real people fill them (#0001...).
 */
if (env.isProd) {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

const baseArg = process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length);
const base = (baseArg || process.env.DEMO_ASSET_BASE || env.clientOrigins.find((o) => o.startsWith("https://")) || env.clientOrigins[0] || "http://localhost:3000").replace(/\/$/, "");
const img = (name: string) => ({ url: `${base}/demo/${name}`, publicId: `demo:${name}` });
const clip = (name: string) => ({ url: `https://res.cloudinary.com/demo/video/upload/${name}.mp4`, publicId: `demo:${name}.mp4` });

const people = [
  { name: "Demo Sarah", loc: "Lagos", event: "Street market", quote: "I almost said no. I'm glad I didn't.", bio: "DEMO DATA. A placeholder profile so you can see how a real introduction will read.", video: clip("dog") },
  { name: "Demo Michael", loc: "Lagos", event: "", quote: "", bio: "DEMO DATA. Real stories will replace these once you publish actual participants.", video: clip("elephants") },
  { name: "Demo Amara", loc: "Abuja", event: "Tech meetup", quote: "Everyone has a story worth hearing.", bio: "DEMO DATA. Placeholder biography text.", video: null },
  { name: "Demo David", loc: "Abuja", event: "", quote: "", bio: "DEMO DATA. Placeholder biography text.", video: clip("sea_turtle") },
  { name: "Demo Zainab", loc: "Lagos", event: "Concert", quote: "Introductions are easier than you think.", bio: "DEMO DATA. Placeholder biography text.", video: null },
];

async function remove() {
  const res = await Participant.deleteMany({ isDemo: true });
  const remaining = await Participant.countDocuments();
  // With nobody left, restart numbering so the first real person is #0001.
  if (remaining === 0) await Counter.deleteOne({ _id: "participant" });
  await Settings.updateOne({ key: "main", "heroImage.publicId": "demo:hero.svg" }, { $set: { heroImage: null } });
  console.log(`Removed ${res.deletedCount} demo participants.${remaining === 0 ? " Numbering reset to start at 0001." : " Their numbers are now empty and will be filled by the next people you add."}`);
}

async function add() {
  if (await Participant.exists({ isDemo: true })) {
    console.log("Demo data already present. Run `npm run seed:demo:remove` first to reseed.");
    return;
  }
  if (await Participant.exists({ isDemo: false })) {
    console.warn("Note: real participants exist. Demo people will take the lowest empty numbers; remove them before launch.");
  }
  const now = Date.now();
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const doc = await createInNextSlot({
      displayName: p.name,
      biography: p.bio,
      quote: p.quote,
      location: p.loc,
      eventName: p.event,
      dateMet: new Date(now - (people.length - i) * 6 * 24 * 3600 * 1000),
      portrait: img(`portrait-${i + 1}.svg`),
      video: p.video,
      consentConfirmed: true,
      isPublished: true,
      isDemo: true,
    });
    console.log(`  #${String(doc.participantNumber).padStart(4, "0")} ${p.name}`);
  }
  await Settings.updateOne({ key: "main" }, { $set: { heroImage: img("hero.svg") } }, { upsert: true });
  console.log(`Added ${people.length} DEMO participants and a placeholder hero image (images served from ${base}).`);
  console.log("Remove them any time with: npm run seed:demo:remove");
}

async function main() {
  await connectDb();
  if (process.argv.includes("--remove")) await remove();
  else await add();
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
