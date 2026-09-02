"use client";

import { useEffect, useRef, useState } from "react";

// In-app document viewer. Used for EVERY "View" so the raw file is never
// handed to the browser's own viewer (which carries a download/print
// button). Images render as <img>; PDFs render to <canvas> via pdf.js;
// Word/other can't be previewed in-browser. A tiled watermark (the viewer's
// name + email + time) sits over the content so any screenshot is traceable,
// and several deterrents (no right-click, no print, blur-on-tab-switch)
// discourage casual capture. None of this is true DRM — a browser cannot
// block OS screenshots — but it makes leaks deliberate and attributable.

type Kind = "image" | "pdf" | "other";

export type ViewerDoc = {
  id: string;
  filename: string;
  contentType: string;
};

export default function DocViewerModal({
  caseId,
  doc,
  isAdmin,
  viewerLabel,
  onClose,
}: {
  caseId: string;
  doc: ViewerDoc;
  isAdmin: boolean;
  viewerLabel: string;
  onClose: () => void;
}) {
  const kind = kindOf(doc.contentType, doc.filename);
  const inlineUrl = `/api/app/cases/${caseId}/documents/${doc.id}`;
  const [obscured, setObscured] = useState(false);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Snapchat-style deterrent: blur the content the moment the tab is hidden
  // or the window loses focus (the usual prelude to a screenshot tool).
  useEffect(() => {
    const hide = () => setObscured(true);
    const showIfVisible = () => {
      if (document.visibilityState === "visible") setObscured(false);
    };
    const onVis = () =>
      document.visibilityState === "hidden" ? setObscured(true) : setObscured(false);
    window.addEventListener("blur", hide);
    window.addEventListener("focus", showIfVisible);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", showIfVisible);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const watermark = watermarkBg(viewerLabel);

  return (
    <div
      className="doc-viewer-root fixed inset-0 z-[90] flex flex-col"
      style={{ backgroundColor: "rgba(10,17,36,0.86)", userSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Block printing of this overlay entirely. */}
      <style>{`@media print { .doc-viewer-root { display: none !important; } }`}</style>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <div className="min-w-0">
          <div
            className="truncate text-[14px] font-semibold"
            style={{ fontFamily: "var(--font-manrope), sans-serif", color: "var(--color-app-ivory)" }}
            title={doc.filename}
          >
            {doc.filename}
          </div>
          <div
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{ fontFamily: "var(--font-dm-mono), monospace", color: "rgba(245,235,214,0.6)" }}
          >
            Protected view · {viewerLabel}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin ? (
            <a
              href={`${inlineUrl}?download=1`}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-copper)",
                color: "var(--color-app-copper-text)",
              }}
            >
              Download
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-md"
            style={{ color: "var(--color-app-ivory)", backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative min-h-0 flex-1 overflow-auto p-4">
        <div className="relative mx-auto w-fit min-w-full">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={inlineUrl}
              alt={doc.filename}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className="mx-auto block max-w-full rounded-md"
              style={{ pointerEvents: "none" }}
            />
          ) : kind === "pdf" ? (
            <PdfCanvas url={inlineUrl} />
          ) : (
            <NoPreview isAdmin={isAdmin} />
          )}

          {/* Tiled, traceable watermark over the content (kind !== other). */}
          {kind !== "other" ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: watermark, backgroundRepeat: "repeat" }}
            />
          ) : null}
        </div>
      </div>

      {/* Blur shield when the window is backgrounded. */}
      {obscured ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            backgroundColor: "rgba(10,17,36,0.55)",
          }}
        >
          <span
            className="text-[13px] uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-dm-mono), monospace", color: "var(--color-app-ivory)" }}
          >
            Hidden while you&rsquo;re away
          </span>
        </div>
      ) : null}
    </div>
  );
}

function PdfCanvas({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let doc: { destroy: () => void } | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Worker is emitted as a bundled asset by the build.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const task = pdfjs.getDocument({ url });
        const pdf = await task.promise;
        doc = pdf as unknown as { destroy: () => void };
        if (cancelled) return;
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";
        const width = Math.min(container.clientWidth || 800, 1000);

        for (let p = 1; p <= pdf.numPages; p++) {
          if (cancelled) return;
          const page = await pdf.getPage(p);
          const unscaled = page.getViewport({ scale: 1 });
          const scale = width / unscaled.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 12px";
          canvas.style.borderRadius = "6px";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        }
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Couldn't render this PDF.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        doc?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, [url]);

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      {loading ? (
        <p
          className="py-10 text-center text-[13px]"
          style={{ fontFamily: "var(--font-manrope), sans-serif", color: "rgba(245,235,214,0.7)" }}
        >
          Loading document…
        </p>
      ) : null}
      {error ? (
        <p
          className="py-10 text-center text-[13px]"
          style={{ fontFamily: "var(--font-manrope), sans-serif", color: "var(--color-app-ivory)" }}
        >
          {error}
        </p>
      ) : null}
      <div ref={containerRef} />
    </div>
  );
}

function NoPreview({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div
      className="mx-auto max-w-md rounded-xl px-6 py-16 text-center"
      style={{ backgroundColor: "var(--color-app-paper)" }}
    >
      <p
        className="text-[15px] font-semibold"
        style={{ fontFamily: "var(--font-crimson), Georgia, serif", color: "var(--color-app-ink)" }}
      >
        Preview not available
      </p>
      <p
        className="mt-2 text-[13px]"
        style={{ fontFamily: "var(--font-manrope), sans-serif", color: "var(--color-app-fg-muted)" }}
      >
        Word files can&rsquo;t be previewed in the browser.{" "}
        {isAdmin
          ? "Use Download to open it."
          : "Ask the office admin if you need this file."}
      </p>
    </div>
  );
}

function kindOf(contentType: string, filename: string): Kind {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) return "pdf";
  if (/\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/i.test(filename)) return "image";
  return "other";
}

// A repeating diagonal SVG watermark carrying the viewer's identity + time.
function watermarkBg(label: string): string {
  const stamp = `${label}`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='340' height='200'><text x='12' y='110' transform='rotate(-24 170 100)' fill='rgba(10,17,36,0.13)' font-family='monospace' font-size='13'>${escapeXml(
    stamp
  )}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
