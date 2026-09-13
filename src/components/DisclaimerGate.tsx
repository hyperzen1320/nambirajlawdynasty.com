"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BRAND_NAME } from "@/lib/brand";

// Bar Council of India gate. Indian advocates may not solicit work or
// advertise, so the site opens behind a confirmation that the visitor came
// here of their own accord. Accepting is remembered forever on the device;
// declining sends the visitor off the site entirely.
//
// The overlay is deliberately rendered in the server HTML (initial state is
// "open") so it paints with the first frame — no flash of the site beneath
// it. The inverse flash, a returning visitor glimpsing the gate before the
// effect below clears it, is handled by the blocking script in the root
// layout: it stamps html[data-disclaimer-ack] before paint, and globals.css
// hides the overlay on that attribute.
export const ACK_KEY = "nld:disclaimer-accepted";
const DECLINE_URL = "https://www.google.com";

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

export default function DisclaimerGate() {
  const accepted = useSyncExternalStore(subscribe, hasAccepted, () => false);
  const [dismissed, setDismissed] = useState(false);
  const open = !accepted && !dismissed;

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
    window.location.replace(DECLINE_URL);
  };

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
            DISCLAIMER
          </h2>

          <p className="mt-4 text-[13.5px] leading-[1.75]">
            The rules of the Bar Council of India prohibit law firms from
            soliciting work or advertising in any manner. By clicking on
            &lsquo;I AGREE&rsquo;, the user acknowledges that:
          </p>

          <ul className="mt-3 space-y-2.5 text-[13.5px] leading-[1.75]">
            <Bullet>
              The user wishes to gain more information about {BRAND_NAME}, its
              practice areas and its attorneys, for his/her own information and
              use;
            </Bullet>
            <Bullet>
              The information is made available/provided to the user only on
              his/her specific request and any information obtained or material
              downloaded from this website is completely at the user&rsquo;s
              volition and any transmission, receipt or use of this site is not
              intended to, and will not, create any lawyer-client relationship;
              and
            </Bullet>
            <Bullet>
              None of the information contained on the website is in the nature
              of a legal opinion or otherwise amounts to any legal advice.
            </Bullet>
          </ul>

          <p className="mt-4 text-[13.5px] leading-[1.75]">
            {BRAND_NAME} is not liable for any consequence of any action taken
            by the user relying on material/information provided under this
            website. In cases where the user has any legal issues, he/she in all
            cases must seek independent legal advice.
          </p>

          <h3
            className="mt-8 text-[17px] font-bold tracking-[0.06em] sm:text-[18px]"
            style={{ fontFamily: playfair }}
          >
            Disclaimer &amp; Confirmation
          </h3>
          <hr
            className="mt-3 border-0 border-t"
            style={{ borderColor: "var(--color-heritage-border)" }}
          />

          <p className="mt-4 text-[13.5px] leading-[1.75]">
            As per the rules of the Bar Council of India, we are not permitted
            to solicit work and advertise. By clicking on the &ldquo;I
            AGREE&rdquo; button below, you acknowledge the following:
          </p>

          <ul className="mt-3 space-y-2.5 text-[13.5px] leading-[1.75]">
            <Bullet>
              there has been no advertisement, personal communication,
              solicitation, invitation or inducement of any sort whatsoever from
              us or any of our members to solicit any work through this website;
            </Bullet>
            <Bullet>
              you wish to gain more information about us for your own
              information and use;
            </Bullet>
            <Bullet>
              the information about us is provided to you on your specific
              request and any information obtained or materials downloaded from
              this website is completely at your own volition and any
              transmission, receipt or use of this site does not create any
              lawyer-client relationship; and that
            </Bullet>
            <Bullet>
              we are not liable for any consequence of any action taken by you
              relying on the material / information provided on this website.
            </Bullet>
          </ul>

          <p className="mt-4 text-[13.5px] leading-[1.75]">
            If you have any legal issues, you, in all cases, must seek
            independent legal advice.
          </p>

          <p
            className="mt-4 text-[12.5px] leading-[1.7]"
            style={{ color: "var(--color-heritage-muted)" }}
          >
            We use cookies to enhance your experience. By continuing to visit
            this website you agree to our use of cookies.
          </p>
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
            I Disagree
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
            I Agree
          </button>
        </div>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
        style={{ backgroundColor: "var(--color-heritage-gold-deep)" }}
      />
      <span>{children}</span>
    </li>
  );
}
