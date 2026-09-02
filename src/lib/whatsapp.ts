// WhatsApp deep-link builder for the client hearing-notice flow. The actual
// wording lives in the office's editable template (see lib/notice-template);
// this just renders that template for one matter and wraps it in a wa.me
// link. Used by the case page, the Update Hearing form and Hearing Track.

import { renderNotice, type NoticeData } from "@/lib/notice-template";

export function buildWhatsAppLink(
  phone: string,
  template: string,
  data: NoticeData
): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;

  // Assume Indian numbers when no country code is present (10 digits).
  const wa = digits.length === 10 ? `91${digits}` : digits;

  const text = renderNotice(template, data);
  return `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
}

// Parses the form's yyyy-mm-dd value into a *local* midnight Date so the
// notice reads the same calendar day the advocate picked — `new
// Date("2026-05-30")` would be parsed as UTC and could slip a day in IST
// when formatted back.
export function parseDateInputLocal(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
