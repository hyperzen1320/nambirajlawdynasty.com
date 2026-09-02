// Client-safe shared constants + helpers for case documents. No server
// imports here so both the upload UI and the upload route can validate
// against the exact same rules (allowed kinds, size cap) without dragging
// mongoose/GridFS into the browser bundle.

// 25 MB per file — comfortably covers scanned orders, multi-page PDFs and
// phone photos while keeping a single upload from blowing out memory.
export const MAX_DOC_BYTES = 25 * 1024 * 1024;
export const MAX_DOC_LABEL = "25 MB";

export type DocKind = "pdf" | "word" | "image";

// We classify by extension — it's what users recognise and what survives
// the browser sending a vague "application/octet-stream" for a .docx.
const EXT_KIND: Record<string, DocKind> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  bmp: "image",
  heic: "image",
  heif: "image",
};

// The `accept` attribute for the file picker — extensions plus the broad
// MIME families so mobile "take a photo" flows work too.
export const DOC_ACCEPT_ATTR =
  ".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.bmp,.heic,.heif," +
  "application/pdf," +
  "application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "image/*";

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

// Returns the kind for a filename, or null if we don't accept it.
export function kindForFilename(filename: string): DocKind | null {
  return EXT_KIND[extensionOf(filename)] ?? null;
}

// Reasonable content-type to store/serve, preferring the browser-reported
// type but falling back to one derived from the extension so downloads
// open in the right app even when the upload arrived as octet-stream.
const KIND_FALLBACK_MIME: Record<DocKind, string> = {
  pdf: "application/pdf",
  word: "application/msword",
  image: "application/octet-stream",
};
const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  heic: "image/heic",
  heif: "image/heif",
};

export function resolveContentType(
  filename: string,
  reported: string | null | undefined
): string {
  const ext = extensionOf(filename);
  if (EXT_MIME[ext]) return EXT_MIME[ext];
  if (reported && reported !== "application/octet-stream") return reported;
  const kind = kindForFilename(filename);
  return kind ? KIND_FALLBACK_MIME[kind] : "application/octet-stream";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
