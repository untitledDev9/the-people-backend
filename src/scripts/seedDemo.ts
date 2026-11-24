import mongoose from "mongoose";
import { connectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { Counter, nextSequence } from "../models/Counter.js";
import { Participant } from "../models/Participant.js";
import { Settings } from "../models/Settings.js";

/**
 * DEMO DATA, for previewing the design only.
 *   npm run seed:demo           add clearly labelled demo participants + hero placeholder
 *   npm run seed:demo:remove    remove ONLY the demo records again
 * Refuses to run when NODE_ENV=production.
 * Placeholder images are served by the Next.js client from /demo/*.svg.
 */
if (env.isProd) {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

const base = env.clientOrigins[0] ?? "http://localhost:3000";
const img = (name: string) => ({ url: `${base}/demo/${name}`, publicId: `demo:${name}` });

const people = [
  { name: "Demo Sarah", loc: "Lagos", event: "Street market", quote: "I almost said no. I'm glad I didn't.", bio: "DEMO DATA. A placeholder profile so you can see how a real introduction will read." },
  { name: "Demo Michael", loc: "Lagos", event: "", quote: "", bio: "DEMO DATA. Real stories will replace these once you publish actual participants." },
  { name: "Demo Amara", loc: "Abuja", event: "Tech meetup", quote: "Everyone has a story worth hearing.", bio: "DEMO DATA. Placeholder biography text." },
  { name: "Demo David", loc: "Abuja", event: "", quote: "", bio: "DEMO DATA. Placeholder biography text." },
  { name: "Demo Zainab", loc: "Lagos", event: "Concert", quote: "Introductions are easier than you think.", bio: "DEMO DATA. Placeholder biography text." },
  { name: "Demo Tunde", loc: "Ibadan", event: "", quote: "", bio: "DEMO DATA. Placeholder biography text." },
  { name: "Demo Chioma", loc: "Lagos", event: "Street market", quote: "", bio: "DEMO DATA. Placeholder biography text." },
  { name: "Demo Ife", loc: "Ibadan", event: "Book fair", quote: "I didn't expect to enjoy this.", bio: "DEMO DATA. Placeholder biography text." },
];

async function remove() {
  const res = await Participant.deleteMany({ isDemo: true });
  const remaining = await Participant.countDocuments();
  // With no real participants left, restart numbering so the first real person is #0001.
  if (remaining === 0) await Counter.deleteOne({ _id: "participant" });
  await Settings.updateOne({ key: "main", "heroImage.publicId": "demo:hero.svg" }, { $set: { heroImage: null } });
  console.log(`Removed ${res.deletedCount} demo participants.${remaining === 0 ? " Numbering reset to start at 0001." : ""}`);
}

async function add() {
  if (await Participant.exists({ isDemo: true })) {
    console.log("Demo data already present. Run `npm run seed:demo:remove` first to reseed.");
    return;
  }
  if (await Participant.exists({ isDemo: false })) {
    console.warn("Note: real participants exist. Demo people will take the next numbers; remove them before launch.");
  }
  const now = Date.now();
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    await Participant.create({
      participantNumber: await nextSequence("participant"),
      displayName: p.name,
      biography: p.bio,
      quote: p.quote,
      location: p.loc,
      eventName: p.event,
      dateMet: new Date(now - (people.length - i) * 6 * 24 * 3600 * 1000),
      portrait: img(`portrait-${i + 1}.svg`),
      consentConfirmed: true,
      isPublished: true,
      isDemo: true,
    });
  }
  await Settings.updateOne({ key: "main" }, { $set: { heroImage: img("hero.svg") } }, { upsert: true });
  console.log(`Added ${people.length} DEMO participants and a placeholder hero image.`);
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
