import type { Field } from "@/cms/fields";

// Immutable helpers for the editor's form state. List items carry a client-only
// `_key` so React can keep each card's identity (and open/closed state) while
// items are reordered; the key is stripped before saving, and the server's
// sanitizer would drop it anyway.

export type Key = string | number;
export type Obj = Record<string, unknown> & { _key?: string };

let seq = 0;
export const nextKey = () => `item-${++seq}`;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export function getIn(value: unknown, path: readonly Key[]): unknown {
  let cur = value;
  for (const k of path) {
    if (cur == null) return undefined;
    cur = (cur as Record<Key, unknown>)[k];
  }
  return cur;
}

export function setIn(value: unknown, path: readonly Key[], next: unknown): unknown {
  if (!path.length) return next;
  const [k, ...rest] = path;
  if (Array.isArray(value)) {
    const copy = value.slice();
    copy[k as number] = setIn(copy[k as number], rest, next);
    return copy;
  }
  const obj = isObj(value) ? value : {};
  return { ...obj, [k]: setIn(obj[k as string], rest, next) };
}

export function emptyValue(field: Field): unknown {
  switch (field.type) {
    case "boolean":
      return false;
    case "select":
      return field.options[0]?.value ?? "";
    case "lines":
    case "list":
      return [];
    case "group":
      return emptyObject(field.fields);
    default:
      return "";
  }
}

export function emptyObject(fields: readonly Field[]): Obj {
  return Object.fromEntries(fields.map((f) => [f.name, emptyValue(f)]));
}

/** Adds `_key`s to every list item, reusing keys from `prev` position by position. */
export function withKeys(fields: readonly Field[], value: unknown, prev?: unknown): Obj {
  const obj: Obj = isObj(value) ? { ...value } : {};
  const before = isObj(prev) ? prev : undefined;
  for (const f of fields) {
    if (f.type === "group") {
      obj[f.name] = withKeys(f.fields, obj[f.name], before?.[f.name]);
    } else if (f.type === "list") {
      const items = Array.isArray(obj[f.name]) ? (obj[f.name] as unknown[]) : [];
      const prevItems = Array.isArray(before?.[f.name]) ? (before[f.name] as unknown[]) : [];
      obj[f.name] = items.map((item, i) => {
        const p = prevItems[i];
        return {
          ...withKeys(f.fields, item, p),
          _key: (isObj(p) && typeof p._key === "string" ? p._key : undefined) ?? nextKey(),
        };
      });
    }
  }
  return obj;
}

export function stripKeys<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (k, v) => (k === "_key" ? undefined : v)));
}
