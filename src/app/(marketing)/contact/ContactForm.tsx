"use client";

import { useState } from "react";
import { emailjsConfigured, sendEmailjs } from "@/lib/emailjs";

// Inquiry form for the NAMBIRAJ contact page. Sends through EmailJS from the
// browser to the chambers inbox (see src/lib/emailjs.ts). If EmailJS isn't set
// up yet, or the send fails, we fall back to composing a mailto: in the
// visitor's own client, so an enquiry is never simply swallowed.
const RECIPIENTS = ["nambirajlawdynasty@gmail.com"];
const MAX_NAME = 120;
const MAX_DESCRIPTION = 4000;

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

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setType(INQUIRY_TYPES[0]);
    setDescription("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setError("");

    // Honeypot hit: look successful so the bot gets no signal, send nothing.
    if (company) {
      setStatus("sent");
      reset();
      return;
    }
    if (phone && phone.replace(/\D/g, "").length < 8) {
      setError("That phone number doesn't look right.");
      return;
    }
    if (!emailjsConfigured()) {
      openMailClient();
      return;
    }

    setStatus("sending");
    try {
      // Every key is available in the EmailJS template as {{key}}.
      await sendEmailjs({
        name: name.trim(),
        email: email.trim(),
        reply_to: email.trim(),
        phone: phone.trim() || "—",
        inquiry_type: type,
        message: description.trim(),
        title: `${type} — ${name.trim()}`,
      });
      setStatus("sent");
      reset();
    } catch (err) {
      // Rejected, offline, or blocked — leave the visitor a way out.
      console.error("[contact] EmailJS send failed:", err);
      setError(
        "We couldn't send that just now, so we've opened your email app with your enquiry filled in."
      );
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
          maxLength={MAX_NAME}
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
          maxLength={MAX_DESCRIPTION}
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
