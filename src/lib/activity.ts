import mongoose from "mongoose";
import { Activity, type ActivityTargetType } from "@/models/Activity";
import { redisSafe, keys } from "@/lib/upstash";

type ActorType = "global_admin" | "partner_admin" | "user" | "system";

type LogActivityArgs = {
  actor: {
    id: string | null;
    name: string;
    email: string;
    type: ActorType;
  };
  action: string;
  targetType: ActivityTargetType;
  targetId?: string | null;
  targetName?: string;
  message: string;
  metadata?: Record<string, unknown>;
  partnerId?: string | null;
  boardId?: string | null;
};

export async function logActivity(args: LogActivityArgs): Promise<void> {
  try {
    const doc = await Activity.create({
      actorUserId: args.actor.id
        ? new mongoose.Types.ObjectId(args.actor.id)
        : null,
      actorName: args.actor.name,
      actorEmail: args.actor.email,
      actorType: args.actor.type,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId
        ? new mongoose.Types.ObjectId(args.targetId)
        : null,
      targetName: args.targetName ?? "",
      message: args.message,
      metadata: args.metadata ?? {},
      partnerId: args.partnerId
        ? new mongoose.Types.ObjectId(args.partnerId)
        : null,
      boardId: args.boardId
        ? new mongoose.Types.ObjectId(args.boardId)
        : null,
    });

    // Publish the new id to Upstash so polling clients can short-circuit
    // their "anything new?" probe without hitting Mongo. We store the
    // ObjectId as a string — clients use ObjectId-comparison semantics
    // because ObjectIds embed a timestamp + counter.
    if (args.partnerId) {
      const id = String(doc._id);
      await Promise.all([
        redisSafe.set(keys.partnerLatestActivity(args.partnerId), id),
        args.boardId
          ? redisSafe.set(
              keys.boardLatestActivity(args.partnerId, args.boardId),
              id
            )
          : Promise.resolve(null),
      ]);
    }
  } catch (err) {
    // Don't crash the parent operation if activity logging fails.
    console.error("[activity] failed to log:", err);
  }
}

/**
 * Convenience wrapper for partner-side workflow actions. Pulls actor from a
 * partner-auth context and tags every entry with partnerId + boardId for
 * fast feed queries.
 */
export type PartnerActorCtx = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userType: "partner_admin" | "user";
    partnerId: string;
  };
};

export async function logWorkflowActivity(
  ctx: PartnerActorCtx,
  args: {
    action: string;
    targetType: ActivityTargetType;
    targetId?: string | null;
    targetName?: string;
    message: string;
    metadata?: Record<string, unknown>;
    boardId?: string | null;
  }
): Promise<void> {
  const u = ctx.user;
  const name = `${u.firstName} ${u.lastName}`.trim() || u.email;
  await logActivity({
    actor: {
      id: u.id,
      name,
      email: u.email,
      type: u.userType,
    },
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId ?? null,
    targetName: args.targetName ?? "",
    message: args.message,
    metadata: args.metadata ?? {},
    partnerId: u.partnerId,
    boardId: args.boardId ?? null,
  });
}
