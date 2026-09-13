// Field definitions for CMS documents — the single source of truth for what an
// editor can change. The same definition drives three things:
//   1. the TypeScript type of the document (via InferFields below),
//   2. the admin form (src/app/admin/(panel)/[doc]/Editor.tsx renders it),
//   3. validation of whatever arrives from the database or the admin
//      (src/cms/sanitize.ts coerces data to this shape).
//
// This module is types only, so the seed script can import document
// definitions under Node's type stripping without resolving anything else.

type Base = {
  name: string;
  label: string;
  /** Short hint shown under the input in the admin. */
  help?: string;
};

export type TextField = Base & {
  type: "text";
  placeholder?: string;
};

export type TextareaField = Base & {
  type: "textarea";
  rows?: number;
  /**
   * Rich copy: a blank line starts a new paragraph, **bold** and *italic*
   * are honoured. Without it, single line breaks are kept as-is.
   */
  rich?: boolean;
};

/** A link target: /path, #anchor, https://…, mailto: or tel:. */
export type UrlField = Base & {
  type: "url";
  placeholder?: string;
};

/** A picture — a path under /public or a Supabase Storage URL. */
export type ImageField = Base & {
  type: "image";
};

export type SelectField = Base & {
  type: "select";
  options: readonly { value: string; label: string }[];
};

export type BooleanField = Base & {
  type: "boolean";
};

/** A calendar date, stored as YYYY-MM-DD. */
export type DateField = Base & {
  type: "date";
};

/** An ordered list of plain strings (bullets, tags, dropdown options). */
export type LinesField = Base & {
  type: "lines";
  /** What one entry is called in the admin, e.g. "bullet". */
  itemLabel: string;
  multiline?: boolean;
};

/** An ordered list of structured items (team members, service cards…). */
export type ListField = Base & {
  type: "list";
  itemLabel: string;
  /** Which sub-field titles each collapsed item in the admin. */
  titleField?: string;
  fields: readonly Field[];
};

/** A named cluster of fields, shown as one panel in the admin. */
export type GroupField = Base & {
  type: "group";
  fields: readonly Field[];
};

export type Field =
  | TextField
  | TextareaField
  | UrlField
  | ImageField
  | SelectField
  | BooleanField
  | DateField
  | LinesField
  | ListField
  | GroupField;

type FieldValue<F> = F extends { type: "boolean" }
  ? boolean
  : F extends { type: "lines" }
    ? string[]
    : F extends { type: "list"; fields: infer S extends readonly Field[] }
      ? InferFields<S>[]
      : F extends { type: "group"; fields: infer S extends readonly Field[] }
        ? InferFields<S>
        : string;

/** The data shape described by a list of fields. */
export type InferFields<S extends readonly Field[]> = {
  -readonly [K in S[number] as K["name"]]: FieldValue<K>;
};
