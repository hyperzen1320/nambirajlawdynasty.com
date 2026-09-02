"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RequestDeleteDialog from "@/app/app/workflow/[id]/RequestDeleteDialog";
import WhatsAppIcon from "@/app/app/components/WhatsAppIcon";

export type ClientRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  caseCount: number;
};

export default function ClientCrewClient({
  initialClients,
  isAdmin,
}: {
  initialClients: ClientRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>(initialClients);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  function handleUpdated(updated: ClientRow) {
    setClients((prev) =>
      prev
        .map((c) => (c.id === updated.id ? updated : c))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    router.refresh();
  }

  function handleDeleted(id: string) {
    setClients((prev) => prev.filter((c) => c.id !== id));
    router.refresh();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.whatsapp || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q)
    );
  }, [clients, query]);

  function handleAdded(newClient: ClientRow) {
    setClients((prev) =>
      [newClient, ...prev].sort((a, b) => a.name.localeCompare(b.name))
    );
    setAdding(false);
    router.refresh();
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2
            className="text-[30px] font-semibold tracking-tight leading-[1.1] sm:text-[40px]"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            Client Crew
          </h2>
          <p
            className="mt-2 text-[13px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            {clients.length === 0 ? (
              "No clients in the directory yet."
            ) : (
              <>
                <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
                  {clients.length}
                </span>{" "}
                {clients.length === 1 ? "client" : "clients"} in the directory
              </>
            )}
          </p>
        </div>

        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
            boxShadow: "0 8px 20px -10px rgba(197,133,58,0.6)",
          }}
        >
          <span aria-hidden>+</span> {adding ? "Close" : "Add Client"}
        </button>
      </div>

      {/* Inline add form */}
      {adding ? (
        <div className="mt-7 fade-up-sm">
          <AddClientForm
            onCancel={() => setAdding(false)}
            onSaved={handleAdded}
          />
        </div>
      ) : null}

      {/* Search */}
      <div
        className="mt-7 flex items-center gap-3 rounded-xl px-5 py-3.5"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow: "0 1px 0 var(--color-app-edge)",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone or email..."
          className="flex-1 bg-transparent text-[14px] outline-none"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-ink)",
          }}
        />
        {query.length > 0 && (
          <button
            onClick={() => setQuery("")}
            className="text-[11px] uppercase tracking-[0.14em] transition-colors"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* List / empty / no matches */}
      {clients.length === 0 ? (
        <EmptyDirectory onAdd={() => setAdding(true)} />
      ) : filtered.length === 0 ? (
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
            No matches for{" "}
            <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
              &ldquo;{query}&rdquo;
            </span>
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {filtered.map((c, i) => (
            <ClientCard
              key={c.id}
              c={c}
              index={i}
              isAdmin={isAdmin}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ClientCard({
  c,
  index,
  isAdmin,
  onUpdated,
  onDeleted,
}: {
  c: ClientRow;
  index: number;
  isAdmin: boolean;
  onUpdated: (c: ClientRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  const phone = (c.phone || "").trim();
  const wa = (c.whatsapp || c.phone || "").replace(/\D/g, "");
  const waNumber = wa.length === 10 ? `91${wa}` : wa;

  const telLink = phone ? `tel:${phone.replace(/\s+/g, "")}` : null;
  const waLink = wa ? `https://wa.me/${waNumber}` : null;
  const mailLink = c.email ? `mailto:${c.email}` : null;

  if (editing) {
    return (
      <div
        className="fade-up-sm rounded-xl p-5"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow: "0 1px 0 var(--color-app-edge)",
        }}
      >
        <EditClientForm
          client={c}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            onUpdated(updated);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="fade-up-sm rounded-xl p-5"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
        animationDelay: `${Math.min(index, 12) * 35}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="text-[22px] font-semibold leading-[1.2] tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            {c.name}
          </h3>
          {c.address ? (
            <p
              className="mt-1 text-[12px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              {c.address}
            </p>
          ) : null}
        </div>
        <span
          className="shrink-0 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            backgroundColor: "var(--color-app-aqua-soft)",
            color: "var(--color-app-aqua)",
          }}
        >
          {c.caseCount} {c.caseCount === 1 ? "case" : "cases"}
        </span>
      </div>

      {/* Contact actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <ContactButton
          href={telLink}
          icon={<PhoneIcon />}
          label="Call"
          variant="ink"
        />
        <ContactButton
          href={waLink}
          icon={<WhatsAppIcon />}
          label="WhatsApp"
          variant="whatsapp"
          newTab
        />
        <ContactButton
          href={mailLink}
          icon={<MailIcon />}
          label="Email"
          variant="ghost"
        />
      </div>

      {/* Manage actions — edit always available; delete admin-direct,
          non-admins route through the delete-request flow. */}
      <div
        className="mt-4 flex items-center gap-2 border-t pt-4"
        style={{ borderColor: "var(--color-app-edge-soft)" }}
      >
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-fg-soft)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--color-app-copper)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--color-app-edge)";
          }}
        >
          <PencilIcon /> Edit
        </button>
        <DeleteClientButton
          client={c}
          isAdmin={isAdmin}
          onDeleted={() => onDeleted(c.id)}
        />
      </div>
    </div>
  );
}

function DeleteClientButton({
  client,
  isAdmin,
  onDeleted,
}: {
  client: ClientRow;
  isAdmin: boolean;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  async function onDelete() {
    setError(null);
    setWorking(true);
    try {
      const res = await fetch(`/api/app/clients/${client.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Stale role record etc. — pivot non-admins into the request flow
        // rather than dead-ending on the 403.
        if (data?.code === "delete_request_required") {
          setConfirming(false);
          setRequestOpen(true);
          setWorking(false);
          return;
        }
        setError(data?.error ?? "Couldn't delete this client.");
        setWorking(false);
        return;
      }
      onDeleted();
    } catch {
      setError("Network error.");
      setWorking(false);
    }
  }

  if (requestSent) {
    return (
      <span
        className="text-[12px]"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-aqua)",
        }}
      >
        Delete request sent for admin review.
      </span>
    );
  }

  if (confirming && isAdmin) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="text-[12px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: error ? "var(--color-app-danger)" : "var(--color-app-fg-soft)",
          }}
        >
          {error || "Remove this client?"}
        </span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={working}
          className="rounded-md border px-2.5 py-1 text-[12px] font-medium"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            color: "var(--color-app-fg-soft)",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={working}
          className="rounded-md px-2.5 py-1 text-[12px] font-semibold"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-danger)",
            color: "white",
            opacity: working ? 0.6 : 1,
          }}
        >
          {working ? "Removing…" : "Delete"}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (isAdmin ? setConfirming(true) : setRequestOpen(true))}
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          borderColor: "var(--color-app-edge)",
          backgroundColor: "transparent",
          color: "var(--color-app-danger)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--color-app-danger-soft)";
          e.currentTarget.style.borderColor = "var(--color-app-danger)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.borderColor = "var(--color-app-edge)";
        }}
      >
        <TrashIcon /> {isAdmin ? "Delete" : "Request delete"}
      </button>
      {requestOpen ? (
        <RequestDeleteDialog
          target={{
            type: "client",
            id: client.id,
            name: client.name,
            hint: "Only the office admin can remove a client directly.",
          }}
          onClose={() => setRequestOpen(false)}
          onSubmitted={() => {
            setRequestOpen(false);
            setRequestSent(true);
          }}
        />
      ) : null}
    </>
  );
}

function EditClientForm({
  client,
  onCancel,
  onSaved,
}: {
  client: ClientRow;
  onCancel: () => void;
  onSaved: (c: ClientRow) => void;
}) {
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email);
  const [whatsapp, setWhatsapp] = useState(client.whatsapp);
  const [phone, setPhone] = useState(client.phone);
  const [address, setAddress] = useState(client.address);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setMissing(true);
      setError("Name is required.");
      return;
    }
    setMissing(false);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/app/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, whatsapp, phone, address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
        setSubmitting(false);
        return;
      }
      onSaved({
        ...client,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        address: address.trim(),
      });
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div
        className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-copper-deep)",
        }}
      >
        Edit client
      </div>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <Field
          id={`edit-name-${client.id}`}
          label="Name"
          required
          value={name}
          onChange={(v) => {
            setName(v);
            if (missing && v.trim()) setMissing(false);
          }}
          invalid={missing}
        />
        <Field
          id={`edit-email-${client.id}`}
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
        />
        <Field
          id={`edit-whatsapp-${client.id}`}
          label="WhatsApp"
          type="tel"
          value={whatsapp}
          onChange={setWhatsapp}
          placeholder="+91..."
        />
        <Field
          id={`edit-phone-${client.id}`}
          label="Phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="+91..."
        />
        <div className="md:col-span-2">
          <Field
            id={`edit-address-${client.id}`}
            label="Address"
            value={address}
            onChange={setAddress}
          />
        </div>
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

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-4 py-2 text-[13px] font-medium"
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
          className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-[13px] font-semibold transition-all"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-copper)",
            color: "var(--color-app-copper-text)",
            opacity: submitting ? 0.6 : 1,
            boxShadow: "0 8px 20px -10px rgba(197,133,58,0.6)",
          }}
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function ContactButton({
  href,
  icon,
  label,
  variant,
  newTab,
}: {
  href: string | null;
  icon: React.ReactNode;
  label: string;
  variant: "ink" | "whatsapp" | "ghost";
  newTab?: boolean;
}) {
  const styles =
    variant === "ink"
      ? {
          backgroundColor: "var(--color-app-paper)",
          color: "var(--color-app-ink)",
          border: "1px solid var(--color-app-edge)",
        }
      : variant === "whatsapp"
        ? {
            backgroundColor: "#1faa4f",
            color: "#ffffff",
            border: "1px solid transparent",
            boxShadow: "0 6px 16px -10px rgba(31,170,79,0.55)",
          }
        : {
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-fg-soft)",
            border: "1px solid var(--color-app-edge)",
          };

  if (!href) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12px] font-semibold opacity-40"
        style={{ ...styles, fontFamily: "var(--font-manrope), sans-serif" }}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noreferrer" : undefined}
      className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12px] font-semibold transition-all hover:-translate-y-0.5"
      style={{ ...styles, fontFamily: "var(--font-manrope), sans-serif" }}
    >
      {icon}
      {label}
    </a>
  );
}

function AddClientForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: (c: ClientRow) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setMissing(true);
      setError("Name is required.");
      return;
    }
    setMissing(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/app/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          whatsapp,
          phone,
          address,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
        setSubmitting(false);
        return;
      }
      onSaved({
        id: data.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        address: address.trim(),
        caseCount: 0,
      });
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl p-7"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
      }}
    >
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <Field
          id="name"
          label="Name"
          required
          value={name}
          onChange={(v) => {
            setName(v);
            if (missing && v.trim()) setMissing(false);
          }}
          invalid={missing}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
        />
        <Field
          id="whatsapp"
          label="WhatsApp"
          type="tel"
          value={whatsapp}
          onChange={setWhatsapp}
          placeholder="+91..."
        />
        <Field
          id="phone"
          label="Phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="+91..."
        />
        <div className="md:col-span-2">
          <Field
            id="address"
            label="Address"
            value={address}
            onChange={setAddress}
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
          {submitting ? "Saving…" : "Save Client"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  required,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
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
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 block w-full rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-all"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          borderColor: invalid
            ? "var(--color-app-danger)"
            : "var(--color-app-edge)",
          backgroundColor: "var(--color-app-paper)",
          color: "var(--color-app-ink)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-app-copper)";
          e.currentTarget.style.boxShadow =
            "0 0 0 3px rgba(197,133,58,0.15)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = invalid
            ? "var(--color-app-danger)"
            : "var(--color-app-edge)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
    </div>
  );
}

function EmptyDirectory({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="mt-10 rounded-xl p-16 text-center"
      style={{
        backgroundColor: "var(--color-app-paper)",
        border: "1px dashed var(--color-app-edge)",
      }}
    >
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          backgroundColor: "var(--color-app-canvas-2)",
          color: "var(--color-app-copper-deep)",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M3 20a6 6 0 0 1 12 0"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="17.5" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M16 20a4.5 4.5 0 0 1 5.5-4.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3
        className="mt-6 text-[28px] font-semibold tracking-tight"
        style={{
          fontFamily: "var(--font-crimson), Georgia, serif",
          color: "var(--color-app-ink)",
        }}
      >
        No clients yet.
      </h3>
      <p
        className="mx-auto mt-3 max-w-md text-[14px] leading-7"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-muted)",
        }}
      >
        One client, many matters. Add their name, address, and how to reach
        them — every linked case will live in one place.
      </p>
      <button
        onClick={onAdd}
        className="mt-7 inline-flex items-center gap-2 rounded-md px-6 py-3 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          backgroundColor: "var(--color-app-ink)",
          color: "var(--color-app-ivory)",
          boxShadow: "0 8px 20px -10px rgba(10,17,36,0.4)",
        }}
      >
        <span>+</span> Add the first client
      </button>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M3 7l9 6 9-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10-10-4-4L4 16v4z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M14 6l4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
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
