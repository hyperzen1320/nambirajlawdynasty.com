"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { DocumentData } from "@/cms/documents";

// Bar Council of India gate. Indian advocates may not solicit work or
// advertise, so the site opens behind a confirmation that the visitor came
// here of their own accord. Accepting is remembered forever on the device;
// declining sends the visitor off the site entirely. All wording comes from
// the "Disclaimer popup" document in the CMS.
//
// The overlay is deliberately rendered in the server HTML (initial state is
// "open") so it paints with the first frame — no flash of the site beneath
// it. The inverse flash, a returning visitor glimpsing the gate before the
// effect below clears it, is handled by the blocking script in the root
// layout: it stamps html[data-disclaimer-ack] before paint, and globals.css
// hides the overlay on that attribute.
export const ACK_KEY = "nld:disclaimer-accepted";
const FALLBACK_DECLINE_URL = "https://www.google.com";

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

// localStorage as an external store. The server snapshot is "not accepted",
// so the gate ships in the server HTML; React swaps in the real value right
// after hydration. Reading it this way (rather than setState in an effect)
// keeps hydration honest and picks up a decision made in another tab.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function hasAccepted() {
  try {
    return window.localStorage.getItem(ACK_KEY) === "1";
  } catch {
    // Private mode or blocked storage — show the gate rather than assume.
    return false;
  }
}

export default function DisclaimerGate({ content }: { content: DocumentData<"disclaimer"> }) {
  const accepted = useSyncExternalStore(subscribe, hasAccepted, () => false);
  const [dismissed, setDismissed] = useState(false);
  const open = content.enabled && !accepted && !dismissed;

  // Hold the page still underneath while the gate is up.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const accept = () => {
    try {
      window.localStorage.setItem(ACK_KEY, "1");
    } catch {
      // Storage unavailable — let them in for this visit anyway.
    }
    document.documentElement.setAttribute("data-disclaimer-ack", "1");
    setDismissed(true);
  };

  const decline = () => {
    window.location.replace(content.declineUrl || FALLBACK_DECLINE_URL);
  };

  const body = "text-[13.5px] leading-[1.75]";

  return (
    <div
      data-disclaimer-overlay=""
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: "oklch(21% 0.04 265 / 0.72)" }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-sm border shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]"
        style={{
          backgroundColor: "var(--color-heritage-paper)",
          borderColor: "var(--color-heritage-border)",
          fontFamily: inter,
          color: "var(--color-heritage-navy)",
        }}
      >
        {/* Gold rule across the head, matching the site's heritage trim */}
        <div
          className="h-[3px] w-full shrink-0"
          style={{ backgroundColor: "var(--color-heritage-gold)" }}
        />

        <div className="overflow-y-auto px-6 py-7 sm:px-9 sm:py-8">
          <h2
            id="disclaimer-title"
            className="text-[20px] font-bold tracking-[0.18em] sm:text-[22px]"
            style={{ fontFamily: playfair }}
          >
            {content.title}
          </h2>

          {content.intro ? <p className={`mt-4 ${body}`}>{content.intro}</p> : null}
          <Bullets items={content.bullets} className={body} />
          {content.closing ? <p className={`mt-4 ${body}`}>{content.closing}</p> : null}

          {content.heading2 ? (
            <>
              <h3
                className="mt-8 text-[17px] font-bold tracking-[0.06em] sm:text-[18px]"
                style={{ fontFamily: playfair }}
              >
                {content.heading2}
              </h3>
              <hr
                className="mt-3 border-0 border-t"
                style={{ borderColor: "var(--color-heritage-border)" }}
              />
            </>
          ) : null}

          {content.intro2 ? <p className={`mt-4 ${body}`}>{content.intro2}</p> : null}
          <Bullets items={content.bullets2} className={body} />
          {content.closing2 ? <p className={`mt-4 ${body}`}>{content.closing2}</p> : null}

          {content.cookieNote ? (
            <p
              className="mt-4 text-[12.5px] leading-[1.7]"
              style={{ color: "var(--color-heritage-muted)" }}
            >
              {content.cookieNote}
            </p>
          ) : null}
        </div>

        {/* Actions */}
        <div
          className="flex shrink-0 flex-col-reverse gap-3 border-t px-6 py-5 sm:flex-row sm:justify-end sm:px-9"
          style={{
            borderColor: "var(--color-heritage-border)",
            backgroundColor: "var(--color-heritage-stone)",
          }}
        >
          <button
            type="button"
            onClick={decline}
            className="cursor-pointer rounded-sm border px-7 py-3 text-[12px] uppercase tracking-[0.16em] transition-colors"
            style={{
              borderColor: "var(--color-heritage-navy)",
              color: "var(--color-heritage-navy)",
              fontWeight: 500,
            }}
          >
            {content.disagreeLabel || "I Disagree"}
          </button>
          <button
            type="button"
            onClick={accept}
            autoFocus
            className="cursor-pointer rounded-sm px-7 py-3 text-[12px] uppercase tracking-[0.16em] transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--color-heritage-navy)",
              color: "var(--color-heritage-paper)",
              fontWeight: 600,
            }}
          >
            {content.agreeLabel || "I Agree"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bullets({ items, className }: { items: string[]; className: string }) {
  if (!items.length) return null;
  return (
    <ul className={`mt-3 space-y-2.5 ${className}`}>
      {items.map((text, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden
            className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
            style={{ backgroundColor: "var(--color-heritage-gold-deep)" }}
          />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
