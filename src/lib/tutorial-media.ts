// Client-safe shared constants + helpers for tutorial media. No server
// imports here so both the admin upload UI and the upload route can validate
// against the exact same rules (allowed kinds, size cap) without dragging
// mongoose/GridFS into the browser bundle. Kept separate from case-docs.ts —
// tutorials allow VIDEO and a much larger size cap.

// 200 MB per file — tutorial videos are the fat case; images/PDFs sit well
// under this. Enforced against File.size before any bytes are streamed.
export const MAX_TUTORIAL_BYTES = 200 * 1024 * 1024;
export const MAX_TUTORIAL_LABEL = "200 MB";

export type TutorialKind = "video" | "image" | "pdf";

// Content-type → kind. This is the authoritative classifier the upload route
// uses. Values are the MIME strings browsers / mobile clients realistically
// send for the accepted extensions.
const MIME_KIND: Record<string, TutorialKind> = {
  // video
  "video/mp4": "video",
  "video/quicktime": "video", // .mov
  "video/webm": "video",
  "video/x-m4v": "video", // .m4v
  "video/m4v": "video",
  // image
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  // pdf
  "application/pdf": "pdf",
};

// The accepted-MIME set (derived from the classifier so the two never drift).
export const ACCEPTED_TUTORIAL_MIME: ReadonlySet<string> = new Set(
  Object.keys(MIME_KIND)
);

// Normalise a reported content type: lowercase, trimmed, with any parameters
// (e.g. "; codecs=avc1") stripped so "video/mp4; codecs=…" still classifies.
function normaliseContentType(ct: string): string {
  return ct.split(";")[0]?.trim().toLowerCase() ?? "";
}

// Returns the kind for a content type, or null if we don't accept it.
export function kindForContentType(ct: string): TutorialKind | null {
  if (!ct) return null;
  return MIME_KIND[normaliseContentType(ct)] ?? null;
}

// Extension-based fallback. Browsers / RN file pickers sometimes report a
// vague "application/octet-stream" for videos, so we classify by extension
// too and only reject when BOTH signals fail.
const EXT_KIND: Record<string, TutorialKind> = {
  mp4: "video",
  mov: "video",
  webm: "video",
  m4v: "video",
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  gif: "image",
  pdf: "pdf",
};

const EXT_MIME: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  // m4v is an MP4 container; serve it as video/mp4 so every player accepts it.
  m4v: "video/mp4",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

export function kindForFilename(filename: string): TutorialKind | null {
  return EXT_KIND[extensionOf(filename)] ?? null;
}

// Best content type to store/serve: prefer a canonical type derived from the
// extension, fall back to the browser-reported type, then octet-stream. The
// stored type is what the mobile stream serves as `Content-Type`.
export function resolveTutorialContentType(
  filename: string,
  reported: string | null | undefined
): string {
  const ext = extensionOf(filename);
  if (EXT_MIME[ext]) return EXT_MIME[ext];
  const norm = reported ? normaliseContentType(reported) : "";
  if (norm && norm !== "application/octet-stream") return norm;
  return "application/octet-stream";
}

// The `accept` attribute for the admin file picker.
export const TUTORIAL_ACCEPT_ATTR =
  ".mp4,.mov,.webm,.m4v,.jpg,.jpeg,.png,.webp,.gif,.pdf," +
  "video/mp4,video/quicktime,video/webm,video/x-m4v," +
  "image/jpeg,image/png,image/webp,image/gif," +
  "application/pdf";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
