"use client";

// The board's only floating control: Save. The earlier canvas controls
// (Zoom / Fit / Lock / Map / Help) belonged to the free React Flow canvas,
// which has been replaced by a fixed, horizontally-scrolling column board —
// so there's nothing to zoom, pan, fit or lock. Save stays: it exports the
// board as a Picture (PNG), a Full page (PDF) or Data (Excel).

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

type Props = {
  boardId: string;
  boardTitle: string;
  // Id of the element to rasterise for the Picture / Full-page exports —
  // the column row, captured at its full width so every list is in frame.
  captureTargetId: string;
};

type SaveKind = "png" | "pdf" | "xlsx";

export default function SaveToolbar({
  boardId,
  boardTitle,
  captureTargetId,
}: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState<SaveKind | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click-outside to close the Save popover.
  useEffect(() => {
    if (!saveOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setSaveOpen(false);
      }
    };
    window.addEventListener("mousedown", onDocClick);
    return () => window.removeEventListener("mousedown", onDocClick);
  }, [saveOpen]);

  // ─── Save / export ────────────────────────────────────────────────────

  function fileBase(): string {
    const slug =
      (boardTitle || "board")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "board";
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}${String(d.getDate()).padStart(2, "0")}`;
    return `${slug}-${stamp}`;
  }

  function triggerDownload(href: string, filename: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function imageSize(
    dataUrl: string
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () =>
        reject(new Error("Couldn't read the captured image."));
      img.src = dataUrl;
    });
  }

  // Rasterise the column row. The element is `width: max-content` (its parent
  // owns the horizontal scroll), so its own offset size already spans every
  // list — capturing it gives the whole board side-to-side. CardPreview plays
  // a `card-pop` entrance that starts at opacity:0; html-to-image re-triggers
  // CSS animations in its off-screen clone and grabs the first frame, so we
  // freeze animations/transitions for the capture to keep cards fully opaque.
  async function captureBoardPng(): Promise<string> {
    const el = document.getElementById(captureTargetId);
    if (!el) throw new Error("Couldn't find the board to capture.");
    const width = el.scrollWidth;
    const height = el.scrollHeight;
    if (width < 2 || height < 2) {
      throw new Error("This board is empty — add a list or card first.");
    }
    const background =
      getComputedStyle(document.body).getPropertyValue("--color-app-canvas") ||
      "#f5f3ee";
    const freeze = document.createElement("style");
    freeze.textContent = `#${captureTargetId}, #${captureTargetId} *, #${captureTargetId} *::before, #${captureTargetId} *::after { animation: none !important; transition: none !important; }`;
    document.head.appendChild(freeze);
    try {
      return await toPng(el, {
        backgroundColor: background.trim() || "#f5f3ee",
        width,
        height,
        // Very wide boards would blow past canvas limits at 2×; scale the
        // density down once the board gets long.
        pixelRatio: width > 3200 ? 1.5 : 2,
        cacheBust: true,
      });
    } finally {
      freeze.remove();
    }
  }

  async function doSavePng() {
    const dataUrl = await captureBoardPng();
    triggerDownload(dataUrl, `${fileBase()}.png`);
  }

  async function doSavePdf() {
    const dataUrl = await captureBoardPng();
    const dims = await imageSize(dataUrl);
    const landscape = dims.width >= dims.height;
    const pdf = new jsPDF({
      orientation: landscape ? "landscape" : "portrait",
      unit: "pt",
      format: "a4",
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 28;
    const scale = Math.min(
      (pageW - margin * 2) / dims.width,
      (pageH - margin * 2) / dims.height
    );
    const w = dims.width * scale;
    const h = dims.height * scale;
    pdf.addImage(
      dataUrl,
      "PNG",
      (pageW - w) / 2,
      (pageH - h) / 2,
      w,
      h,
      undefined,
      "FAST"
    );
    pdf.save(`${fileBase()}.pdf`);
  }

  async function doSaveXlsx() {
    const res = await fetch(`/api/app/boards/${boardId}/export?format=xlsx`, {
      cache: "no-store",
    });
    if (!res.ok) {
      let msg = "Couldn't generate the Excel export.";
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        /* non-JSON error body — keep the default message */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || `${fileBase()}.xlsx`;
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function handleSave(kind: SaveKind) {
    if (saving) return;
    setSaveError(null);
    setSaving(kind);
    try {
      if (kind === "png") await doSavePng();
      else if (kind === "pdf") await doSavePdf();
      else await doSaveXlsx();
      setSaveOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 sm:left-5 sm:translate-x-0"
    >
      <button
        onClick={() => {
          setSaveOpen((v) => !v);
          setSaveError(null);
        }}
        className="flex items-center gap-2 rounded-full px-4 py-2.5 transition-transform hover:-translate-y-0.5"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          backgroundColor: saveOpen
            ? "var(--color-app-ink)"
            : "rgba(255,255,255,0.95)",
          color: saveOpen ? "var(--color-app-ivory)" : "var(--color-app-ink)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow:
            "0 12px 28px -10px rgba(10,17,36,0.22), 0 0 0 1px rgba(10,17,36,0.06)",
        }}
        title="Save / export the board"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v11m0 0l-4-4m4 4l4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em]">
          Save
        </span>
      </button>

      {saveOpen ? (
        <div
          className="absolute bottom-full left-0 mb-2 overflow-hidden rounded-xl"
          style={{
            backgroundColor: "rgba(255,255,255,0.98)",
            boxShadow:
              "0 18px 36px -12px rgba(10,17,36,0.30), 0 0 0 1px rgba(10,17,36,0.06)",
            minWidth: 256,
          }}
        >
          <div
            className="px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Download board
          </div>
          <SaveOption
            title="Picture"
            sub="PNG image of the board"
            busy={saving === "png"}
            disabled={saving !== null}
            onClick={() => handleSave("png")}
          >
            <path
              d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="9" cy="9" r="1.4" fill="currentColor" />
          </SaveOption>
          <SaveOption
            title="Full page"
            sub="PDF, the whole board in frame"
            busy={saving === "pdf"}
            disabled={saving !== null}
            onClick={() => handleSave("pdf")}
          >
            <path
              d="M7 3h7l4 4v14H7zM14 3v4h4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              fill="none"
            />
          </SaveOption>
          <SaveOption
            title="Data"
            sub="Excel — every card as a row"
            busy={saving === "xlsx"}
            disabled={saving !== null}
            onClick={() => handleSave("xlsx")}
            last
          >
            <path
              d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 12l5 5M14.5 12l-5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          </SaveOption>
          {saveError ? (
            <div
              className="px-3 pb-3 pt-1 text-[11px] leading-snug"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-danger)",
              }}
            >
              {saveError}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SaveOption({
  title,
  sub,
  busy,
  disabled,
  onClick,
  children,
  last,
}: {
  title: string;
  sub: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed"
      style={{
        fontFamily: "var(--font-manrope), sans-serif",
        borderTop: "1px solid var(--color-app-edge-soft)",
        borderBottomLeftRadius: last ? 12 : 0,
        borderBottomRightRadius: last ? 12 : 0,
        opacity: disabled && !busy ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.backgroundColor = "var(--color-app-canvas-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: "var(--color-app-canvas-2)",
          color: "var(--color-app-ink)",
        }}
      >
        {busy ? (
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray="44"
              strokeDashoffset="14"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 12 12"
                to="360 12 12"
                dur="0.7s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            {children}
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span
          className="block text-[13px] font-semibold"
          style={{ color: "var(--color-app-ink)" }}
        >
          {title}
        </span>
        <span
          className="block text-[11px]"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          {sub}
        </span>
      </span>
    </button>
  );
}
