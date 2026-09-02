"use client";

// Generic optimistic mutation primitive. Use it whenever the local state
// can be updated immediately and the server can confirm later.
//
// The four callbacks fully decouple the local store shape from this hook:
//
//   buildTemp(input) -> a temporary entity with a synthesized id (we
//                       prefix temp ids with "tmp:" so renderers can detect
//                       and style "saving…" state)
//   insert(temp)    -> add the temp entity to local state
//   send(input)     -> hit the server; resolve with the real entity
//   swap(tempId, real) -> replace temp with server response (or just remove
//                         and re-insert if the shape isn't id-stable)
//   remove(tempId)  -> rollback on failure
//
// On error we throw so callers can surface a toast or whatever feedback
// makes sense at the call site.

import { useCallback, useRef } from "react";

type Args<Input, Result> = {
  buildTemp: (input: Input, tempId: string) => Result;
  insert: (temp: Result) => void;
  send: (input: Input) => Promise<Result>;
  swap: (tempId: string, real: Result) => void;
  remove: (tempId: string) => void;
};

export const TEMP_ID_PREFIX = "tmp:";
export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX);
}

let counter = 0;
function newTempId(): string {
  counter = (counter + 1) % 1_000_000;
  return `${TEMP_ID_PREFIX}${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function useOptimisticAction<Input, Result>(args: Args<Input, Result>) {
  // Capture the latest callbacks via ref so the returned function is
  // stable across renders. Most callers wrap the returned `run` in a
  // useCallback dep list — having it stable prevents needless re-renders.
  const ref = useRef(args);
  ref.current = args;

  return useCallback(async (input: Input) => {
    const tempId = newTempId();
    const { buildTemp, insert, send, swap, remove } = ref.current;
    const temp = buildTemp(input, tempId);
    insert(temp);
    try {
      const real = await send(input);
      swap(tempId, real);
      return real;
    } catch (err) {
      remove(tempId);
      throw err;
    }
  }, []);
}
