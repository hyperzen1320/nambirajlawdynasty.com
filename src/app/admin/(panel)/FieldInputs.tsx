"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import Image from "next/image";
import type { Field, ListField, LinesField, ImageField, GroupField } from "@/cms/fields";
import { safeHref, safeImageSrc } from "@/cms/sanitize";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { SupabaseConfig } from "@/lib/supabase/config";
import { emptyObject, getIn, nextKey, type Key, type Obj } from "./[doc]/editor-state";

// The admin's form controls, one per field type in src/cms/fields.ts. Every
// control writes through `update(path, value)` from context, which applies
// the change to the latest form state — so an image upload that finishes after
// further typing never overwrites that typing.

export const MEDIA_BUCKET = "cms-media";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type Updater = unknown | ((prev: unknown) => unknown);

type EditorContextValue = {
  data: Obj;
  update: (path: readonly Key[], next: Updater) => void;
  supabase: SupabaseConfig | null;
  /** Folder in the media bucket for this editor's uploads. */
  uploadFolder: string;
};

export const EditorContext = createContext<EditorContextValue | null>(null);

function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("Field inputs must render inside an EditorContext");
  return ctx;
}

/* ───────────────────────────── styling ───────────────────────────── */

const inputClass =
  "block w-full rounded-lg border bg-white px-3 py-2 text-[14px] leading-6 outline-none transition-shadow border-[var(--color-admin-border)] focus:border-[var(--color-admin-accent)] focus:ring-2 focus:ring-[var(--color-admin-accent-soft)] disabled:bg-[var(--color-admin-bg)]";

const iconButton =
  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border text-[14px] transition-colors border-[var(--color-admin-border)] bg-white hover:bg-[var(--color-admin-bg-sidebar)] disabled:cursor-not-allowed disabled:opacity-40";

const addButton =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-[13px] font-medium transition-colors border-[var(--color-admin-border)] hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]";

const muted = { color: "var(--color-admin-fg-muted)" };
const soft = { color: "var(--color-admin-fg-soft)" };

/* ───────────────────────────── renderers ───────────────────────────── */

export function Fields({ fields, path }: { fields: readonly Field[]; path: readonly Key[] }) {
  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <FieldInput key={field.name} field={field} path={[...path, field.name]} />
      ))}
    </div>
  );
}

function FieldInput({ field, path }: { field: Field; path: readonly Key[] }) {
  switch (field.type) {
    case "group":
      return <GroupInput field={field} path={path} />;
    case "list":
      return <ListInput field={field} path={path} />;
    case "lines":
      return <LinesInput field={field} path={path} />;
    case "image":
      return <ImageInput field={field} path={path} />;
    case "boolean":
      return <BooleanInput field={field} path={path} />;
    default:
      return <ScalarInput field={field} path={path} />;
  }
}

function Label({ htmlFor, field, extra }: { htmlFor?: string; field: Field; extra?: ReactNode }) {
  return (
    <div className="mb-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-medium">
          {field.label}
        </label>
        {extra}
      </div>
      {field.help ? (
        <p className="mt-0.5 text-[12px] leading-5" style={soft}>
          {field.help}
        </p>
      ) : null}
    </div>
  );
}

/* text, textarea, url, select, date */
function ScalarInput({ field, path }: { field: Exclude<Field, GroupField | ListField | LinesField | ImageField | { type: "boolean" }>; path: readonly Key[] }) {
  const { data, update } = useEditor();
  const id = useId();
  const raw = getIn(data, path);
  const value = typeof raw === "string" ? raw : "";
  const set = (v: string) => update(path, v);

  if (field.type === "textarea") {
    return (
      <div>
        <Label
          htmlFor={id}
          field={field}
          extra={
            field.rich ? (
              <span className="text-[11.5px]" style={soft}>
                Blank line = new paragraph · **bold** · *italic*
              </span>
            ) : null
          }
        />
        <textarea
          id={id}
          value={value}
          rows={field.rows ?? 4}
          onChange={(e) => set(e.target.value)}
          className={`${inputClass} resize-y`}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <Label htmlFor={id} field={field} />
        <select id={id} value={value} onChange={(e) => set(e.target.value)} className={`${inputClass} cursor-pointer`}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        <Label htmlFor={id} field={field} />
        <input id={id} type="date" value={value} onChange={(e) => set(e.target.value)} className={`${inputClass} max-w-[220px]`} />
      </div>
    );
  }

  const invalidUrl = field.type === "url" && value.trim() !== "" && !safeHref(value);
  return (
    <div>
      <Label htmlFor={id} field={field} />
      <input
        id={id}
        type="text"
        value={value}
        placeholder={"placeholder" in field ? field.placeholder : undefined}
        onChange={(e) => set(e.target.value)}
        aria-invalid={invalidUrl || undefined}
        className={inputClass}
      />
      {invalidUrl ? (
        <p className="mt-1 text-[12px]" style={{ color: "var(--color-admin-danger)" }}>
          Links must start with /, #, https://, mailto: or tel:
        </p>
      ) : null}
    </div>
  );
}

function BooleanInput({ field, path }: { field: Field; path: readonly Key[] }) {
  const { data, update } = useEditor();
  const id = useId();
  const checked = getIn(data, path) === true;
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => update(path, !checked)}
        className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
        style={{ backgroundColor: checked ? "var(--color-admin-accent)" : "var(--color-admin-border)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]"
          style={{ left: checked ? "22px" : "2px" }}
        />
      </button>
      <div>
        <label htmlFor={id} className="cursor-pointer text-[13.5px] font-medium">
          {field.label}
        </label>
        {field.help ? (
          <p className="text-[12px]" style={soft}>
            {field.help}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function GroupInput({ field, path }: { field: GroupField; path: readonly Key[] }) {
  return (
    <fieldset className="rounded-lg border p-4" style={{ borderColor: "var(--color-admin-border-soft)", backgroundColor: "var(--color-admin-bg)" }}>
      <legend className="px-1 text-[12.5px] font-semibold">{field.label}</legend>
      {field.help ? (
        <p className="-mt-1 mb-3 text-[12px]" style={soft}>
          {field.help}
        </p>
      ) : null}
      <Fields fields={field.fields} path={path} />
    </fieldset>
  );
}

/* ───────────────────────────── lists ───────────────────────────── */

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const copy = items.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function ListInput({ field, path }: { field: ListField; path: readonly Key[] }) {
  const { data, update } = useEditor();
  const raw = getIn(data, path);
  const items = (Array.isArray(raw) ? raw : []) as Obj[];
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const add = () => {
    const key = nextKey();
    update(path, (prev: unknown) => [...(Array.isArray(prev) ? prev : []), { ...emptyObject(field.fields), _key: key }]);
    setOpen((prev) => new Set(prev).add(key));
  };

  const titleOf = (item: Obj) => {
    const titleField = field.fields.find((f) => f.name === field.titleField);
    const value = titleField ? item[titleField.name] : undefined;
    if (titleField?.type === "select") {
      return titleField.options.find((o) => o.value === value)?.label ?? "";
    }
    return typeof value === "string" ? value : "";
  };
  const imageField = field.fields.find((f) => f.type === "image");

  return (
    <div>
      <Label field={field} extra={<span className="text-[12px]" style={soft}>{items.length} {items.length === 1 ? field.itemLabel : `${field.itemLabel}s`}</span>} />
      <div className="space-y-2">
        {items.map((item, index) => {
          const key = item._key ?? String(index);
          const isOpen = open.has(key);
          const thumb = imageField ? safeImageSrc(String(item[imageField.name] ?? "")) : "";
          return (
            <div
              key={key}
              className="rounded-lg border bg-white"
              style={{ borderColor: isOpen ? "var(--color-admin-accent)" : "var(--color-admin-border)" }}
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-left"
                >
                  <span aria-hidden className="w-3 text-[11px] transition-transform" style={{ ...soft, transform: isOpen ? "rotate(90deg)" : "none" }}>
                    ▶
                  </span>
                  {imageField ? (
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded" style={{ backgroundColor: "var(--color-admin-bg-sidebar)" }}>
                      {thumb ? <Image src={thumb} alt="" fill unoptimized sizes="32px" className="object-cover" /> : null}
                    </span>
                  ) : null}
                  <span className="truncate text-[13.5px] font-medium">
                    {titleOf(item) || <span style={soft}>Untitled {field.itemLabel}</span>}
                  </span>
                </button>
                <button type="button" className={iconButton} aria-label="Move up" disabled={index === 0} onClick={() => update(path, (prev: unknown) => move(prev as Obj[], index, index - 1))}>
                  ↑
                </button>
                <button type="button" className={iconButton} aria-label="Move down" disabled={index === items.length - 1} onClick={() => update(path, (prev: unknown) => move(prev as Obj[], index, index + 1))}>
                  ↓
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={`Remove ${field.itemLabel}`}
                  onClick={() => {
                    const name = titleOf(item);
                    if (!window.confirm(`Remove ${name ? `“${name}”` : `this ${field.itemLabel}`}?`)) return;
                    update(path, (prev: unknown) => (prev as Obj[]).filter((_, i) => i !== index));
                  }}
                  style={{ color: "var(--color-admin-danger)" }}
                >
                  ✕
                </button>
              </div>
              {isOpen ? (
                <div className="border-t px-4 pb-4 pt-4" style={{ borderColor: "var(--color-admin-border-soft)" }}>
                  <Fields fields={field.fields} path={[...path, index]} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={add} className={`${addButton} mt-2`}>
        + Add {field.itemLabel}
      </button>
    </div>
  );
}

function LinesInput({ field, path }: { field: LinesField; path: readonly Key[] }) {
  const { data, update } = useEditor();
  const raw = getIn(data, path);
  const lines = (Array.isArray(raw) ? raw : []) as string[];

  return (
    <div>
      <Label field={field} />
      <div className="space-y-2">
        {lines.map((line, index) => {
          const common = {
            value: line,
            "aria-label": `${field.itemLabel} ${index + 1}`,
            onChange: (e: { target: { value: string } }) => update([...path, index], e.target.value),
          };
          return (
            <div key={index} className="flex items-start gap-2">
              {field.multiline ? (
                <textarea {...common} rows={2} className={`${inputClass} resize-y`} />
              ) : (
                <input {...common} type="text" className={inputClass} />
              )}
              <button type="button" className={`${iconButton} mt-1`} aria-label="Move up" disabled={index === 0} onClick={() => update(path, (prev: unknown) => move(prev as string[], index, index - 1))}>
                ↑
              </button>
              <button type="button" className={`${iconButton} mt-1`} aria-label="Move down" disabled={index === lines.length - 1} onClick={() => update(path, (prev: unknown) => move(prev as string[], index, index + 1))}>
                ↓
              </button>
              <button
                type="button"
                className={`${iconButton} mt-1`}
                aria-label={`Remove ${field.itemLabel}`}
                onClick={() => update(path, (prev: unknown) => (prev as string[]).filter((_, i) => i !== index))}
                style={{ color: "var(--color-admin-danger)" }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => update(path, (prev: unknown) => [...(Array.isArray(prev) ? prev : []), ""])} className={`${addButton} mt-2`}>
        + Add {field.itemLabel}
      </button>
    </div>
  );
}

/* ───────────────────────────── images ───────────────────────────── */

function ImageInput({ field, path }: { field: ImageField; path: readonly Key[] }) {
  const { data, update, supabase, uploadFolder } = useEditor();
  const id = useId();
  const raw = getIn(data, path);
  const value = typeof raw === "string" ? raw : "";
  const preview = safeImageSrc(value);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError("");
    if (!supabase) return setError("Uploads need Supabase to be configured.");
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      return setError("Choose a JPEG, PNG, WebP, AVIF or GIF image.");
    }
    if (file.size > MAX_UPLOAD_BYTES) return setError("That image is over 10 MB — please resize it first.");

    setUploading(true);
    try {
      const client = createBrowserSupabase(supabase);
      const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const objectPath = `${uploadFolder}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await client.storage
        .from(MEDIA_BUCKET)
        .upload(objectPath, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = client.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);
      update(path, publicUrl.publicUrl);
    } catch (err) {
      setError(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <Label htmlFor={id} field={field} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--color-admin-border)", backgroundColor: "var(--color-admin-bg-sidebar)" }}
        >
          {preview ? (
            <Image src={preview} alt="" fill unoptimized sizes="96px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[11px]" style={soft}>
              No image
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            id={id}
            type="text"
            value={value}
            onChange={(e) => update(path, e.target.value)}
            placeholder="Upload an image, or paste /path.jpg or https://…"
            className={inputClass}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex cursor-pointer items-center rounded-lg px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-admin-accent-hover)] ${uploading || !supabase ? "pointer-events-none opacity-60" : ""}`}
              style={{ backgroundColor: "var(--color-admin-accent)" }}
            >
              {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                className="sr-only"
                disabled={uploading || !supabase}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file);
                }}
              />
            </label>
            {value ? (
              <button type="button" onClick={() => update(path, "")} className="cursor-pointer rounded-lg px-2 py-1.5 text-[13px] font-medium" style={muted}>
                Remove
              </button>
            ) : null}
          </div>
          {error ? (
            <p className="text-[12px]" style={{ color: "var(--color-admin-danger)" }}>
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
