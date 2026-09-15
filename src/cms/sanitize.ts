import type { Field } from "./fields";
import { DOCUMENTS, type DocumentData, type DocumentId } from "./documents";

// Coerces untrusted data — a database row, or a payload posted from the admin —
// into exactly the shape a document's fields describe. Anything missing or of
// the wrong type falls back to the default (so a field added to the schema
// later simply shows its default until someone edits it), unknown keys are
// dropped, and links are restricted to safe schemes before they can reach an
// href or an <img src>.

const MAX_TEXT = 20_000;
const MAX_ITEMS = 200;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function cleanText(value: string, multiline: boolean): string {
  let s = value.replace(/\r\n?/g, "\n").slice(0, MAX_TEXT);
  if (!multiline) s = s.replace(/\n+/g, " ");
  return s;
}

/** Links: site paths, anchors, web, mail and phone. Bare domains get https://. */
export function safeHref(value: string): string {
  const s = value.trim();
  if (!s) return "";
  if (s.startsWith("#")) return s;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(s)) return `https://${s}`;
  return "";
}

/** A real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** Images: files under /public, or an https URL (e.g. Supabase Storage). */
export function safeImageSrc(value: string): string {
  const s = value.trim();
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^https:\/\//i.test(s)) return s;
  return "";
}

function sanitizeField(field: Field, raw: unknown, fallback: unknown): unknown {
  switch (field.type) {
    case "text":
    case "textarea": {
      const multiline = field.type === "textarea";
      if (typeof raw === "string") return cleanText(raw, multiline);
      return typeof fallback === "string" ? fallback : "";
    }
    case "url": {
      if (typeof raw === "string") return safeHref(raw);
      return typeof fallback === "string" ? fallback : "";
    }
    case "image": {
      if (typeof raw === "string") return safeImageSrc(raw);
      return typeof fallback === "string" ? fallback : "";
    }
    case "select": {
      const allowed = field.options.map((o) => o.value);
      if (typeof raw === "string" && allowed.includes(raw)) return raw;
      if (typeof fallback === "string" && allowed.includes(fallback)) return fallback;
      return allowed[0] ?? "";
    }
    case "boolean": {
      if (typeof raw === "boolean") return raw;
      return typeof fallback === "boolean" ? fallback : false;
    }
    case "date": {
      if (typeof raw === "string" && isIsoDate(raw.trim())) return raw.trim();
      if (typeof raw === "string" && !raw.trim()) return "";
      return typeof fallback === "string" ? fallback : "";
    }
    case "lines": {
      if (!Array.isArray(raw)) return Array.isArray(fallback) ? fallback : [];
      return raw
        .filter((v): v is string => typeof v === "string")
        .map((v) => cleanText(v, Boolean(field.multiline)).trim())
        .filter(Boolean)
        .slice(0, MAX_ITEMS);
    }
    case "list": {
      if (!Array.isArray(raw)) return Array.isArray(fallback) ? fallback : [];
      return raw
        .filter(isObj)
        .slice(0, MAX_ITEMS)
        .map((item) => sanitizeFields(field.fields, item, undefined));
    }
    case "group":
      return sanitizeFields(field.fields, raw, fallback);
  }
}

export function sanitizeFields(
  fields: readonly Field[],
  raw: unknown,
  fallback: unknown
): Obj {
  const source = isObj(raw) ? raw : {};
  const defaults = isObj(fallback) ? fallback : {};
  const out: Obj = {};
  for (const field of fields) {
    // A key that is absent keeps the default; a key that is present — even
    // as an empty string or list — is the editor's deliberate choice.
    const present = Object.prototype.hasOwnProperty.call(source, field.name);
    out[field.name] = sanitizeField(
      field,
      present ? source[field.name] : undefined,
      defaults[field.name]
    );
  }
  return out;
}

export function sanitizeDocument<K extends DocumentId>(
  id: K,
  raw: unknown
): DocumentData<K> {
  const def = DOCUMENTS[id];
  return sanitizeFields(def.fields, raw, def.defaults) as DocumentData<K>;
}
