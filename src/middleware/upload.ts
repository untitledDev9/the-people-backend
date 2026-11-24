import multer from "multer";
import { AppError } from "../utils/AppError.js";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024; // 80 MB

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 2 },
  fileFilter: (_req, file, cb) => {
    const isVideoField = file.fieldname === "video";
    const allowed = isVideoField ? VIDEO_TYPES : IMAGE_TYPES;
    if (!allowed.includes(file.mimetype)) {
      return cb(
        new AppError(
          400,
          isVideoField ? "Video must be MP4, WebM or MOV" : "Image must be JPEG, PNG or WebP",
        ),
      );
    }
    cb(null, true);
  },
});

export const participantUpload = upload.fields([
  { name: "portrait", maxCount: 1 },
  { name: "video", maxCount: 1 },
]);

export const settingsUpload = upload.fields([{ name: "heroImage", maxCount: 1 }]);

export function assertImageSize(file: Express.Multer.File) {
  if (file.size > MAX_IMAGE_BYTES) throw new AppError(400, "Images must be 10 MB or smaller");
}
