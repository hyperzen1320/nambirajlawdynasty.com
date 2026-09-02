"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PasswordResetForm({
  partnerId,
  partnerName,
  loginEmail,
  partnerAdminId,
}: {
  partnerId: string;
  partnerName: string;
  loginEmail: string;
  partnerAdminId: string | null;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/partners/${partnerId}/password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not reset password.");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      setSubmitting(false);
      router.refresh();
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  if (!partnerAdminId) {
    return (
      <div className="rounded-lg border border-admin-border bg-admin-surface p-7">
        <h3 className="text-[16px] font-semibold tracking-tight text-admin-fg">
          Reset Password
        </h3>
        <p className="mt-2 text-[13px] text-admin-fg-muted">
          No partner-admin user found for this chambers.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="rounded-lg border border-admin-border bg-admin-surface p-7">
        <div className="border-b border-admin-border-soft pb-5">
          <h3 className="text-[16px] font-semibold tracking-tight text-admin-fg">
            Reset Partner-Admin Password
          </h3>
          <p className="mt-1 text-[13px] text-admin-fg-muted">
            Force a new password for{" "}
            <span
              className="text-admin-fg"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              {loginEmail}
            </span>
            . The current password will be invalidated immediately. Share the new
            password with {partnerName}&rsquo;s contact securely.
          </p>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <PasswordField
            id="reset-password"
            label="New Password"
            value={password}
            onChange={setPassword}
            show={showPassword}
            onToggleShow={() => setShowPassword((s) => !s)}
            placeholder="At least 6 characters"
          />
          <PasswordField
            id="reset-confirm"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showPassword}
            onToggleShow={() => setShowPassword((s) => !s)}
            placeholder="Match the above"
          />
        </div>

        {error && (
          <div className="mt-5 rounded-md border border-admin-danger/30 bg-admin-danger-soft px-4 py-3">
            <p className="text-[13px] text-admin-fg">{error}</p>
          </div>
        )}
        {success && (
          <div className="mt-5 rounded-md border border-admin-accent/30 bg-admin-accent-soft px-4 py-3">
            <p className="text-[13px] text-admin-accent">
              ✓ Password reset. Partner-admin must use the new password.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md border border-admin-fg bg-admin-fg px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-admin-fg-muted disabled:opacity-60"
          >
            {submitting ? "Resetting…" : "Reset Password"}
          </button>
        </div>
      </div>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  show: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={id}
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-admin-fg-muted"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {label}
          <span className="ml-1 text-admin-accent">*</span>
        </label>
        <button
          type="button"
          onClick={onToggleShow}
          className="text-[10px] font-medium uppercase tracking-[0.18em] text-admin-fg-soft transition-colors hover:text-admin-fg"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 block w-full rounded-md border border-admin-border bg-admin-surface px-3.5 py-2.5 text-[14px] text-admin-fg placeholder:text-admin-fg-soft/70 outline-none transition-colors focus:border-admin-accent focus:ring-2 focus:ring-admin-accent-soft"
      />
    </div>
  );
}
