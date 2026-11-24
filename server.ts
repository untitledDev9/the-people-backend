import { createApp } from "./src/app.js";
import { connectDb } from "./src/config/db.js";
import { env } from "./src/config/env.js";

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
    if (!env.cloudinaryConfigured) {
      console.warn("Cloudinary is NOT configured: uploads will return 503 until credentials are set.");
    }
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
