import mongoose from "mongoose";
import { ChatRoom, type IChatRoom } from "@/models/ChatRoom";
import { User } from "@/models/User";

// Helpers around the ChatRoom collection. Two responsibilities:
//
//   1. Compute the deterministic `pairKey` for a private room so two
//      simultaneous "open chat with B" requests hit the same upsert and
//      can never create duplicate rooms.
//   2. Provide get-or-create wrappers for both flavours so call sites
//      don't have to remember the partial-index incantation.

/**
 * Sorted pair key used to uniquely identify a private room between two
 * users in the same partner office. Sorting guarantees that the order in
 * which the two ids are passed doesn't matter — both directions resolve
 * to the same key.
 */
export function pairKeyFor(
  userIdA: mongoose.Types.ObjectId | string,
  userIdB: mongoose.Types.ObjectId | string
): string {
  const a = String(userIdA);
  const b = String(userIdB);
  if (a === b) {
    throw new Error("pairKeyFor: cannot create a private room with yourself");
  }
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Atomically get-or-create the single group room for a partner. Membership
 * is implicit (every active user is a member), so there's no member array
 * to maintain — just title + denormalised last-message fields.
 */
export async function getOrCreateGroupRoom(
  partnerId: mongoose.Types.ObjectId,
  partnerName: string
): Promise<IChatRoom> {
  // The unique partial index on (partnerId, type=group) guarantees that
  // two concurrent first-visits won't create two group rooms — the second
  // upsert resolves to the existing doc.
  const room = await ChatRoom.findOneAndUpdate(
    { partnerId, type: "group" },
    {
      $setOnInsert: {
        partnerId,
        type: "group",
        title: partnerName || "Group Chat",
        members: [],
        pairKey: null,
        lastMessageAt: null,
        lastMessagePreview: "",
        lastMessageAuthorId: null,
        isDeleted: false,
      },
    },
    { new: true, upsert: true }
  );
  if (!room) {
    throw new Error("Failed to get-or-create group room");
  }
  return room;
}

/**
 * Atomically get-or-create the private room between two users in the same
 * partner office. The unique sparse index on (partnerId, pairKey) is what
 * makes this race-free.
 */
export async function getOrCreatePrivateRoom(
  partnerId: mongoose.Types.ObjectId,
  userIdA: mongoose.Types.ObjectId,
  userIdB: mongoose.Types.ObjectId
): Promise<IChatRoom> {
  const key = pairKeyFor(userIdA, userIdB);
  // Sort the members array in the same order as the key so reads are
  // predictable and the array order matches the key for debugging.
  const sortedMembers =
    String(userIdA) < String(userIdB)
      ? [userIdA, userIdB]
      : [userIdB, userIdA];

  const room = await ChatRoom.findOneAndUpdate(
    { partnerId, pairKey: key },
    {
      $setOnInsert: {
        partnerId,
        type: "private",
        title: "",
        members: sortedMembers,
        pairKey: key,
        lastMessageAt: null,
        lastMessagePreview: "",
        lastMessageAuthorId: null,
        isDeleted: false,
      },
    },
    { new: true, upsert: true }
  );
  if (!room) {
    throw new Error("Failed to get-or-create private room");
  }
  return room;
}

/**
 * Authorisation check used by every "read this room" query. Group rooms
 * are open to every active user in the partner; private rooms require
 * membership. Returns false for cross-partner attempts.
 *
 * The deactivation/removal check happens upstream in `requirePartner` —
 * a deactivated user can't reach this code path at all.
 */
export function userCanReadRoom(
  room: Pick<IChatRoom, "partnerId" | "type" | "members">,
  partnerId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string
): boolean {
  if (String(room.partnerId) !== String(partnerId)) return false;
  if (room.type === "group") return true;
  return room.members.some((m) => String(m) === String(userId));
}

/**
 * Everyone who should hear about a new message in this room, minus its
 * author. The membership rule is the same one `userCanReadRoom` encodes:
 * a private room carries its two members, and a group room's membership
 * is implicit — every active advocate in the office — so the roster has
 * to be read for it.
 *
 * Used by the push sender. Kept here so "who is in this room" has one
 * answer rather than one per caller.
 */
export async function recipientsOf(
  room: Pick<IChatRoom, "type" | "members">,
  partnerId: mongoose.Types.ObjectId | string,
  senderId: mongoose.Types.ObjectId | string
): Promise<string[]> {
  const sender = String(senderId);
  if (room.type === "private") {
    return room.members.map(String).filter((id) => id !== sender);
  }
  const users = await User.find({
    partnerId: new mongoose.Types.ObjectId(String(partnerId)),
    active: true,
    isDeleted: false,
  })
    .select("_id")
    .lean();
  return users.map((u) => String(u._id)).filter((id) => id !== sender);
}

/**
 * 80-char preview used for the room rail. Strips newlines so a multi-line
 * message renders as a single line, and trims trailing whitespace.
 */
export function previewFromBody(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length <= 80 ? flat : `${flat.slice(0, 77)}…`;
}
