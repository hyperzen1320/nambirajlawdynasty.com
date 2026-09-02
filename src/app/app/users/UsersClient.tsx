"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SeatStatus } from "@/lib/seats";

export type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  userType: string;
  role: string;
  phone: string;
  designation: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  isYou: boolean;
};

const STAFF_ROLES: { key: string; label: string; description: string }[] = [
  {
    key: "advocate",
    label: "Advocate",
    description: "Full case, client and hearing access.",
  },
  {
    key: "junior",
    label: "Junior",
    description: "Update cases & hearings, view clients & courts.",
  },
  {
    key: "clerk",
    label: "Clerk",
    description: "Data entry across cases and clients.",
  },
  {
    key: "viewer",
    label: "Viewer",
    description: "Read-only access across the office.",
  },
];

function rolePillStyle(role: string) {
  switch (role) {
    case "admin":
      return {
        bg: "rgba(197,133,58,0.18)",
        fg: "var(--color-app-copper-deep)",
        label: "Office Admin",
      };
    case "advocate":
      return {
        bg: "rgba(10,17,36,0.10)",
        fg: "var(--color-app-ink)",
        label: "Advocate",
      };
    case "junior":
      return {
        bg: "var(--color-app-aqua-soft)",
        fg: "var(--color-app-aqua)",
        label: "Junior",
      };
    case "clerk":
      return {
        bg: "rgba(138,88,33,0.14)",
        fg: "var(--color-app-copper-deep)",
        label: "Clerk",
      };
    case "viewer":
      return {
        bg: "var(--color-app-canvas-2)",
        fg: "var(--color-app-fg-soft)",
        label: "Viewer",
      };
    default:
      return {
        bg: "var(--color-app-canvas-2)",
        fg: "var(--color-app-fg-soft)",
        label: "Staff",
      };
  }
}

/* ─── Seat meter ─── */

// A quiet gauge next to Add User: seats used of the plan's allowance, and
// a bar that turns copper as it fills and vermillion once it's full.
function SeatMeter({ seats }: { seats: SeatStatus }) {
  const pct = seats.limit > 0
    ? Math.min(100, Math.round((seats.used / seats.limit) * 100))
    : 0;
  const full = seats.atCap;
  const nearlyFull = !full && seats.remaining !== null && seats.remaining <= 1;
  const barColor = full
    ? "var(--color-app-danger)"
    : nearlyFull
      ? "var(--color-app-copper)"
      : "var(--color-app-aqua)";

  return (
    <div className="min-w-[168px]">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-muted)",
          }}
        >
          Seats
        </span>
        <span
          className="text-[12px] tabular-nums"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: full ? "var(--color-app-danger)" : "var(--color-app-ink)",
            fontWeight: 600,
          }}
        >
          {seats.used} / {seats.limit}
        </span>
      </div>
      <div
        className="mt-1.5 h-1 overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--color-app-edge)" }}
        role="meter"
        aria-valuenow={seats.used}
        aria-valuemin={0}
        aria-valuemax={seats.limit}
        aria-label="Seats used"
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <div
        className="mt-1 text-[10px] uppercase tracking-[0.12em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {seats.planLabel || seats.planKey} plan
      </div>
    </div>
  );
}

export default function UsersClient({
  initialUsers,
  currentUserId,
  isAdmin,
  initialSeats,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
  isAdmin: boolean;
  initialSeats: SeatStatus;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.designation || "").toLowerCase().includes(q)
    );
  }, [users, query]);

  function handleAdded(u: UserRow) {
    setUsers((prev) => [
      { ...u, isYou: u.id === currentUserId },
      ...prev,
    ]);
    setAdding(false);
  }
  function handleUpdated(u: UserRow) {
    setUsers((prev) =>
      prev.map((x) => (x.id === u.id ? { ...u, isYou: x.isYou } : x))
    );
    setEditingId(null);
  }
  function handleDeleted(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  // Seats are recounted from the list on every render rather than trusted
  // from the server snapshot, so adding, deactivating or removing someone
  // moves the meter immediately — and the Add button locks the moment the
  // last seat is taken, instead of only failing at POST.
  const usedSeats = users.filter((u) => u.active).length;
  const seats: SeatStatus = initialSeats.unlimited
    ? { ...initialSeats, used: usedSeats }
    : {
        ...initialSeats,
        used: usedSeats,
        remaining: Math.max(0, initialSeats.limit - usedSeats),
        atCap: usedSeats >= initialSeats.limit,
      };
  const addBlocked = isAdmin && seats.atCap && !adding;

  return (
    <>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-[30px] font-semibold tracking-tight leading-[1.1] sm:text-[40px]"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            Users / Advocates
          </h2>
          <p
            className="mt-2 text-[13px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            {users.length === 0
              ? "Your office team will appear here."
              : `${users.length} ${users.length === 1 ? "person" : "people"} in your office.`}
          </p>
        </div>
        <div className="flex items-end gap-4">
          {!seats.unlimited ? <SeatMeter seats={seats} /> : null}
          {isAdmin ? (
            <button
              onClick={() => setAdding((v) => !v)}
              disabled={addBlocked}
              title={
                addBlocked
                  ? `All ${seats.limit} seats on your ${seats.planLabel || seats.planKey} plan are in use.`
                  : undefined
              }
              className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-[13px] font-semibold transition-all enabled:hover:-translate-y-0.5"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: addBlocked
                  ? "var(--color-app-paper)"
                  : "var(--color-app-copper)",
                color: addBlocked
                  ? "var(--color-app-fg-muted)"
                  : "var(--color-app-copper-text)",
                border: addBlocked
                  ? "1px solid var(--color-app-edge)"
                  : "none",
                boxShadow: addBlocked
                  ? "none"
                  : "0 8px 20px -10px rgba(197,133,58,0.6)",
                cursor: addBlocked ? "not-allowed" : "pointer",
              }}
            >
              <span aria-hidden>+</span>{" "}
              {adding ? "Close" : addBlocked ? "Seats full" : "Add User"}
            </button>
          ) : null}
        </div>
      </div>

      {/* At the cap, say so where the admin is about to look for the button */}
      {addBlocked ? (
        <div
          className="mt-6 rounded-xl px-5 py-4 flex items-start gap-3"
          style={{
            backgroundColor: "var(--color-app-danger-soft)",
            border: "1px solid var(--color-app-danger)",
          }}
        >
          <span style={{ color: "var(--color-app-danger)" }}>
            <InfoIcon />
          </span>
          <p
            className="text-[13px] leading-[1.55]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-ink)",
            }}
          >
            All{" "}
            <strong>
              {seats.limit} {seats.limit === 1 ? "seat" : "seats"}
            </strong>{" "}
            on your{" "}
            <strong>{seats.planLabel || seats.planKey}</strong> plan are in
            use. Deactivate someone you no longer need — their name stays on
            past activity — or contact Legalezi to move to a larger plan.
          </p>
        </div>
      ) : null}

      {!isAdmin ? (
        <div
          className="mt-7 rounded-xl px-5 py-4 flex items-start gap-3"
          style={{
            backgroundColor: "rgba(86,160,168,0.10)",
            border: "1px solid rgba(86,160,168,0.30)",
          }}
        >
          <span style={{ color: "var(--color-app-aqua)" }}>
            <InfoIcon />
          </span>
          <p
            className="text-[13px] leading-[1.55]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-ink)",
            }}
          >
            Only the office admin can add or remove users. You can view the
            team here.
          </p>
        </div>
      ) : null}

      {/* Add form */}
      {adding && isAdmin ? (
        <div className="mt-7 fade-up-sm">
          <AddUserForm onCancel={() => setAdding(false)} onSaved={handleAdded} />
        </div>
      ) : null}

      {/* Search */}
      {users.length > 4 ? (
        <div
          className="mt-7 flex items-center gap-3 rounded-xl px-5 py-3.5"
          style={{
            backgroundColor: "var(--color-app-paper)",
            boxShadow: "0 1px 0 var(--color-app-edge)",
          }}
        >
          <span style={{ color: "var(--color-app-fg-muted)" }}>
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or designation..."
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-ink)",
            }}
          />
          {query.length > 0 && (
            <button
              onClick={() => setQuery("")}
              className="text-[11px] uppercase tracking-[0.14em]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
              }}
            >
              Clear
            </button>
          )}
        </div>
      ) : null}

      {/* List */}
      {filtered.length === 0 ? (
        <div
          className="mt-6 rounded-xl px-5 py-12 text-center"
          style={{
            backgroundColor: "var(--color-app-paper)",
            border: "1px dashed var(--color-app-edge)",
          }}
        >
          <p
            className="text-[14px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            {query
              ? `No matches for "${query}".`
              : "No users yet."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {filtered.map((u, i) =>
            editingId === u.id ? (
              <EditUserForm
                key={u.id}
                user={u}
                onCancel={() => setEditingId(null)}
                onSaved={handleUpdated}
                onDeleted={handleDeleted}
              />
            ) : (
              <UserCard
                key={u.id}
                u={u}
                index={i}
                isAdmin={isAdmin}
                onEdit={() => setEditingId(u.id)}
                onUpdated={handleUpdated}
              />
            )
          )}
        </div>
      )}
    </>
  );
}

/* ─── User card ─── */

function UserCard({
  u,
  index,
  isAdmin,
  onEdit,
  onUpdated,
}: {
  u: UserRow;
  index: number;
  isAdmin: boolean;
  onEdit: () => void;
  onUpdated: (u: UserRow) => void;
}) {
  const router = useRouter();
  const isPartnerAdmin = u.userType === "partner_admin";
  const initials = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/app/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated(data.user);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fade-up-sm rounded-xl p-5"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
        animationDelay: `${Math.min(index, 12) * 35}ms`,
        opacity: u.active ? 1 : 0.65,
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: isPartnerAdmin
              ? "var(--color-app-copper)"
              : "var(--color-app-ink)",
            color: isPartnerAdmin
              ? "var(--color-app-copper-text)"
              : "var(--color-app-ivory)",
          }}
        >
          {initials ? (
            <span
              className="text-[18px] font-semibold"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
              }}
            >
              {initials}
            </span>
          ) : (
            <UserIcon />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3
              className="text-[20px] font-semibold leading-[1.2] tracking-tight"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              {u.name || "—"}
            </h3>
            {u.isYou ? (
              <span
                className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  backgroundColor: "var(--color-app-aqua-soft)",
                  color: "var(--color-app-aqua)",
                }}
              >
                You
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {(() => {
              const pill = rolePillStyle(u.role);
              return (
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    backgroundColor: pill.bg,
                    color: pill.fg,
                  }}
                >
                  {pill.label}
                </span>
              );
            })()}
            {u.designation ? (
              <span
                className="text-[12px]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-fg-soft)",
                }}
              >
                {u.designation}
              </span>
            ) : null}
            {!u.active ? (
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  backgroundColor: "var(--color-app-danger-soft)",
                  color: "var(--color-app-danger)",
                }}
              >
                Inactive
              </span>
            ) : null}
          </div>
          <p
            className="mt-2 text-[12px]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
              letterSpacing: 0.3,
            }}
          >
            {u.email}
          </p>
          {u.phone ? (
            <p
              className="mt-0.5 text-[12px]"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--color-app-fg-muted)",
              }}
            >
              {u.phone}
            </p>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      {isAdmin && !u.isYou ? (
        <div
          className="mt-4 pt-4 flex flex-wrap gap-2 border-t"
          style={{ borderColor: "var(--color-app-edge-soft)" }}
        >
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              borderColor: "var(--color-app-edge)",
              backgroundColor: "var(--color-app-paper)",
              color: "var(--color-app-ink)",
            }}
          >
            <EditIcon />
            Edit
          </button>
          {!isPartnerAdmin ? (
            <button
              onClick={toggleActive}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                borderColor: "var(--color-app-edge)",
                backgroundColor: "var(--color-app-paper)",
                color: u.active
                  ? "var(--color-app-fg-soft)"
                  : "var(--color-app-aqua)",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {u.active ? "Deactivate" : "Activate"}
            </button>
          ) : null}
          {!isPartnerAdmin ? (
            <RemoveButton id={u.id} name={u.name} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RemoveButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/app/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          borderColor: "var(--color-app-danger)",
          backgroundColor: "transparent",
          color: "var(--color-app-danger)",
        }}
      >
        <TrashIcon />
        Remove
      </button>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <span
        className="text-[11px]"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-soft)",
        }}
      >
        Remove {name.split(" ")[0] || "user"}?
      </span>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-md border px-2.5 py-1 text-[11px] font-medium"
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
        onClick={remove}
        disabled={busy}
        className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          backgroundColor: "var(--color-app-danger)",
          color: "white",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Removing…" : "Yes"}
      </button>
    </div>
  );
}

/* ─── Add form ─── */

function AddUserForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: (u: UserRow) => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("junior");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/app/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          role,
          designation,
          phone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save the user. Please try again.");
        setSubmitting(false);
        return;
      }
      onSaved({ ...data.user, isYou: false });
      router.refresh();
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="rounded-2xl p-7"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
        borderLeft: "3px solid var(--color-app-copper)",
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-5"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-copper-deep)",
        }}
      >
        New team member
      </div>

      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <Field
          label="Email (login id)"
          type="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="junior@officemail.com"
          mono
        />
        <PasswordField
          label="Password"
          required
          value={password}
          onChange={setPassword}
          show={showPwd}
          onToggleShow={() => setShowPwd((v) => !v)}
          hint="At least 8 characters. Share this with the team member."
        />
        <Field
          label="First name"
          value={firstName}
          onChange={setFirstName}
          placeholder="Aarav"
        />
        <Field
          label="Last name"
          value={lastName}
          onChange={setLastName}
          placeholder="Iyer"
        />
        <RoleSelect label="Role" value={role} onChange={setRole} />
        <Field
          label="Phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="+91 98xxx 43210"
        />
        <div className="md:col-span-2">
          <Field
            label="Designation"
            value={designation}
            onChange={setDesignation}
            placeholder="Junior Advocate / Clerk / Office Manager (free text)"
          />
        </div>
      </div>

      {error ? (
        <div
          className="mt-5 rounded-md px-4 py-3"
          style={{
            backgroundColor: "var(--color-app-danger-soft)",
            border: "1px solid var(--color-app-danger)",
          }}
        >
          <p
            className="text-[13px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-ink)",
            }}
          >
            {error}
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
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
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-[13px] font-semibold transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
            opacity: submitting ? 0.6 : 1,
            boxShadow: "0 8px 20px -10px rgba(197,133,58,0.6)",
          }}
        >
          {submitting ? "Saving…" : "Save User"}
        </button>
      </div>
    </form>
  );
}

/* ─── Edit form ─── */

function EditUserForm({
  user,
  onCancel,
  onSaved,
  onDeleted,
}: {
  user: UserRow;
  onCancel: () => void;
  onSaved: (u: UserRow) => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [role, setRole] = useState(user.role);
  const [designation, setDesignation] = useState(user.designation);
  const [phone, setPhone] = useState(user.phone);
  const [resettingPwd, setResettingPwd] = useState(false);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        firstName,
        lastName,
        designation,
        phone,
      };
      if (user.userType !== "partner_admin" && role) {
        payload.role = role;
      }
      if (resettingPwd && password) {
        payload.password = password;
      }
      const res = await fetch(`/api/app/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
        setSaving(false);
        return;
      }
      onSaved(data.user);
      router.refresh();
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fade-up-sm rounded-xl p-5"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
        borderLeft: "3px solid var(--color-app-copper)",
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-4"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-copper-deep)",
        }}
      >
        Editing {user.email}
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-2">
          <Field
            label="First name"
            required
            value={firstName}
            onChange={setFirstName}
          />
          <Field label="Last name" value={lastName} onChange={setLastName} />
        </div>
        {user.userType !== "partner_admin" ? (
          <RoleSelect label="Role" value={role} onChange={setRole} />
        ) : null}
        <Field
          label="Designation"
          value={designation}
          onChange={setDesignation}
        />
        <Field label="Phone" type="tel" value={phone} onChange={setPhone} />

        {!resettingPwd ? (
          <button
            type="button"
            onClick={() => setResettingPwd(true)}
            className="text-[12px] font-semibold transition-colors"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-copper-deep)",
              letterSpacing: 1.4,
              textTransform: "uppercase",
            }}
          >
            Reset password
          </button>
        ) : (
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            show={showPwd}
            onToggleShow={() => setShowPwd((v) => !v)}
            hint="At least 8 characters. Share with the team member."
          />
        )}
      </div>

      {error ? (
        <p
          className="mt-3 text-[12px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-danger)",
          }}
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border px-4 py-2 text-[12px] font-medium"
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
          className="rounded-md px-5 py-2 text-[12px] font-semibold transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
            opacity: saving ? 0.6 : 1,
            boxShadow: "0 6px 16px -10px rgba(197,133,58,0.55)",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ─── Field helpers ─── */

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  mono,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <label
        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--color-app-copper)", marginLeft: 4 }}>
            *
          </span>
        )}
      </label>
      <input
        type={type}
        required={required}
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
    </div>
  );
}

function RoleSelect({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const current = STAFF_ROLES.find((r) => r.key === value) ?? STAFF_ROLES[1];
  return (
    <div>
      <label
        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--color-app-copper)", marginLeft: 4 }}>
            *
          </span>
        )}
      </label>
      <div className="relative mt-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full appearance-none rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-ink)",
            paddingRight: 36,
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
        >
          {STAFF_ROLES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <p
        className="mt-1.5 text-[11px]"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {current.description}
      </p>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  hint,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-fg-muted)",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--color-app-copper)", marginLeft: 4 }}>
            *
          </span>
        )}
      </label>
      <div className="relative mt-2">
        <input
          type={show ? "text" : "password"}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          className="block w-full rounded-md border px-3.5 py-2.5 pr-12 text-[14px] outline-none transition-all"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-ink)",
            letterSpacing: 0.3,
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
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-[11px] font-semibold transition-colors"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-copper-deep)",
            letterSpacing: 1.2,
          }}
        >
          {show ? "HIDE" : "SHOW"}
        </button>
      </div>
      {hint ? (
        <p
          className="mt-1.5 text-[11px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-muted)",
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ─── Icons ─── */

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 21a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M16 16l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 8h.01M11 12h1v5h1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
