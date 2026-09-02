// Shared WhatsApp glyph. The old per-file icon was the heavy filled
// "phone-in-bubble" mark, which read as dated; this is a clean outline
// chat-bubble that inherits `currentColor`, so it sits crisply in white
// on the green WhatsApp buttons across the app (Client Crew, Hearing
// Track, Case detail, the Update-Hearing notice). One source of truth —
// change the mark here and every button updates.

export default function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      {/* Speech bubble with a tail */}
      <path
        d="M20.5 11.7a8.5 8.5 0 0 1-12.4 7.55L3.5 20.5l1.3-4.5A8.5 8.5 0 1 1 20.5 11.7z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* Three dots — the "messaging" cue, kept minimal and modern */}
      <circle cx="8.6" cy="11.8" r="1" fill="currentColor" />
      <circle cx="12" cy="11.8" r="1" fill="currentColor" />
      <circle cx="15.4" cy="11.8" r="1" fill="currentColor" />
    </svg>
  );
}
