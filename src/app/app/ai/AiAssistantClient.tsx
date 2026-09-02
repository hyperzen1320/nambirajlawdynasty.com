"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type ResearchTool = {
  name: string;
  description: string;
  href: string;
};

export type PromptRow = {
  id: string;
  title: string;
  body: string;
  category: string;
  isSeeded: boolean;
};

export default function AiAssistantClient({
  tools,
  initialPrompts,
}: {
  tools: ResearchTool[];
  initialPrompts: PromptRow[];
}) {
  const [prompts, setPrompts] = useState<PromptRow[]>(initialPrompts);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [prompts, query]);

  function handleUpdated(updated: PromptRow) {
    setPrompts((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
    setEditingId(null);
  }

  function handleDeleted(id: string) {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    if (openId === id) setOpenId(null);
    if (editingId === id) setEditingId(null);
  }

  function handleAdded(p: PromptRow) {
    setPrompts((prev) => [p, ...prev]);
    setAdding(false);
    setOpenId(p.id);
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-5">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: "var(--color-app-canvas-2)",
            color: "var(--color-app-copper-deep)",
          }}
        >
          <SparkleIcon />
        </div>
        <div>
          <h2
            className="text-[30px] font-semibold tracking-tight leading-[1.05] sm:text-[40px]"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            AI Assistant
          </h2>
          <p
            className="mt-2 text-[14px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Curated legal AI tools and prompt templates for drafting &amp;
            research.
          </p>
        </div>
      </div>

      {/* Verification banner */}
      <div
        className="mt-7 flex items-start gap-3 rounded-xl px-5 py-4"
        style={{
          backgroundColor: "rgba(197,133,58,0.10)",
          border: "1px solid rgba(197,133,58,0.30)",
        }}
      >
        <span
          className="mt-0.5"
          style={{ color: "var(--color-app-copper-deep)" }}
        >
          <WarningIcon />
        </span>
        <p
          className="text-[13px] leading-[1.55]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-ink)",
          }}
        >
          All AI-generated drafts must be verified, edited and signed by an
          advocate before filing.
        </p>
      </div>

      {/* Research & drafting tools */}
      <section className="mt-9">
        <h3
          className="text-[26px] font-semibold tracking-tight"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            color: "var(--color-app-ink)",
          }}
        >
          Research &amp; drafting tools
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {tools.map((t, i) => (
            <ToolCard key={t.name} tool={t} index={i} />
          ))}
        </div>
      </section>

      {/* Prompt templates */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h3
              className="text-[26px] font-semibold tracking-tight"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              Prompt templates
            </h3>
            <p
              className="mt-1.5 text-[13px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              Tap any template to expand. Edit, copy or remove freely — your
              changes save to the office&rsquo;s template library.
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              backgroundColor: "var(--color-app-copper)",
              color: "var(--color-app-copper-text)",
              boxShadow: "0 8px 20px -10px rgba(197,133,58,0.6)",
            }}
          >
            <span aria-hidden>+</span> New Template
          </button>
        </div>

        {/* Search */}
        {prompts.length > 4 ? (
          <div
            className="mt-5 flex items-center gap-3 rounded-xl px-5 py-3"
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
              placeholder="Search templates by title, content or category..."
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

        {/* Add form */}
        {adding ? (
          <div className="mt-4">
            <AddPromptForm
              onCancel={() => setAdding(false)}
              onSaved={handleAdded}
            />
          </div>
        ) : null}

        {/* List */}
        {filtered.length === 0 ? (
          <div
            className="mt-5 rounded-xl px-5 py-12 text-center"
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
                ? `No templates match "${query}".`
                : "No templates yet. Add your first one to get started."}
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {filtered.map((p, i) => (
              <PromptCard
                key={p.id}
                p={p}
                index={i}
                expanded={openId === p.id}
                editing={editingId === p.id}
                onToggle={() =>
                  setOpenId((cur) => (cur === p.id ? null : p.id))
                }
                onStartEdit={() => {
                  setOpenId(p.id);
                  setEditingId(p.id);
                }}
                onCancelEdit={() => setEditingId(null)}
                onSavedEdit={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* ─── Tool card ─── */

function ToolCard({ tool, index }: { tool: ResearchTool; index: number }) {
  return (
    <a
      href={tool.href}
      target="_blank"
      rel="noreferrer"
      className="fade-up-sm group flex items-start justify-between gap-3 rounded-xl p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
        animationDelay: `${Math.min(index, 8) * 35}ms`,
      }}
    >
      <div className="min-w-0">
        <h4
          className="text-[20px] font-semibold tracking-tight leading-[1.2]"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            color: "var(--color-app-ink)",
          }}
        >
          {tool.name}
        </h4>
        <p
          className="mt-1 text-[13px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-fg-muted)",
          }}
        >
          {tool.description}
        </p>
      </div>
      <span
        className="shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        style={{ color: "var(--color-app-copper-deep)" }}
      >
        <ExternalIcon />
      </span>
    </a>
  );
}

/* ─── Prompt card ─── */

function PromptCard({
  p,
  index,
  expanded,
  editing,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSavedEdit,
  onDeleted,
}: {
  p: PromptRow;
  index: number;
  expanded: boolean;
  editing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSavedEdit: (p: PromptRow) => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(p.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/app/prompts/${p.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDeleted(p.id);
        router.refresh();
      } else {
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fade-up-sm overflow-hidden rounded-xl"
      style={{
        backgroundColor: "var(--color-app-paper)",
        boxShadow: "0 1px 0 var(--color-app-edge)",
        animationDelay: `${Math.min(index, 12) * 25}ms`,
      }}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--color-app-canvas-2)]"
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.18em] shrink-0"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: p.isSeeded
              ? "var(--color-app-aqua)"
              : "var(--color-app-copper-deep)",
            backgroundColor: p.isSeeded
              ? "var(--color-app-aqua-soft)"
              : "rgba(197,133,58,0.12)",
            borderRadius: 4,
            padding: "3px 7px",
          }}
        >
          {p.category}
        </span>
        <span
          className="flex-1 text-[15px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-ink)",
            fontWeight: 500,
          }}
        >
          {p.title}
        </span>
        <span
          className="shrink-0 transition-transform"
          style={{
            color: "var(--color-app-fg-muted)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <ChevronIcon />
        </span>
      </button>

      {expanded ? (
        <div
          className="border-t px-5 py-5"
          style={{ borderColor: "var(--color-app-edge-soft)" }}
        >
          {editing ? (
            <EditPromptForm
              p={p}
              onCancel={onCancelEdit}
              onSaved={onSavedEdit}
            />
          ) : (
            <>
              <pre
                className="whitespace-pre-wrap text-[13px] leading-[1.65]"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  color: "var(--color-app-fg-soft)",
                  backgroundColor: "var(--color-app-canvas-2)",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                {p.body || "(Empty template — click Edit to add the prompt.)"}
              </pre>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12px] font-semibold transition-all hover:-translate-y-0.5"
                  style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    backgroundColor: "var(--color-app-ink)",
                    color: "var(--color-app-ivory)",
                    boxShadow: "0 6px 16px -10px rgba(10,17,36,0.45)",
                  }}
                >
                  <CopyIcon />
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={onStartEdit}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-[12px] font-semibold transition-colors"
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
                {!confirming ? (
                  <button
                    onClick={() => setConfirming(true)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-[12px] font-semibold transition-colors"
                    style={{
                      fontFamily: "var(--font-manrope), sans-serif",
                      borderColor: "var(--color-app-danger)",
                      backgroundColor: "transparent",
                      color: "var(--color-app-danger)",
                    }}
                  >
                    <TrashIcon />
                    Delete
                  </button>
                ) : (
                  <div className="ml-auto flex items-center gap-2">
                    <span
                      className="text-[12px]"
                      style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        color: "var(--color-app-fg-soft)",
                      }}
                    >
                      Delete this template?
                    </span>
                    <button
                      onClick={() => setConfirming(false)}
                      className="rounded-md border px-3 py-1.5 text-[11px] font-medium"
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
                      onClick={confirmDelete}
                      disabled={deleting}
                      className="rounded-md px-3 py-1.5 text-[11px] font-semibold"
                      style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        backgroundColor: "var(--color-app-danger)",
                        color: "white",
                        opacity: deleting ? 0.6 : 1,
                      }}
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Edit form ─── */

function EditPromptForm({
  p,
  onCancel,
  onSaved,
}: {
  p: PromptRow;
  onCancel: () => void;
  onSaved: (p: PromptRow) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(p.title);
  const [body, setBody] = useState(p.body);
  const [category, setCategory] = useState(p.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/app/prompts/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
        setSaving(false);
        return;
      }
      onSaved(data.prompt);
      router.refresh();
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <PromptField
        label="Title"
        value={title}
        onChange={setTitle}
        placeholder="A short label for this template"
      />
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <PromptArea
          label="Template body"
          value={body}
          onChange={setBody}
          placeholder="Paste the prompt body here…"
          rows={14}
        />
        <PromptField
          label="Category"
          value={category}
          onChange={setCategory}
          placeholder="Pleadings / Notices / Custom"
        />
      </div>
      {error ? (
        <p
          className="text-[12px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-danger)",
          }}
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
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
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/* ─── Add form ─── */

function AddPromptForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: (p: PromptRow) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Custom");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/app/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
        setSaving(false);
        return;
      }
      onSaved(data.prompt);
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
        className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-3"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-copper-deep)",
        }}
      >
        New template
      </div>
      <div className="space-y-3">
        <PromptField
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="Draft an interim application under Order XXXIX Rules 1 & 2 CPC"
        />
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <PromptArea
            label="Template body"
            value={body}
            onChange={setBody}
            placeholder="Paste your prompt template here. Include placeholders like [Plaintiff Name], [Court Name] for fields the AI should fill."
            rows={10}
          />
          <PromptField
            label="Category"
            value={category}
            onChange={setCategory}
            placeholder="Custom"
          />
        </div>
        {error ? (
          <p
            className="text-[12px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-danger)",
            }}
          >
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
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
            {saving ? "Saving…" : "Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Field helpers ─── */

function PromptField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 block w-full rounded-md border px-3.5 py-2.5 text-[14px] outline-none transition-all"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          borderColor: "var(--color-app-edge)",
          backgroundColor: "var(--color-app-paper)",
          color: "var(--color-app-ink)",
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

function PromptArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 8,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
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
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-2 block w-full rounded-md border px-3.5 py-2.5 text-[13px] outline-none transition-all resize-y leading-[1.6]"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          borderColor: "var(--color-app-edge)",
          backgroundColor: "var(--color-app-canvas-2)",
          color: "var(--color-app-ink)",
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

/* ─── Icons ─── */

function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 2 21h20L12 3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v5M12 18v.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 4h6v6M20 4l-9 9M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="8"
        y="8"
        width="13"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
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
