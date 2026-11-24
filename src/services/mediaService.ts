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

export type MediaKind = "image" | "video";
const FOLDERS: Record<MediaKind, string> = { image: "portraits", video: "videos" };
const ROOT = "5000-people";

/**
 * Signed parameters so the BROWSER can upload straight to Cloudinary. Big videos then never pass
 * through Vercel or this server (both have request-size and memory limits). The API secret never
 * leaves the server; only the signature does.
 */
export function signUpload(kind: MediaKind) {
  assertConfigured();
  const params: Record<string, string | number> = {
    folder: `${ROOT}/${FOLDERS[kind]}`,
    timestamp: Math.round(Date.now() / 1000),
  };
  if (kind === "video") {
    // Also prepare a web-safe H.264 MP4 in the background (iPhone HEVC .mov will not play in every browser).
    params.eager = "f_mp4,vc_h264,q_auto";
    params.eager_async = "true";
  }
  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${kind}/upload`,
    apiKey: env.CLOUDINARY_API_KEY,
    params,
    signature,
  };
}

/** An asset the browser says it uploaded must really be ours: right cloud, right folder. */
export function assertOwnAsset(asset: MediaAsset, kind: MediaKind): MediaAsset {
  const okUrl = asset.url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${kind}/upload/`);
  const okId = asset.publicId.startsWith(`${ROOT}/${FOLDERS[kind]}/`);
  if (!env.cloudinaryConfigured || !okUrl || !okId) throw new AppError(400, "Invalid uploaded file reference");
  return { url: asset.url, publicId: asset.publicId };
}

export function isOurPublicId(publicId: string) {
  return publicId.startsWith(`${ROOT}/`);
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
