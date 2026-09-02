// Same-browser fan-out for activity events. When a user takes an action
// in tab A, we want tab B (same browser, same user) to see it instantly
// without waiting for its next poll cycle. BroadcastChannel does exactly
// that and is supported in every modern browser; for ancient Safari we
// fall back to a localStorage-event shim that ScopeOut also uses.

export type LocalActivityMessage = {
  kind: "activity";
  partnerId: string;
  boardId: string | null;
  // The full ActivityRow shape — kept loose here to avoid a circular
  // import; the consumer asserts the shape.
  row: unknown;
};

export type SubscribeFn = (msg: LocalActivityMessage) => void;

// Some browsers (older Safari) lack BroadcastChannel. We fall back to
// localStorage `storage` events which only fire in OTHER tabs — exactly
// the same semantics for our use case.
function hasBroadcastChannel(): boolean {
  return typeof window !== "undefined" && "BroadcastChannel" in window;
}

const CHANNEL_NAME = "legaleasy-live-v1";
const FALLBACK_KEY = "legaleasy:bc-fallback";

let _bc: BroadcastChannel | null = null;
function bc(): BroadcastChannel | null {
  if (!hasBroadcastChannel()) return null;
  if (_bc) return _bc;
  _bc = new BroadcastChannel(CHANNEL_NAME);
  return _bc;
}

export function publishLocal(msg: LocalActivityMessage): void {
  if (typeof window === "undefined") return;
  const channel = bc();
  if (channel) {
    try {
      channel.postMessage(msg);
      return;
    } catch {
      // fall through to localStorage fallback
    }
  }
  try {
    // Wrap with timestamp so identical payloads still trigger storage events
    localStorage.setItem(
      FALLBACK_KEY,
      JSON.stringify({ at: Date.now(), msg })
    );
  } catch {
    // localStorage may be disabled — give up silently
  }
}

export function subscribeLocal(handler: SubscribeFn): () => void {
  if (typeof window === "undefined") return () => {};

  const channel = bc();
  if (channel) {
    const onMessage = (e: MessageEvent<LocalActivityMessage>) => {
      if (e.data && e.data.kind === "activity") handler(e.data);
    };
    channel.addEventListener("message", onMessage);
    return () => channel.removeEventListener("message", onMessage);
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key !== FALLBACK_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as { msg: LocalActivityMessage };
      if (parsed.msg && parsed.msg.kind === "activity") handler(parsed.msg);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
