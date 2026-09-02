"use client";

import { useRef, useState } from "react";
import {
  kindForFilename,
  formatBytes,
  DOC_ACCEPT_ATTR,
  MAX_DOC_BYTES,
  MAX_DOC_LABEL,
  type DocKind,
} from "@/lib/case-docs";
import DocViewerModal, { type ViewerDoc } from "./DocViewerModal";

export type ClientDoc = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedByName: string;
  uploadedByUserId: string | null;
  createdAt: string;
};

const UPLOAD_BATCH = 12;

export default function ClientDocsPanel({
  caseId,
  initialDocs,
  isAdmin,
  viewerLabel,
}: {
  caseId: string;
  initialDocs: ClientDoc[];
  isAdmin: boolean;
  // Name + email of the person viewing — stamped into the viewer watermark.
  viewerLabel: string;
}) {
  const [docs, setDocs] = useState<ClientDoc[]>(initialDocs);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ClientDoc | null>(null);
  // Collapse the list when it's long so the panel doesn't run away.
  const [listOpen, setListOpen] = useState(initialDocs.length <= 5);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(fileList: FileList | File[]) {
    setError(null);
    const all = Array.from(fileList);
    if (all.length === 0) return;

    const valid: File[] = [];
    const localErrors: string[] = [];
    for (const f of all) {
      if (!kindForFilename(f.name)) {
        localErrors.push(`${f.name}: unsupported type.`);
      } else if (f.size > MAX_DOC_BYTES) {
        localErrors.push(`${f.name}: larger than ${MAX_DOC_LABEL}.`);
      } else if (f.size === 0) {
        localErrors.push(`${f.name}: the file is empty.`);
      } else {
        valid.push(f);
      }
    }

    const collectedErrors = [...localErrors];
    if (valid.length > 0) {
      setUploading(true);
      try {
        for (let i = 0; i < valid.length; i += UPLOAD_BATCH) {
          const batch = valid.slice(i, i + UPLOAD_BATCH);
          const fd = new FormData();
          batch.forEach((f) => fd.append("files", f));
          const res = await fetch(`/api/app/cases/${caseId}/documents`, {
            method: "POST",
            body: fd,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            collectedErrors.push(data?.error || "Upload failed.");
            break;
          }
          if (Array.isArray(data.documents)) {
            setDocs((prev) => [...data.documents, ...prev]);
            setListOpen(true);
          }
          if (Array.isArray(data.errors)) {
            collectedErrors.push(...data.errors);
          }
        }
      } catch {
        collectedErrors.push("Network error during upload.");
      } finally {
        setUploading(false);
      }
    }

    if (collectedErrors.length > 0) setError(collectedErrors.join(" "));
    if (inputRef.current) inputRef.current.value = "";
  }

  // Delete is office-admin only (button is hidden for everyone else).
  async function onDelete(doc: ClientDoc) {
    if (!isAdmin) return;
    setError(null);
    if (!window.confirm(`Delete "${doc.filename}"? This removes it from the case.`)) {
      return;
    }
    setDeletingId(doc.id);
    try {
      const res = await fetch(`/api/app/cases/${caseId}/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Couldn't delete that document.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      className="flex flex-col rounded-xl p-6"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-copper-deep)",
            }}
          >
            Client docs
          </div>
          <p
            className="mt-1 text-[12px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            {docs.length === 0
              ? "No documents yet."
              : `${docs.length} ${docs.length === 1 ? "file" : "files"} on record`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-[12px] font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
            boxShadow: "0 8px 20px -10px rgba(172,123,51,0.6)",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? <Spinner /> : <UploadIcon />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DOC_ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
          }}
        />
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="mt-4 cursor-pointer rounded-lg px-4 py-5 text-center transition-colors"
        style={{
          border: `1.5px dashed ${dragOver ? "var(--color-app-copper)" : "var(--color-app-edge)"}`,
          backgroundColor: dragOver ? "var(--color-app-canvas-2)" : "transparent",
        }}
      >
        <p
          className="text-[12.5px]"
          style={{ fontFamily: "var(--font-manrope), sans-serif", color: "var(--color-app-fg-soft)" }}
        >
          <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>Drag files here</span> or click to browse
        </p>
        <p
          className="mt-1 text-[10.5px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-dm-mono), monospace", color: "var(--color-app-fg-muted)" }}
        >
          PDF · Word · Images · up to {MAX_DOC_LABEL}
        </p>
      </div>

      {error ? (
        <div
          className="mt-3 rounded-md px-3 py-2 text-[12px] leading-snug"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-danger-soft)",
            border: "1px solid var(--color-app-danger)",
            color: "var(--color-app-ink)",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* List — collapsible dropdown so a long roll of docs stays tidy */}
      {docs.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              backgroundColor: "var(--color-app-canvas-2)",
              color: "var(--color-app-ink)",
            }}
          >
            <span className="text-[12px] font-semibold">
              {listOpen ? "Hide" : "Show"} files
              <span style={{ color: "var(--color-app-fg-muted)" }}> ({docs.length})</span>
            </span>
            <Chevron open={listOpen} />
          </button>
          {listOpen ? (
            <ul className="mt-2 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {docs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  isAdmin={isAdmin}
                  caseId={caseId}
                  deleting={deletingId === doc.id}
                  onView={() => setViewing(doc)}
                  onDelete={() => onDelete(doc)}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {viewing ? (
        <DocViewerModal
          caseId={caseId}
          doc={viewing as ViewerDoc}
          isAdmin={isAdmin}
          viewerLabel={viewerLabel}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </div>
  );
}

function DocRow({
  doc,
  isAdmin,
  caseId,
  deleting,
  onView,
  onDelete,
}: {
  doc: ClientDoc;
  isAdmin: boolean;
  caseId: string;
  deleting: boolean;
  onView: () => void;
  onDelete: () => void;
}) {
  const kind = kindForFilename(doc.filename) || "pdf";
  const date = new Date(doc.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <li
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
      style={{
        backgroundColor: "var(--color-app-canvas-2)",
        border: "1px solid var(--color-app-edge-soft)",
      }}
    >
      <DocIcon kind={kind} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onView}
          className="block max-w-full truncate text-left text-[13px] font-semibold transition-colors hover:underline"
          style={{ fontFamily: "var(--font-manrope), sans-serif", color: "var(--color-app-ink)" }}
          title={doc.filename}
        >
          {doc.filename}
        </button>
        <div
          className="mt-0.5 truncate text-[11px]"
          style={{ fontFamily: "var(--font-dm-mono), monospace", color: "var(--color-app-fg-muted)" }}
        >
          {formatBytes(doc.size)} · {date}
          {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ""}
        </div>
      </div>

      {/* Actions — View for everyone; Download + Delete admin-only */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onView}
          aria-label="View"
          title="View"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          style={{ color: "var(--color-app-fg-soft)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-app-paper)";
            e.currentTarget.style.color = "var(--color-app-ink)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--color-app-fg-soft)";
          }}
        >
          <EyeIcon />
        </button>
        {isAdmin ? (
          <>
            <a
              href={`/api/app/cases/${caseId}/documents/${doc.id}?download=1`}
              aria-label="Download"
              title="Download"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
              style={{ color: "var(--color-app-fg-soft)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-app-paper)";
                e.currentTarget.style.color = "var(--color-app-ink)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--color-app-fg-soft)";
              }}
            >
              <DownloadIcon />
            </a>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              aria-label="Delete document"
              title="Delete document"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-50"
              style={{ color: "var(--color-app-danger)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-app-danger-soft)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {deleting ? <Spinner danger /> : <TrashIcon />}
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function DocIcon({ kind }: { kind: DocKind }) {
  const palette: Record<DocKind, { bg: string; fg: string; label: string }> = {
    pdf: { bg: "#9a2c2c", fg: "#ffffff", label: "PDF" },
    word: { bg: "#2b5797", fg: "#ffffff", label: "DOC" },
    image: { bg: "#1f6f43", fg: "#ffffff", label: "IMG" },
  };
  const p = palette[kind];
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[9px] font-semibold uppercase tracking-[0.12em]"
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        backgroundColor: p.bg,
        color: p.fg,
      }}
    >
      {p.label}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V5m0 0L8 9m4-4l4 4M5 18v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner({ danger }: { danger?: boolean }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full"
      style={{
        borderWidth: 1.5,
        borderStyle: "solid",
        borderColor: danger ? "rgba(154,44,44,0.25)" : "rgba(31,19,8,0.25)",
        borderTopColor: danger ? "var(--color-app-danger)" : "var(--color-app-copper-text)",
      }}
    />
  );
}
