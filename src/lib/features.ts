// Per-chambers module switches.
//
// The global admin decides which parts of Legalezi a given office can
// reach. Everything ships ON: a feature that has never been touched is
// absent from the Partner document, and absent ALWAYS means enabled. That
// single rule is why this needed no migration — every chambers already on
// the platform keeps exactly what it had.
//
// Three layers enforce a switched-off module:
//   1. the sidebar / dashboard hide it        (cosmetic)
//   2. the page redirects to the dashboard    (stops a typed URL)
//   3. requirePartner() 403s the API          (stops everything else)
//
// Layer 3 is the one that matters, and it lives in ONE place — see
// featureForApiPath below — so a new route under an existing prefix is
// covered the day it's written rather than the day somebody remembers.

export const FEATURE_KEYS = [
  "cases",
  "clients",
  "hearings",
  "courts",
  "workflow",
  "seniorDesk",
  "ai",
  "disposed",
  "activity",
  "attendance",
  "users",
  "exports",
  "imports",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureMap = Partial<Record<FeatureKey, boolean>>;

export type FeatureMeta = {
  key: FeatureKey;
  label: string;
  description: string;
  group: "Workspace" | "Collaboration" | "Office" | "Data";
  /** Copy shown on the redirect/403 path so the user knows who to ask. */
  offMessage: string;
};

export const FEATURES: FeatureMeta[] = [
  {
    key: "cases",
    label: "Case Vault",
    description: "The register of matters — add, edit, search, document files.",
    group: "Workspace",
    offMessage: "Case Vault isn't part of your chambers' plan.",
  },
  {
    key: "hearings",
    label: "Hearing Track",
    description: "Today, tomorrow, pending dates and the full cause-list.",
    group: "Workspace",
    offMessage: "Hearing Track isn't part of your chambers' plan.",
  },
  {
    key: "clients",
    label: "Client Crew",
    description: "The client book with contact details and matter history.",
    group: "Workspace",
    offMessage: "Client Crew isn't part of your chambers' plan.",
  },
  {
    key: "courts",
    label: "Court Hub",
    description: "Courts, halls and numbers used across the office.",
    group: "Workspace",
    offMessage: "Court Hub isn't part of your chambers' plan.",
  },
  {
    key: "disposed",
    label: "Disposed Cases",
    description: "The archive of closed matters, with restore.",
    group: "Workspace",
    offMessage: "The disposed-case archive isn't part of your chambers' plan.",
  },
  {
    key: "workflow",
    label: "Work Flow",
    description: "Kanban boards, lists, cards and checklists.",
    group: "Collaboration",
    offMessage: "Work Flow isn't part of your chambers' plan.",
  },
  {
    key: "seniorDesk",
    label: "Senior Desk",
    description: "Office chat, private threads, file sharing and reminders.",
    group: "Collaboration",
    offMessage: "Senior Desk isn't part of your chambers' plan.",
  },
  {
    key: "ai",
    label: "AI Assistant",
    description: "Drafting prompts and the assistant workspace.",
    group: "Collaboration",
    offMessage: "The AI Assistant isn't part of your chambers' plan.",
  },
  {
    key: "users",
    label: "Users / Advocates",
    description: "Adding and managing the people in the office.",
    group: "Office",
    offMessage: "User management isn't part of your chambers' plan.",
  },
  {
    key: "attendance",
    label: "Attendance",
    description: "The daily attendance register.",
    group: "Office",
    offMessage: "Attendance isn't part of your chambers' plan.",
  },
  {
    key: "activity",
    label: "Activity Log",
    description: "The audit feed of who changed what.",
    group: "Office",
    offMessage: "The activity log isn't part of your chambers' plan.",
  },
  {
    key: "exports",
    label: "Exports",
    description: "Word, Excel and PDF downloads across every module.",
    group: "Data",
    offMessage: "Exports aren't part of your chambers' plan.",
  },
  {
    key: "imports",
    label: "Imports",
    description: "Bulk-loading matters from a spreadsheet.",
    group: "Data",
    offMessage: "Imports aren't part of your chambers' plan.",
  },
];

export const FEATURE_BY_KEY: Record<FeatureKey, FeatureMeta> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f])
) as Record<FeatureKey, FeatureMeta>;

const KEY_SET = new Set<string>(FEATURE_KEYS);

function isFeatureKey(k: string): k is FeatureKey {
  return KEY_SET.has(k);
}

/**
 * Normalises whatever came off the Partner document into a plain map.
 *
 * Mongoose hands back a real Map from a hydrated document but a plain
 * object from .lean() — and most of this codebase reads lean — so both
 * shapes have to be accepted. Unknown keys are dropped so a stale switch
 * left behind by a renamed module can't resurrect itself.
 */
export function readFeatures(raw: unknown): FeatureMap {
  if (!raw) return {};
  const entries: [string, unknown][] =
    raw instanceof Map
      ? Array.from(raw.entries())
      : typeof raw === "object"
        ? Object.entries(raw as Record<string, unknown>)
        : [];

  const out: FeatureMap = {};
  for (const [k, v] of entries) {
    if (isFeatureKey(k) && typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Absent means enabled — see the note at the top of this file. */
export function isFeatureEnabled(
  features: FeatureMap | undefined | null,
  key: FeatureKey
): boolean {
  return features?.[key] !== false;
}

/** Every key with an explicit value, for rendering the admin toggles. */
export function fullFeatureMap(
  features: FeatureMap | undefined | null
): Record<FeatureKey, boolean> {
  const out = {} as Record<FeatureKey, boolean>;
  for (const key of FEATURE_KEYS) out[key] = isFeatureEnabled(features, key);
  return out;
}

/**
 * Validates a features object submitted by the admin console. Only known
 * keys with boolean values survive; anything else is ignored rather than
 * rejected, so a client sending an extra field can't 400 the whole save.
 */
export function sanitizeFeatureInput(raw: unknown): FeatureMap | null {
  if (!raw || typeof raw !== "object") return null;
  const out: FeatureMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isFeatureKey(k) && typeof v === "boolean") out[k] = v;
  }
  return out;
}

/* ─── API path → feature ─── */

// Ordered, most specific first. `test` gets the pathname of a partner-side
// request; the first match wins. A path that matches nothing is ungated —
// the dashboard, profile, office settings and the delete-request queue all
// deliberately fall through, because they either aren't a module or span
// several of them.
const API_RULES: { test: (p: string) => boolean; key: FeatureKey }[] = [
  // Data operations are gated before the module they belong to, so an
  // office can keep Case Vault while losing bulk import/export.
  { test: (p) => p.includes("/import"), key: "imports" },
  { test: (p) => /\/export(\/|$)/.test(p), key: "exports" },

  { test: (p) => p.startsWith("/api/app/cases/disposed"), key: "disposed" },
  { test: (p) => p.startsWith("/api/app/cases/bulk-restore"), key: "disposed" },

  { test: (p) => p.startsWith("/api/app/cases"), key: "cases" },
  { test: (p) => p.startsWith("/api/app/clients"), key: "clients" },
  { test: (p) => p.startsWith("/api/app/courts"), key: "courts" },
  { test: (p) => p.startsWith("/api/app/hearings"), key: "hearings" },

  { test: (p) => p.startsWith("/api/app/boards"), key: "workflow" },
  { test: (p) => p.startsWith("/api/app/lists"), key: "workflow" },
  { test: (p) => p.startsWith("/api/app/tasks"), key: "workflow" },
  { test: (p) => p.startsWith("/api/app/edges"), key: "workflow" },

  { test: (p) => p.startsWith("/api/app/chat"), key: "seniorDesk" },
  // Reminders are raised and read inside Senior Desk.
  { test: (p) => p.startsWith("/api/app/reminders"), key: "seniorDesk" },

  { test: (p) => p.startsWith("/api/app/prompts"), key: "ai" },
  { test: (p) => p.startsWith("/api/app/attendance"), key: "attendance" },
  { test: (p) => p.startsWith("/api/app/activity"), key: "activity" },
  { test: (p) => p.startsWith("/api/app/users"), key: "users" },
];

/** Which module a partner-side API path belongs to, if any. */
export function featureForApiPath(pathname: string): FeatureKey | null {
  for (const rule of API_RULES) {
    if (rule.test(pathname)) return rule.key;
  }
  return null;
}
