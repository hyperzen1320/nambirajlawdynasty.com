"use client";

import { useState } from "react";

// Inquiry form for the NAMBIRAJ contact page. Submits to /api/contact, which
// mails the chambers server-side. If that server has no SMTP credentials yet
// it answers `mailUnconfigured` and we fall back to composing a mailto: in the
// visitor's own client, so an enquiry is never simply swallowed.
const RECIPIENTS = ["nambirajlawdynasty@gmail.com"];

const INQUIRY_TYPES = [
  "Civil Matter",
  "Criminal Matter",
  "Property Dispute",
  "Corporate Advisory",
  "Family Law",
  "Other",
];

const inter = "var(--font-inter), system-ui, sans-serif";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState(INQUIRY_TYPES[0]);
  const [description, setDescription] = useState("");
  const [company, setCompany] = useState(""); // honeypot — see /api/contact
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  function openMailClient() {
    const subject = encodeURIComponent(
      `Inquiry: ${type} — ${name || "Website"}`
    );
    const body = encodeURIComponent(
      [
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || "—"}`,
        `Inquiry type: ${type}`,
        "",
        "Brief description:",
        description,
      ].join("\n")
    );
    window.location.href = `mailto:${RECIPIENTS.join(
      ","
    )}?subject=${subject}&body=${body}`;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, type, description, company }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mailUnconfigured?: boolean;
      };

      if (data.mailUnconfigured) {
        openMailClient();
        setStatus("idle");
        return;
      }
      if (!res.ok) {
        setError(data.error || "We couldn't send that just now.");
        setStatus("idle");
        return;
      }

      setStatus("sent");
      setName("");
      setEmail("");
      setPhone("");
      setType(INQUIRY_TYPES[0]);
      setDescription("");
    } catch {
      // Offline, or the request never landed — leave the visitor a way out.
      openMailClient();
      setStatus("idle");
    }
  }

  const label =
    "block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-heritage-gold-deep)]";
  const field =
    "mt-2 block w-full rounded-none border border-[var(--color-heritage-border)] bg-white px-4 py-3 text-[15px] text-[var(--color-heritage-navy)] outline-none transition-colors focus:border-[var(--color-heritage-navy)]";

  return (
    <form onSubmit={onSubmit} className="space-y-6" style={{ fontFamily: inter }}>
      <div>
        <label className={label} htmlFor="cf-name">
          Full Name
        </label>
        <input
          id="cf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={field}
          placeholder="Your full name"
        />
      </div>

      <div>
        <label className={label} htmlFor="cf-email">
          Email
        </label>
        <input
          id="cf-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={field}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className={label} htmlFor="cf-phone">
          Phone
        </label>
        <input
          id="cf-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={field}
          placeholder="+91 00000 00000"
        />
      </div>

      <div>
        <label className={label} htmlFor="cf-type">
          Inquiry Type
        </label>
        <select
          id="cf-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={`${field} cursor-pointer appearance-none bg-[length:18px] bg-[right_1rem_center] bg-no-repeat pr-10`}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231a2238' stroke-width='1.8'><path d='M6 9l6 6 6-6'/></svg>\")",
          }}
        >
          {INQUIRY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={label} htmlFor="cf-desc">
          Brief Description
        </label>
        <textarea
          id="cf-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={5}
          className={`${field} resize-none`}
          placeholder="Tell us briefly about your matter…"
        />
      </div>

      {/* Honeypot: hidden from people, irresistible to naive bots. */}
      <div aria-hidden className="hidden">
        <label htmlFor="cf-company">Company</label>
        <input
          id="cf-company"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-[14px] leading-6 text-[#8a2b2b]">
          {error}
        </p>
      ) : null}

      {status === "sent" ? (
        <p
          role="status"
          className="border px-4 py-3 text-[14px] leading-6"
          style={{
            borderColor: "var(--color-heritage-border)",
            color: "var(--color-heritage-navy)",
            backgroundColor:
              "color-mix(in oklch, var(--color-heritage-stone) 45%, white)",
          }}
        >
          Thank you — your enquiry has reached the chambers. We&rsquo;ll be in
          touch shortly.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: "var(--color-heritage-navy)" }}
      >
        {status === "sending" ? "Sending…" : "Submit Inquiry"}
      </button>
    </form>
  );
}
