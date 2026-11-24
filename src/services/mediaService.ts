import { cloudinary } from "../config/cloudinary.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export interface MediaAsset {
  url: string;
  publicId: string;
}

function assertConfigured() {
  if (!env.cloudinaryConfigured) {
    throw new AppError(503, "Media uploads are unavailable: Cloudinary is not configured on the server.");
  }
}

export function uploadBuffer(
  buffer: Buffer,
  opts: { resourceType: "image" | "video"; folder: string },
): Promise<MediaAsset> {
  assertConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: opts.resourceType, folder: `5000-people/${opts.folder}` },
      (err, result) => {
        if (err || !result) {
          console.error("Cloudinary upload failed:", err);
          return reject(new AppError(502, "Media upload failed. Please try again."));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

/** Best-effort delete; a failed cleanup must never break the user's request. */
export async function deleteAsset(asset: MediaAsset | null | undefined, resourceType: "image" | "video") {
  // Demo placeholders (from seed:demo) are local files, not Cloudinary assets.
  if (!asset?.publicId || asset.publicId.startsWith("demo:") || !env.cloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(asset.publicId, { resource_type: resourceType, invalidate: true });
  } catch (err) {
    console.error("Cloudinary delete failed for", asset.publicId, err);
  }
}
