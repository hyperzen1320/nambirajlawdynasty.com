"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useState, useTransition, type ReactNode } from "react";
import type { Field } from "@/cms/fields";
import type { SupabaseConfig } from "@/lib/supabase/config";
import type { SaveResult } from "../actions";
import { EditorContext, Fields } from "./FieldInputs";
import { getIn, setIn, stripKeys, withKeys, type Key, type Obj } from "./[doc]/editor-state";
import { formatWhen } from "./format";

// The editing frame shared by page documents and news posts: holds the form
// state, knows what's unsaved, saves through the server action it's given, and
// guards against leaving with unsaved changes. Top-level groups and lists are
// laid out as cards; loose top-level fields share a "General" card.

export type FormEditorProps = {
  fields: readonly Field[];
  initialData: Obj;
  version: number | null;
  heading: string;
  description?: string;
  updatedAt: string | null;
  updatedBy: string | null;
  links?: ReactNode;
  dangerZone?: ReactNode;
  save: (data: unknown, baseVersion: number | null) => Promise<SaveResult & { id?: string }>;
  onSaved?: (result: Extract<SaveResult, { ok: true }> & { id?: string }) => void;
  supabase: SupabaseConfig | null;
  uploadFolder: string;
  loadError?: string | null;
};

type Notice = { kind: "ok" | "error" | "conflict"; text: string } | null;

export default function FormEditor(props: FormEditorProps) {
  const { fields, save, onSaved } = props;
  const [data, setData] = useState<Obj>(() => withKeys(fields, props.initialData));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(stripKeys(props.initialData)));
  const [version, setVersion] = useState(props.version);
  const [meta, setMeta] = useState({ updatedAt: props.updatedAt, updatedBy: props.updatedBy });
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(stripKeys(data)) !== savedJson, [data, savedJson]);

  const update = useCallback((path: readonly Key[], next: unknown) => {
    setData((prev) => {
      const value = typeof next === "function" ? (next as (p: unknown) => unknown)(getIn(prev, path)) : next;
      return setIn(prev, path, value) as Obj;
    });
  }, []);

  const doSave = () => {
    if (pending || !dirty) return;
    setNotice(null);
    const payload = stripKeys(data);
    startTransition(async () => {
      const result = await save(payload, version);
      if (result.ok) {
        setData((prev) => withKeys(fields, result.data, prev));
        setSavedJson(JSON.stringify(result.data));
        setVersion(result.version);
        setMeta({ updatedAt: result.updatedAt, updatedBy: "you" });
        setNotice({ kind: "ok", text: "Saved — the live site shows these changes now." });
        onSaved?.(result);
      } else {
        setNotice({ kind: result.conflict ? "conflict" : "error", text: result.error });
      }
    });
  };

  const discard = () => {
    if (!window.confirm("Discard your unsaved changes?")) return;
    setData((prev) => withKeys(fields, JSON.parse(savedJson), prev));
    setNotice(null);
  };

  // Ctrl/⌘+S saves.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      doSave();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyDown(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const sections = groupSections(fields);

  return (
    <EditorContext.Provider value={{ data, update, supabase: props.supabase, uploadFolder: props.uploadFolder }}>
      <main className="mx-auto max-w-3xl px-5 pb-32 pt-8 lg:px-10 lg:pt-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight">{props.heading}</h1>
            {props.description ? (
              <p className="mt-1 text-[14px]" style={{ color: "var(--color-admin-fg-muted)" }}>
                {props.description}
              </p>
            ) : null}
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--color-admin-fg-soft)" }}>
              {version === null
                ? "Not saved yet — the site shows its built-in copy until you save."
                : `Version ${version}${meta.updatedAt ? ` · saved ${formatWhen(meta.updatedAt)}` : ""}${meta.updatedBy ? ` by ${meta.updatedBy}` : ""}`}
            </p>
          </div>
          {props.links ? <div className="flex flex-wrap gap-2">{props.links}</div> : null}
        </div>

        {props.loadError ? (
          <Banner kind="error">Couldn&rsquo;t load the saved version ({props.loadError}). You&rsquo;re seeing the built-in copy.</Banner>
        ) : null}
        {!props.supabase ? <Banner kind="error">Supabase isn&rsquo;t configured, so saving and uploads won&rsquo;t work.</Banner> : null}

        <fieldset disabled={pending} className="mt-8 space-y-5">
          {sections.map((section, i) => (
            <section
              key={section.key}
              className="rounded-xl border p-5 sm:p-6"
              style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-border)" }}
            >
              {section.title ? (
                <header className="mb-5">
                  <h2 className="text-[15px] font-semibold tracking-tight">{section.title}</h2>
                  {section.help ? (
                    <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--color-admin-fg-soft)" }}>
                      {section.help}
                    </p>
                  ) : null}
                </header>
              ) : null}
              <Fields fields={section.fields} path={section.path} key={i} />
            </section>
          ))}
        </fieldset>

        {props.dangerZone ? <div className="mt-10">{props.dangerZone}</div> : null}
      </main>

      {/* Save bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t lg:left-[256px]"
        style={{ backgroundColor: "color-mix(in oklch, var(--color-admin-surface) 92%, transparent)", borderColor: "var(--color-admin-border)", backdropFilter: "blur(8px)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3 lg:px-10">
          <p
            role="status"
            className="min-w-0 text-[13px] leading-5"
            style={{
              color:
                notice?.kind === "ok"
                  ? "var(--color-admin-accent)"
                  : notice
                    ? "var(--color-admin-danger)"
                    : dirty
                      ? "var(--color-admin-warning)"
                      : "var(--color-admin-fg-soft)",
            }}
          >
            {pending ? "Saving…" : dirty && notice?.kind !== "error" && notice?.kind !== "conflict" ? "You have unsaved changes." : notice?.text ?? "All changes saved."}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {dirty && !pending ? (
              <button type="button" onClick={discard} className="cursor-pointer rounded-lg px-3 py-2 text-[13.5px] font-medium" style={{ color: "var(--color-admin-fg-muted)" }}>
                Discard
              </button>
            ) : null}
            <button
              type="button"
              onClick={doSave}
              disabled={!dirty || pending}
              title="Save (Ctrl+S)"
              className="cursor-pointer rounded-lg px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[var(--color-admin-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "var(--color-admin-accent)" }}
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </EditorContext.Provider>
  );
}

function Banner({ kind, children }: { kind: "error"; children: ReactNode }) {
  return (
    <div
      role={kind === "error" ? "alert" : undefined}
      className="mt-5 rounded-lg px-4 py-3 text-[13.5px] leading-6"
      style={{ backgroundColor: "var(--color-admin-danger-soft)", color: "var(--color-admin-danger)" }}
    >
      {children}
    </div>
  );
}

type Section = { key: string; title?: string; help?: string; fields: readonly Field[]; path: readonly Key[] };

/** Top-level groups become their own card (titled by the group); lists get a card; loose fields are gathered. */
function groupSections(fields: readonly Field[]): Section[] {
  const sections: Section[] = [];
  let loose: Field[] = [];
  const flush = () => {
    if (!loose.length) return;
    sections.push({ key: `loose-${sections.length}`, title: sections.length ? "More" : "General", fields: loose, path: [] });
    loose = [];
  };
  for (const field of fields) {
    if (field.type === "group") {
      flush();
      sections.push({ key: field.name, title: field.label, help: field.help, fields: field.fields, path: [field.name] });
    } else if (field.type === "list") {
      flush();
      sections.push({ key: field.name, fields: [field], path: [] });
    } else {
      loose.push(field);
    }
  }
  flush();
  return sections;
}
