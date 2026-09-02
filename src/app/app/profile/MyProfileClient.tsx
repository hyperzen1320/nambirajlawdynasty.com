"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import NoticeTemplateEditor from "./NoticeTemplateEditor";
import { fullName, initials } from "@/lib/display-name";

export type ProfileData = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  state: string;
  country: string;
  officeAddress: string;
  barEnrolmentNo: string;
  designation: string;
  profilePhoto: string;
};

export default function MyProfileClient({
  initialProfile,
  noticeTemplate,
  isAdmin,
}: {
  initialProfile: ProfileData;
  noticeTemplate: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Editable buffer
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email] = useState(profile.email); // identity — read-only
  const [stateField, setStateField] = useState(profile.state);
  const [country, setCountry] = useState(profile.country);
  const [barEnrolmentNo, setBarEnrolmentNo] = useState(profile.barEnrolmentNo);
  const [designation, setDesignation] = useState(profile.designation);
  const [officeAddress, setOfficeAddress] = useState(profile.officeAddress);

  function startEdit() {
    setName(profile.name);
    setPhone(profile.phone);
    setStateField(profile.state);
    setCountry(profile.country);
    setBarEnrolmentNo(profile.barEnrolmentNo);
    setDesignation(profile.designation);
    setOfficeAddress(profile.officeAddress);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/app/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          state: stateField,
          country,
          barEnrolmentNo,
          designation,
          officeAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
        setSaving(false);
        return;
      }
      setProfile(data.profile);
      setEditing(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  const displayName = fullName(profile.firstName, profile.lastName);
  const avatarInitials = initials(profile.firstName, profile.lastName);
  const designationLine =
    profile.designation || (profile.barEnrolmentNo ? "Advocate" : "");

  return (
    <>
    <div
      className="relative mt-7 fade-up-sm rounded-2xl p-7"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
      }}
    >
      {/* Office letterhead — the brand mark at the head of the card, made
          properly visible (it used to be clipped by overflow-hidden). */}
      <div
        className="flex items-center justify-between gap-4 border-b pb-5"
        style={{ borderColor: "var(--color-app-edge)" }}
      >
        <Logo size={46} />
        <span
          className="text-[9px] uppercase tracking-[0.24em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-muted)",
          }}
        >
          Office Identity
        </span>
      </div>

      {/* Avatar + name */}
      <div className="mt-6 flex items-center gap-5">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
            boxShadow: "0 8px 24px -10px rgba(197,133,58,0.55)",
          }}
        >
          {avatarInitials ? (
            <span
              className="text-[26px] font-semibold"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
              }}
            >
              {avatarInitials}
            </span>
          ) : (
            <UserIcon />
          )}
        </div>
        <div className="min-w-0">
          <h3
            className="text-[28px] font-semibold tracking-tight leading-[1.15]"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {displayName || profile.name || "—"}
          </h3>
          {designationLine ? (
            <p
              className="mt-1 text-[13px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              {designationLine}
            </p>
          ) : null}
        </div>
        {savedFlash ? (
          <span
            className="ml-auto text-[10px] uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-aqua)",
            }}
          >
            Saved ✓
          </span>
        ) : null}
      </div>

      {/* Fields */}
      <div className="mt-7 grid gap-x-6 gap-y-5 md:grid-cols-2">
        <FieldRow
          label="Name"
          value={name}
          displayValue={profile.name}
          editing={editing}
          onChange={setName}
          required
        />
        <FieldRow
          label="Phone"
          value={phone}
          displayValue={profile.phone}
          editing={editing}
          onChange={setPhone}
          placeholder="+91 98xxx 43210"
          type="tel"
        />
        <FieldRow
          label="Email"
          value={email}
          displayValue={profile.email}
          editing={false}
          onChange={() => {}}
          locked
        />
        <FieldRow
          label="State"
          value={stateField}
          displayValue={profile.state}
          editing={editing}
          onChange={setStateField}
          placeholder="Tamil Nadu"
        />
        <FieldRow
          label="Country"
          value={country}
          displayValue={profile.country}
          editing={editing}
          onChange={setCountry}
        />
        <FieldRow
          label="Bar Enrolment No."
          value={barEnrolmentNo}
          displayValue={profile.barEnrolmentNo}
          editing={editing}
          onChange={setBarEnrolmentNo}
          placeholder="MS/1234/2010"
          mono
        />
        <FieldRow
          label="Designation"
          value={designation}
          displayValue={profile.designation}
          editing={editing}
          onChange={setDesignation}
          placeholder="Advocate, Madras High Court"
        />
        <FieldRow
          label="Office Address"
          value={officeAddress}
          displayValue={profile.officeAddress}
          editing={editing}
          onChange={setOfficeAddress}
          placeholder="12, Law Chambers, Chennai - 600001"
        />
      </div>

      {error ? (
        <p
          className="mt-4 text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-danger)",
          }}
        >
          {error}
        </p>
      ) : null}

      {/* Actions */}
      <div className="mt-7 flex justify-end gap-3">
        {editing ? (
          <>
            <button
              onClick={cancelEdit}
              className="rounded-md border px-5 py-2.5 text-[13px] font-medium transition-colors"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-paper)",
                color: "var(--color-app-fg-soft)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-copper)",
                color: "var(--color-app-copper-text)",
                opacity: saving ? 0.6 : 1,
                boxShadow: "0 8px 20px -10px rgba(197,133,58,0.6)",
              }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </>
        ) : (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              backgroundColor: "var(--color-app-copper)",
              color: "var(--color-app-copper-text)",
              boxShadow: "0 8px 20px -10px rgba(197,133,58,0.6)",
            }}
          >
            <EditIcon />
            Edit Profile
          </button>
        )}
      </div>
    </div>
    <NoticeTemplateEditor
      initialTemplate={noticeTemplate}
      isAdmin={isAdmin}
    />
    </>
  );
}

function FieldRow({
  label,
  value,
  displayValue,
  editing,
  onChange,
  placeholder,
  required,
  type = "text",
  mono,
  locked,
}: {
  label: string;
  value: string;
  displayValue: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  mono?: boolean;
  locked?: boolean;
}) {
  return (
    <div>
      <label
        className="text-[10px] font-semibold uppercase tracking-[0.22em] flex items-center gap-1"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--color-app-copper)" }}>*</span>
        )}
        {locked && (
          <span style={{ color: "var(--color-app-fg-muted)", opacity: 0.7 }}>
            <LockIcon />
          </span>
        )}
      </label>
      {editing && !locked ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-2 block w-full rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-all"
          style={{
            fontFamily: mono
              ? "var(--font-dm-mono), monospace"
              : "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-ink)",
            letterSpacing: mono ? 0.3 : 0,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-app-copper)";
            e.currentTarget.style.boxShadow =
              "0 0 0 3px rgba(197,133,58,0.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-app-edge)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      ) : (
        <div
          className="mt-2 rounded-md px-3.5 py-2.5 text-[14px]"
          style={{
            fontFamily: mono
              ? "var(--font-dm-mono), monospace"
              : "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-canvas-2)",
            color: displayValue
              ? "var(--color-app-ink)"
              : "var(--color-app-fg-muted)",
            border: "1px solid transparent",
            letterSpacing: mono ? 0.3 : 0,
            minHeight: 40,
            display: "flex",
            alignItems: "center",
          }}
        >
          {displayValue || (
            <span style={{ fontStyle: "italic", opacity: 0.7 }}>
              Not set
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 21a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="11"
        width="16"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
