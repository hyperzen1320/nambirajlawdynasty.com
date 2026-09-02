import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { PushToken } from "@/models/PushToken";
import { User } from "@/models/User";

// Push notifications to the mobile app, via Expo's push service.
//
// Why this exists: the in-app bell only counts while the app is open, and
// chambers asked for the Legalezi icon on the home screen to carry a dot
// when something arrives — including with the app swiped away from
// recents. Android only draws that dot for a notification the system has
// actually posted, which means a real push. Nothing else gets there.
//
// Shape is deliberately the same as lib/activity.ts: fire-and-forget, and
// never allowed to fail the request that triggered it. A message that
// saved but couldn't be announced is a message that saved.
//
// No SDK. Expo's endpoint is a plain JSON POST and the whole contract we
// need is "send these, tell me which addresses are dead".

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
// Expo's documented cap per request.
const CHUNK = 100;
// A push is a courtesy; it must not hold a request open. Slow enough for
// a cold connection, short enough that nobody waits on it.
const TIMEOUT_MS = 8000;

export type PushPayload = {
  title: string;
  body: string;
  /** Routed on by the app when the notification is tapped. */
  data?: Record<string, unknown>;
  /** iOS app-icon number. Android draws its dot off the notification. */
  badge?: number;
  /** Groups related notifications in the tray (Android channel key). */
  channelId?: string;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

/**
 * Deliver `payload` to every device the given users have registered.
 *
 * Resolves when the tickets come back (or the attempt is abandoned), and
 * never rejects. Callers should NOT await it if the response shouldn't
 * wait — `void sendPush(...)` is the intended shape.
 */
export async function sendPush(
  partnerId: string,
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  try {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return;

    await connectDB();
    const rows = await PushToken.find({
      partnerId: new mongoose.Types.ObjectId(partnerId),
      userId: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) },
    })
      .select("token")
      .lean();

    const tokens = rows.map((r) => r.token).filter(Boolean);
    if (tokens.length === 0) return;

    for (let i = 0; i < tokens.length; i += CHUNK) {
      const slice = tokens.slice(i, i + CHUNK);
      const tickets = await postChunk(slice, payload);
      if (tickets) await pruneDead(slice, tickets);
    }
  } catch {
    // Deliberately silent. Every caller is a route whose real work has
    // already committed; a push failure must not turn a saved message
    // into a 500.
  }
}

/**
 * Push to everyone in the office who can actually act on it — the
 * delete-request queue is the admin's to sign off, so "who hears about
 * this" is the same role check the approve route makes.
 */
export async function notifyAdmins(
  partnerId: mongoose.Types.ObjectId | string,
  payload: PushPayload
): Promise<void> {
  try {
    await connectDB();
    const admins = await User.find({
      partnerId: new mongoose.Types.ObjectId(String(partnerId)),
      role: "admin",
      active: true,
      isDeleted: false,
    })
      .select("_id")
      .lean();
    await sendPush(
      String(partnerId),
      admins.map((a) => String(a._id)),
      payload
    );
  } catch {
    // Silent for the same reason sendPush is.
  }
}

async function postChunk(
  tokens: string[],
  payload: PushPayload
): Promise<ExpoTicket[] | null> {
  const messages = tokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: "default" as const,
    // Android: HIGH so the notification posts to the tray immediately,
    // which is what puts the dot on the launcher icon.
    priority: "high" as const,
    channelId: payload.channelId ?? "default",
    ...(typeof payload.badge === "number" ? { badge: payload.badge } : {}),
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(EXPO_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: ExpoTicket[] };
    return Array.isArray(json.data) ? json.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Expo answers position-for-position, so ticket[i] belongs to tokens[i].
 * A DeviceNotRegistered means the app was uninstalled, reinstalled, or
 * the token rotated — the row is dead and would otherwise be retried on
 * every send for ever.
 */
async function pruneDead(
  tokens: string[],
  tickets: ExpoTicket[]
): Promise<void> {
  const dead = tokens.filter(
    (_t, i) => tickets[i]?.details?.error === "DeviceNotRegistered"
  );
  if (dead.length === 0) return;
  await PushToken.deleteMany({ token: { $in: dead } });
}
