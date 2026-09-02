"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TUTORIAL_ACCEPT_ATTR,
  MAX_TUTORIAL_LABEL,
  MAX_TUTORIAL_BYTES,
  formatBytes,
  kindForContentType,
  kindForFilename,
  type TutorialKind,
} from "@/lib/tutorial-media";

export type TutorialRow = {
  id: string;
  title: string;
  description: string;
  kind: TutorialKind;
  filename: string;
  contentType: string;
  size: number;
  order: number;
  isActive: boolean;
  uploadedByName: string;
  createdAt: string;
};

const MONO = { fontFamily: "var(--font-plex-mono), monospace" } as const;

export default function TutorialsManager({
  tutorials,
}: {
  tutorials: TutorialRow[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-10">
      <UploadForm onDone={refresh} />
      <TutorialList tutorials={tutorials} onChange={refresh} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Upload                                                              */
/* ------------------------------------------------------------------ */

type UploadResult = {
  ok: boolean;
  status: number;
  data: { error?: string } | null;
};

// XHR upload so we can show real progress for big (up to 200 MB) videos.
function uploadWithProgress(
  form: FormData,
  onProgress: (pct: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/tutorials");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      let data: { error?: string } | null = null;
      try {
        data = JSON.parse(xhr.responseText) as { error?: string };
      } catch {
        data = null;
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        data,
      });
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const detectedKind: TutorialKind | null = file
    ? kindForContentType(file.type) ?? kindForFilename(file.name)
    : null;
  const tooBig = file ? file.size > MAX_TUTORIAL_BYTES : false;

  function reset() {
    setTitle("");
    setDescription("");
    setOrder("0");
    setFile(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (!detectedKind) {
      setError(
        "Unsupported file type. Use a video (mp4, mov, webm, m4v), image (jpg, png, webp, gif) or PDF."
      );
      return;
    }
    if (tooBig) {
      setError(`The file is larger than ${MAX_TUTORIAL_LABEL}.`);
      return;
    }

    const form = new FormData();
    form.append("title", title.trim());
    form.append("description", description.trim());
    form.append("order", String(Number.parseInt(order, 10) || 0));
    form.append("file", file);

    setSubmitting(true);
    setProgress(0);
    try {
      const res = await uploadWithProgress(form, setProgress);
      if (!res.ok) {
        setError(res.data?.error ?? "Upload failed. Try again.");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setSubmitting(false);
      reset();
      onDone();
    } catch {
      setError("Network error during upload.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-admin-border bg-admin-surface p-7"
    >
      <div className="border-b border-admin-border-soft pb-5">
        <h3 className="text-[16px] font-semibold tracking-tight text-admin-fg">
          Upload a tutorial
        </h3>
        <p className="mt-1 text-[13px] text-admin-fg-muted">
          Video, image or PDF up to {MAX_TUTORIAL_LABEL}. It appears in the
          mobile app once active.
        </p>
      </div>

      <div className="mt-5 space-y-5">
        <Field
          id="tut-title"
          label="Title"
          required
          value={title}
          onChange={setTitle}
        />
        <Field
          id="tut-description"
          label="Description"
          value={description}
          onChange={setDescription}
          multiline
          hint="Optional. Shown under the title in the app."
        />

        <div className="grid gap-5 md:grid-cols-[140px_1fr]">
          <Field
            id="tut-order"
            label="Order"
            type="number"
            value={order}
            onChange={setOrder}
            hint="Lower first."
          />

          <div>
            <label
              htmlFor="tut-file"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-admin-fg-muted"
              style={MONO}
            >
              File<span className="ml-1 text-admin-accent">*</span>
            </label>
            <input
              ref={fileInputRef}
              id="tut-file"
              type="file"
              accept={TUTORIAL_ACCEPT_ATTR}
              onChange={(e) => {
                setError(null);
                setSuccess(false);
                setFile(e.target.files?.[0] ?? null);
              }}
              className="mt-2 block w-full cursor-pointer rounded-md border border-admin-border bg-admin-bg px-3.5 py-2.5 text-[13px] text-admin-fg outline-none transition-colors file:mr-3 file:rounded-md file:border-0 file:bg-admin-accent-soft file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-admin-accent hover:border-admin-fg-soft focus:border-admin-accent"
            />
            {file && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-admin-fg-muted">
                {detectedKind ? (
                  <KindBadge kind={detectedKind} />
                ) : (
                  <span
                    className="rounded-sm bg-admin-danger-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-admin-danger"
                    style={MONO}
                  >
                    Unsupported
                  </span>
                )}
                <span className="truncate">{file.name}</span>
                <span
                  className={tooBig ? "text-admin-danger" : "text-admin-fg-soft"}
                  style={MONO}
                >
                  {formatBytes(file.size)}
                </span>
              </div>
            )}
          </div>
        </div>

        {submitting && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-admin-border-soft">
              <div
                className="h-full rounded-full bg-admin-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-admin-fg-soft" style={MONO}>
              Uploading… {progress}%
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-admin-danger/30 bg-admin-danger-soft px-4 py-3">
            <p className="text-[13px] text-admin-danger">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-md border border-admin-accent/30 bg-admin-accent-soft px-4 py-3">
            <p className="text-[13px] text-admin-accent">
              ✓ Uploaded. It&rsquo;s live in the mobile library.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-admin-border-soft pt-6">
        <button
          type="button"
          onClick={reset}
          disabled={submitting}
          className="rounded-md border border-admin-border bg-admin-surface px-5 py-2.5 text-[13px] font-medium text-admin-fg-muted transition-colors hover:border-admin-fg-soft hover:text-admin-fg disabled:opacity-60"
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-admin-accent px-6 py-2.5 text-[13px] font-medium text-white shadow-sm transition-all hover:opacity-90 hover:shadow disabled:opacity-60"
        >
          {submitting ? "Uploading…" : "Upload tutorial"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

function TutorialList({
  tutorials,
  onChange,
}: {
  tutorials: TutorialRow[];
  onChange: () => void;
}) {
  if (tutorials.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-admin-border bg-admin-surface p-16 text-center">
        <h3 className="text-[16px] font-semibold tracking-tight text-admin-fg">
          No tutorials yet
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-admin-fg-muted">
          Upload your first video, image or PDF above — it&rsquo;ll show here
          and in the mobile app.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-admin-fg-soft"
        style={MONO}
      >
        {tutorials.length} tutorial{tutorials.length === 1 ? "" : "s"}
      </div>
      <div className="space-y-3">
        {tutorials.map((t) => (
          <TutorialCard key={t.id} tutorial={t} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}

function TutorialCard({
  tutorial,
  onChange,
}: {
  tutorial: TutorialRow;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(tutorial.title);
  const [description, setDescription] = useState(tutorial.description);
  const [order, setOrder] = useState(String(tutorial.order));

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tutorials/${tutorial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save.");
        setBusy(false);
        return false;
      }
      setBusy(false);
      onChange();
      return true;
    } catch {
      setError("Network error.");
      setBusy(false);
      return false;
    }
  }

  async function onSaveEdit() {
    if (!title.trim()) {
      setError("Title can't be empty.");
      return;
    }
    const ok = await patch({
      title: title.trim(),
      description: description.trim(),
      order: Number.parseInt(order, 10) || 0,
    });
    if (ok) setEditing(false);
  }

  async function onToggleActive() {
    await patch({ isActive: !tutorial.isActive });
  }

  async function onDelete() {
    if (!confirm(`Delete "${tutorial.title}"? It's removed from the app.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tutorials/${tutorial.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Couldn't delete.");
        setBusy(false);
        return;
      }
      setBusy(false);
      onChange();
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-admin-border bg-admin-surface p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={tutorial.kind} />
            {!tutorial.isActive && (
              <span
                className="rounded-sm border border-admin-border bg-admin-bg px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-admin-fg-soft"
                style={MONO}
              >
                Hidden
              </span>
            )}
            <span
              className="rounded-sm border border-admin-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-admin-fg-soft"
              style={MONO}
            >
              #{tutorial.order}
            </span>
          </div>

          {editing ? (
            <div className="mt-4 space-y-4">
              <Field
                id={`edit-title-${tutorial.id}`}
                label="Title"
                required
                value={title}
                onChange={setTitle}
              />
              <Field
                id={`edit-desc-${tutorial.id}`}
                label="Description"
                value={description}
                onChange={setDescription}
                multiline
              />
              <div className="w-[140px]">
                <Field
                  id={`edit-order-${tutorial.id}`}
                  label="Order"
                  type="number"
                  value={order}
                  onChange={setOrder}
                />
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <h4 className="text-[16px] font-semibold tracking-tight text-admin-fg">
                {tutorial.title}
              </h4>
              {tutorial.description && (
                <p className="mt-1 text-[13px] text-admin-fg-muted">
                  {tutorial.description}
                </p>
              )}
              <div
                className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-admin-fg-soft"
                style={MONO}
              >
                <span className="truncate">{tutorial.filename}</span>
                <span>·</span>
                <span>{formatBytes(tutorial.size)}</span>
                <span>·</span>
                <span>{tutorial.contentType}</span>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-[12px] text-admin-danger">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={onSaveEdit}
                disabled={busy}
                className="rounded-md bg-admin-accent px-4 py-2 text-[12px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setTitle(tutorial.title);
                  setDescription(tutorial.description);
                  setOrder(String(tutorial.order));
                }}
                disabled={busy}
                className="rounded-md border border-admin-border px-4 py-2 text-[12px] font-medium text-admin-fg-muted transition-colors hover:text-admin-fg disabled:opacity-60"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <a
                href={`/api/admin/tutorials/${tutorial.id}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-admin-border px-4 py-2 text-[12px] font-medium text-admin-fg-muted transition-colors hover:border-admin-fg-soft hover:text-admin-fg"
              >
                Preview
              </a>
              <button
                type="button"
                onClick={onToggleActive}
                disabled={busy}
                className="rounded-md border border-admin-border px-4 py-2 text-[12px] font-medium text-admin-fg-muted transition-colors hover:border-admin-fg-soft hover:text-admin-fg disabled:opacity-60"
              >
                {tutorial.isActive ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="rounded-md border border-admin-border px-4 py-2 text-[12px] font-medium text-admin-fg-muted transition-colors hover:border-admin-fg-soft hover:text-admin-fg disabled:opacity-60"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="rounded-md border border-admin-danger/30 bg-admin-danger-soft px-4 py-2 text-[12px] font-medium text-admin-danger transition-colors hover:border-admin-danger disabled:opacity-60"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

function KindBadge({ kind }: { kind: TutorialKind }) {
  const styles: Record<TutorialKind, string> = {
    video: "bg-admin-accent-soft text-admin-accent",
    image: "bg-admin-bg text-admin-fg-muted border border-admin-border",
    pdf: "bg-admin-danger-soft text-admin-danger",
  };
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${styles[kind]}`}
      style={MONO}
    >
      {kind}
    </span>
  );
}

function Field({
  id,
  label,
  type = "text",
  required,
  value,
  onChange,
  multiline,
  hint,
}: {
  id: string;
  label: string;
  type?: "text" | "number";
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-[0.14em] text-admin-fg-muted"
        style={MONO}
      >
        {label}
        {required && <span className="ml-1 text-admin-accent">*</span>}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="mt-2 block w-full rounded-md border border-admin-border bg-admin-surface px-3.5 py-2.5 text-[14px] text-admin-fg outline-none transition-colors focus:border-admin-accent focus:ring-2 focus:ring-admin-accent-soft"
        />
      ) : (
        <input
          id={id}
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 block w-full rounded-md border border-admin-border bg-admin-surface px-3.5 py-2.5 text-[14px] text-admin-fg outline-none transition-colors focus:border-admin-accent focus:ring-2 focus:ring-admin-accent-soft"
        />
      )}
      {hint && <p className="mt-1.5 text-[11px] text-admin-fg-soft">{hint}</p>}
    </div>
  );
}
