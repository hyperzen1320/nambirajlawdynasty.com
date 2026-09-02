"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// WhatsApp-style image viewer. A full-screen dark overlay with the image
// centred — opens in-app instead of redirecting to the raw file. Close on
// Esc, click-out or ✕.
//
// Share and Download are office-admin only: taking a shared file OUT of
// chambers is the admin's call. Everyone else can look at it here for as
// long as they like. The API returns 403 on ?download=1 for non-admins, so
// hiding the buttons is the courtesy, not the control.
export default function ImageLightbox({
  src,
  filename,
  canDownload = true,
  onClose,
}: {
  src: string;
  filename: string;
  canDownload?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Share the actual image file via the Web Share API (mobile browsers + some
  // desktops). Falls back to a download if sharing is unsupported or dismissed.
  async function share() {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const file = new File([blob], filename, {
        type: blob.type || "image/jpeg",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: filename });
        return;
      }
    } catch {
      // Dismissed or unsupported — fall through to a download.
    }
    const a = document.createElement("a");
    a.href = `${src}?download=1`;
    a.download = filename;
    a.click();
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex flex-col"
      style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="min-w-0 flex-1 truncate text-[13px]"
          style={{ fontFamily: "var(--font-manrope), sans-serif", color: "rgba(255,255,255,0.85)" }}
          title={filename}
        >
          {filename}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {canDownload ? (
          <>
          <button
            type="button"
            onClick={share}
            aria-label="Share"
            title="Share"
            className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-white/10"
            style={{ color: "#ffffff" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </button>
          <a
            href={`${src}?download=1`}
            download={filename}
            aria-label="Download"
            title="Download"
            className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-white/10"
            style={{ color: "#ffffff" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          </>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-white/10"
            style={{ color: "#ffffff" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={filename}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md"
          style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
        />
      </div>
    </div>,
    document.body
  );
}
