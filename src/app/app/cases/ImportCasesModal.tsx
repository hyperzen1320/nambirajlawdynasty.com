"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// "Import Cases" — sits beside "+ New Case". Upload a Word / Excel / CSV /
// PDF roll → the server parses it → the user reviews the parsed rows in a
// preview table (deselecting any they don't want, with bad rows flagged) →
// confirm → bulk create. Nothing is written until the user hits Import.

type ParsedRow = {
  caseNo: string;
  fileNo: string;
  cnr: string;
  iaNumbers: string;
  clientName: string;
  appearingFor: string;
  courtName: string;
  courtPlace: string;
  courtHall: string;
  clientPhone: string;
  clientWhatsapp: string;
  oppositeParty: string;
  oppositeAdvocate: string;
  clientAddress: string;
  status: string;
  lastHearingDate: string | null;
  nextHearingDate: string | null;
};
type RowIssue = { missingCaseNo: boolean; duplicateCnr: boolean; note: string };

// Every Case field the preview lets the reviewer see + edit, in a sensible
// left-to-right order. Anything the parser couldn't fill is shown empty so
// the user can type it in before importing — scroll the grid horizontally
// for the full set. Mirrors the New Case form's field list.
type PreviewField = {
  key: keyof ParsedRow;
  label: string;
  type: "text" | "date";
  width: number;
  mono?: boolean;
  placeholder?: string;
};

const PREVIEW_FIELDS: PreviewField[] = [
  { key: "fileNo", label: "File No", type: "text", width: 120, mono: true, placeholder: "F-2025/001" },
  { key: "caseNo", label: "Case No", type: "text", width: 150, placeholder: "O.S. 100/2025" },
  { key: "iaNumbers", label: "I.A. No(s)", type: "text", width: 120, placeholder: "I.A. 5/2025" },
  { key: "cnr", label: "CNR", type: "text", width: 175, mono: true, placeholder: "TNCH01…2024" },
  { key: "clientName", label: "Client", type: "text", width: 160, placeholder: "R. Murugan" },
  { key: "appearingFor", label: "Appearing For", type: "text", width: 130, placeholder: "Petitioner" },
  { key: "clientWhatsapp", label: "WhatsApp", type: "text", width: 130, mono: true, placeholder: "+91…" },
  { key: "clientPhone", label: "Contact No", type: "text", width: 130, mono: true, placeholder: "+91…" },
  { key: "courtName", label: "Court", type: "text", width: 160, placeholder: "Madras High Court" },
  { key: "courtPlace", label: "Court Place", type: "text", width: 130, placeholder: "Chennai" },
  { key: "courtHall", label: "Court Hall", type: "text", width: 110, placeholder: "Hall 4" },
  { key: "status", label: "Status", type: "text", width: 120, placeholder: "Filed" },
  { key: "lastHearingDate", label: "Previous Date", type: "date", width: 155 },
  { key: "nextHearingDate", label: "Next Date", type: "date", width: 155 },
  { key: "oppositeParty", label: "Opposite Party", type: "text", width: 160, placeholder: "State of Tamil Nadu" },
  { key: "oppositeAdvocate", label: "Opposite Advocate", type: "text", width: 160, placeholder: "Adv. S. Ramesh" },
  { key: "clientAddress", label: "Client Address", type: "text", width: 200, placeholder: "12, North Mada St, Chennai" },
];

const ACCEPT = ".docx,.xlsx,.xls,.csv,.pdf";

type Stage = "idle" | "parsing" | "preview" | "importing" | "done";

export default function ImportCasesButton({
  advocates,
}: {
  advocates: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md px-4 py-3 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          backgroundColor: "var(--color-app-paper)",
          color: "var(--color-app-ink)",
          border: "1px solid var(--color-app-edge)",
          boxShadow: "0 1px 0 var(--color-app-edge)",
        }}
      >
        <ImportIcon />
        Import Cases
      </button>
      {open ? (
        <ImportModal advocates={advocates} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function ImportModal({
  advocates,
  onClose,
}: {
  advocates: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [issues, setIssues] = useState<RowIssue[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [summary, setSummary] = useState<{
    created: number;
    skipped: { caseNo: string; reason: string }[];
  } | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    created: number;
    skipped: number;
  } | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setStage("parsing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/app/cases/import/parse", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Couldn't read that file.");
        setStage("idle");
        return;
      }
      const parsedRows: ParsedRow[] = data.rows || [];
      const parsedIssues: RowIssue[] = data.issues || [];
      if (parsedRows.length === 0) {
        setError("No cases were found in that file.");
        setStage("idle");
        return;
      }
      setRows(parsedRows);
      setIssues(parsedIssues);
      setWarnings(data.warnings || []);
      // Pre-select everything importable (a row with a case number).
      setSelected(parsedRows.map((_, i) => !parsedIssues[i]?.missingCaseNo));
      setStage("preview");
    } catch {
      setError("Network error while reading the file.");
      setStage("idle");
    }
  }

  async function doImport() {
    const toImport = rows.filter((_, i) => selected[i]);
    if (toImport.length === 0) return;
    setStage("importing");
    setError(null);
    setProgress({ done: 0, total: toImport.length, created: 0, skipped: 0 });

    // Import in chunks so the bar actually moves and a big roll doesn't
    // ride on one slow request. CNR de-dup still holds across chunks —
    // every row is checked against the vault on insert — so the outcome is
    // identical to one call, just visible.
    const CHUNK = 40;
    let created = 0;
    const skipped: { caseNo: string; reason: string }[] = [];
    try {
      for (let start = 0; start < toImport.length; start += CHUNK) {
        const chunk = toImport.slice(start, start + CHUNK);
        const res = await fetch("/api/app/cases/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk, advocateId: assigneeId || null }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error || "Import failed.");
          setStage("preview");
          return;
        }
        created += data.created || 0;
        if (Array.isArray(data.skipped)) skipped.push(...data.skipped);
        setProgress({
          done: Math.min(start + chunk.length, toImport.length),
          total: toImport.length,
          created,
          skipped: skipped.length,
        });
      }
      setSummary({ created, skipped });
      setStage("done");
      router.refresh();
      // The Case Vault list is client-fetched, so router.refresh() (which
      // only revalidates server components) won't repaint it. Signal the
      // open vault to re-pull its rows so the freshly imported matters show
      // immediately, with no manual browser refresh.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("legalezi:cases-changed"));
      }
    } catch {
      setError("Network error during import.");
      setStage("preview");
    }
  }

  // Inline edit of a single previewed cell. Every field is editable so the
  // reviewer can correct a misread value or fill a blank the parser left —
  // including the fields no spreadsheet column mapped to.
  function updateCell(i: number, key: keyof ParsedRow, value: string) {
    setRows((prev) =>
      prev.map((r, j) => (j === i ? ({ ...r, [key]: value } as ParsedRow) : r))
    );
  }

  const selectedCount = selected.filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(10,17,36,0.45)" }}
      onMouseDown={(e) => {
        if (stage === "importing") return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl"
        style={{
          backgroundColor: "var(--color-app-paper)",
          boxShadow: "0 32px 64px -24px rgba(10,17,36,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-4 px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-app-edge)" }}
        >
          <div>
            <h3
              className="text-[20px] font-semibold tracking-tight"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              Import cases
            </h3>
            <p
              className="mt-0.5 text-[12px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              Upload a Word, Excel, CSV or PDF roll — review, then import.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{ color: "var(--color-app-fg-muted)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div
              className="mb-4 rounded-md px-3 py-2 text-[12.5px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-danger-soft)",
                border: "1px solid var(--color-app-danger)",
                color: "var(--color-app-ink)",
              }}
            >
              {error}
            </div>
          ) : null}

          {stage === "idle" || stage === "parsing" ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => stage !== "parsing" && inputRef.current?.click()}
              className="cursor-pointer rounded-xl px-6 py-14 text-center transition-colors"
              style={{
                border: `1.5px dashed ${dragOver ? "var(--color-app-copper)" : "var(--color-app-edge)"}`,
                backgroundColor: dragOver ? "var(--color-app-canvas-2)" : "transparent",
              }}
            >
              {stage === "parsing" ? (
                <p
                  className="text-[14px] font-semibold"
                  style={{ fontFamily: "var(--font-manrope), sans-serif", color: "var(--color-app-ink)" }}
                >
                  Reading {fileName}…
                </p>
              ) : (
                <>
                  <p
                    className="text-[14px]"
                    style={{ fontFamily: "var(--font-manrope), sans-serif", color: "var(--color-app-fg-soft)" }}
                  >
                    <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>Drag a file here</span> or click to browse
                  </p>
                  <p
                    className="mt-1 text-[10.5px] uppercase tracking-[0.14em]"
                    style={{ fontFamily: "var(--font-dm-mono), monospace", color: "var(--color-app-fg-muted)" }}
                  >
                    Word · Excel · CSV · PDF
                  </p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          ) : null}

          {stage === "preview" ? (
            <>
              <AssignToRow
                advocates={advocates}
                value={assigneeId}
                onChange={setAssigneeId}
              />
              <PreviewTable
                rows={rows}
                issues={issues}
                warnings={warnings}
                selected={selected}
                onToggle={(i) =>
                  setSelected((prev) => prev.map((v, j) => (j === i ? !v : v)))
                }
                onToggleAll={(v) =>
                  setSelected(rows.map((r) => v && Boolean(r.caseNo.trim())))
                }
                onUpdateCell={updateCell}
              />
            </>
          ) : null}

          {stage === "importing" && progress ? (
            <ImportProgress progress={progress} fileName={fileName} />
          ) : null}

          {stage === "done" && summary ? (
            <DoneSummary summary={summary} />
          ) : null}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{ borderTop: "1px solid var(--color-app-edge)" }}
        >
          <span
            className="text-[12px]"
            style={{ fontFamily: "var(--font-dm-mono), monospace", color: "var(--color-app-fg-muted)" }}
          >
            {stage === "preview"
              ? `${selectedCount} of ${rows.length} selected`
              : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={stage === "importing"}
              className="rounded-md px-4 py-2 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-soft)",
                border: "1px solid var(--color-app-edge)",
              }}
            >
              {stage === "done" ? "Close" : "Cancel"}
            </button>
            {stage === "preview" || stage === "importing" ? (
              <button
                type="button"
                onClick={doImport}
                disabled={selectedCount === 0 || stage === "importing"}
                className="rounded-md px-5 py-2 text-[13px] font-semibold transition-all disabled:cursor-not-allowed"
                style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  backgroundColor: "var(--color-app-copper)",
                  color: "var(--color-app-copper-text)",
                  opacity: selectedCount === 0 || stage === "importing" ? 0.5 : 1,
                }}
              >
                {stage === "importing"
                  ? "Importing…"
                  : `Import ${selectedCount} case${selectedCount === 1 ? "" : "s"}`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewTable({
  rows,
  issues,
  warnings,
  selected,
  onToggle,
  onToggleAll,
  onUpdateCell,
}: {
  rows: ParsedRow[];
  issues: RowIssue[];
  warnings: string[];
  selected: boolean[];
  onToggle: (i: number) => void;
  onToggleAll: (v: boolean) => void;
  onUpdateCell: (i: number, key: keyof ParsedRow, value: string) => void;
}) {
  // Importability is recomputed live off the edited rows, so the moment a
  // reviewer types a Case No into a flagged row it becomes selectable.
  const importable = rows.map((r) => Boolean(r.caseNo.trim()));
  const importableCount = importable.filter(Boolean).length;
  const allChecked =
    importableCount > 0 && importable.every((imp, i) => !imp || selected[i]);

  return (
    <div>
      {warnings.length > 0 ? (
        <div
          className="mb-3 rounded-md px-3 py-2 text-[12px]"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            backgroundColor: "var(--color-app-canvas-2)",
            border: "1px solid var(--color-app-edge)",
            color: "var(--color-app-fg-soft)",
          }}
        >
          {warnings.join(" ")}
        </div>
      ) : null}

      <p
        className="mb-2 text-[11.5px] leading-snug"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-muted)",
        }}
      >
        Every field is editable —{" "}
        <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
          scroll right
        </span>{" "}
        to see and fill the rest (opposite party &amp; advocate, court hall,
        client address…). A row needs only a Case No to import.
      </p>

      <div
        className="overflow-x-auto rounded-lg"
        style={{ border: "1px solid var(--color-app-edge)" }}
      >
        <table className="border-collapse text-[12.5px]">
          <thead>
            <tr style={{ backgroundColor: "var(--color-app-canvas-2)" }}>
              <Th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  aria-label="Select all"
                />
              </Th>
              <Th style={{ width: 48 }}>#</Th>
              {PREVIEW_FIELDS.map((f) => (
                <Th key={f.key} style={{ minWidth: f.width }}>
                  {f.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const bad = !importable[i];
              const issue = issues[i];
              return (
                <tr
                  key={i}
                  style={{
                    borderTop: "1px solid var(--color-app-edge-soft)",
                    backgroundColor: bad
                      ? "var(--color-app-danger-soft)"
                      : issue?.duplicateCnr
                        ? "rgba(172,123,51,0.07)"
                        : "transparent",
                  }}
                >
                  <Td>
                    <input
                      type="checkbox"
                      checked={!!selected[i]}
                      disabled={bad}
                      onChange={() => onToggle(i)}
                      aria-label={`Include row ${i + 1}`}
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="tabular-nums"
                        style={{
                          fontFamily: "var(--font-dm-mono), monospace",
                          color: "var(--color-app-fg-muted)",
                        }}
                      >
                        {i + 1}
                      </span>
                      {bad ? (
                        <span
                          title="No case number — this row won't import"
                          style={{
                            display: "inline-block",
                            height: 7,
                            width: 7,
                            borderRadius: 999,
                            backgroundColor: "var(--color-app-danger)",
                          }}
                        />
                      ) : issue?.duplicateCnr ? (
                        <span
                          title={issue.note || "CNR may already be on record"}
                          style={{
                            display: "inline-block",
                            height: 7,
                            width: 7,
                            borderRadius: 999,
                            backgroundColor: "var(--color-app-copper)",
                          }}
                        />
                      ) : null}
                    </div>
                  </Td>
                  {PREVIEW_FIELDS.map((f) => (
                    <Td key={f.key} style={{ minWidth: f.width }}>
                      <CellInput
                        value={String(r[f.key] ?? "")}
                        type={f.type}
                        mono={f.mono}
                        placeholder={f.placeholder}
                        invalid={f.key === "caseNo" && bad}
                        onChange={(v) => onUpdateCell(i, f.key, v)}
                      />
                    </Td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// A single editable preview cell. Text for most fields, a native date
// picker for the two hearing dates. The Case No cell turns its border red
// while empty, since that's the one field a row can't import without.
function CellInput({
  value,
  type,
  mono,
  placeholder,
  invalid,
  onChange,
}: {
  value: string;
  type: "text" | "date";
  mono?: boolean;
  placeholder?: string;
  invalid?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type={type === "date" ? "date" : "text"}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border bg-transparent px-2 py-1.5 text-[12.5px] outline-none"
      style={{
        fontFamily: mono
          ? "var(--font-dm-mono), monospace"
          : "var(--font-manrope), sans-serif",
        borderColor: invalid
          ? "var(--color-app-danger)"
          : "var(--color-app-edge)",
        backgroundColor: "var(--color-app-paper)",
        color: "var(--color-app-ink)",
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--color-app-copper)";
        e.currentTarget.style.boxShadow = "0 0 0 2px rgba(197,133,58,0.15)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = invalid
          ? "var(--color-app-danger)"
          : "var(--color-app-edge)";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

function DoneSummary({
  summary,
}: {
  summary: { created: number; skipped: { caseNo: string; reason: string }[] };
}) {
  return (
    <div className="py-4">
      <div
        className="rounded-lg px-4 py-3 text-[14px] font-semibold"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          backgroundColor: "var(--color-app-success-soft)",
          color: "var(--color-app-ink)",
          border: "1px solid var(--color-app-success)",
        }}
      >
        Imported {summary.created} case{summary.created === 1 ? "" : "s"}.
      </div>
      {summary.skipped.length > 0 ? (
        <div className="mt-3">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ fontFamily: "var(--font-dm-mono), monospace", color: "var(--color-app-fg-muted)" }}
          >
            Skipped ({summary.skipped.length})
          </div>
          <ul className="mt-2 space-y-1">
            {summary.skipped.map((s, i) => (
              <li
                key={i}
                className="text-[12.5px]"
                style={{ fontFamily: "var(--font-manrope), sans-serif", color: "var(--color-app-fg-soft)" }}
              >
                <span style={{ fontWeight: 600, color: "var(--color-app-ink)" }}>{s.caseNo}</span> — {s.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// Advocate assignment for the whole import. Defaults to "Leave unassigned"
// so a roll is never blindly stamped with the uploader as the advocate —
// the reviewer picks who these matters belong to (or no one).
function AssignToRow({
  advocates,
  value,
  onChange,
}: {
  advocates: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-3.5 py-3"
      style={{
        backgroundColor: "var(--color-app-canvas-2)",
        border: "1px solid var(--color-app-edge)",
      }}
    >
      <label
        htmlFor="import-assignee"
        className="text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          color: "var(--color-app-copper-deep)",
        }}
      >
        Assign to
      </label>
      <div className="relative">
        <select
          id="import-assignee"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none rounded-md border py-2 pl-3 pr-9 text-[13px] outline-none"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            borderColor: "var(--color-app-edge)",
            backgroundColor: "var(--color-app-paper)",
            color: "var(--color-app-ink)",
            minWidth: 180,
          }}
        >
          <option value="">Leave unassigned</option>
          {advocates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px]"
          style={{ color: "var(--color-app-fg-muted)" }}
        >
          ▼
        </span>
      </div>
      <span
        className="flex-1 text-[11.5px]"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-muted)",
        }}
      >
        These matters won&rsquo;t be auto-assigned to you — pick the advocate
        they belong to, or leave them unassigned.
      </span>
    </div>
  );
}

// Court-themed determinate loader shown while the roll is being filed.
// A gold "ledger" bar fills as chunks commit, with a live filed / already-
// on-record tally underneath.
function ImportProgress({
  progress,
  fileName,
}: {
  progress: { done: number; total: number; created: number; skipped: number };
  fileName: string;
}) {
  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

  return (
    <div className="py-10">
      <style>{`
        @keyframes ledger-sheen { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: "var(--color-app-ink)",
            color: "var(--color-app-copper-bright)",
          }}
        >
          <ScalesIcon />
        </span>
        <div className="min-w-0">
          <div
            className="text-[16px] font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            Entering matters into the vault…
          </div>
          <div
            className="mt-0.5 truncate text-[11px]"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              color: "var(--color-app-fg-muted)",
            }}
          >
            {fileName || "Imported roll"}
          </div>
        </div>
        <div
          className="ml-auto text-[24px] font-semibold tabular-nums"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            color: "var(--color-app-copper-deep)",
          }}
        >
          {pct}%
        </div>
      </div>

      <div
        className="mt-5 h-3 w-full overflow-hidden rounded-full"
        style={{
          backgroundColor: "var(--color-app-canvas-2)",
          boxShadow: "inset 0 1px 2px rgba(10,17,36,0.12)",
        }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundImage:
              "linear-gradient(90deg, var(--color-app-copper-deep), var(--color-app-copper), var(--color-app-gold-bright), var(--color-app-copper))",
            backgroundSize: "200% 100%",
            animation: "ledger-sheen 1.4s linear infinite",
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span
          className="text-[12px] tabular-nums"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-fg-soft)",
          }}
        >
          <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
            {progress.done}
          </span>{" "}
          of{" "}
          <span style={{ color: "var(--color-app-ink)", fontWeight: 600 }}>
            {progress.total}
          </span>{" "}
          reviewed
        </span>
        <span
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-dm-mono), monospace" }}
        >
          <span style={{ color: "var(--color-app-aqua)" }}>
            {progress.created} filed
          </span>
          {progress.skipped > 0 ? (
            <span style={{ color: "var(--color-app-copper-deep)" }}>
              {"  ·  "}
              {progress.skipped} already on record
            </span>
          ) : null}
        </span>
      </div>

      <p
        className="mt-6 text-[11.5px] italic leading-6"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          color: "var(--color-app-fg-muted)",
        }}
      >
        Each matter is checked against the vault by CNR — duplicates are
        skipped, never overwritten. You can leave this open while it runs.
      </p>
    </div>
  );
}

function ScalesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v16M7 20h10M5 7h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 7l-2.5 6a3 3 0 0 0 5 0L5 7zM19 7l-2.5 6a3 3 0 0 0 5 0L19 7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Th({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.16em]"
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        color: "var(--color-app-copper-deep)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      className="px-2 py-1.5"
      style={{ verticalAlign: "middle", ...style }}
    >
      {children}
    </td>
  );
}

function ImportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15V4m0 0L8 8m4-4l4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
