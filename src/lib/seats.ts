import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { Plan } from "@/models/Plan";
import { User } from "@/models/User";

// Seat accounting for an office.
//
// `subscription.seatLimit` has been carried on every Partner since the
// model was written and is set from the plan at create/edit time — but
// nothing ever read it, so a chambers on the 5-seat Trial could add
// twenty-five people. This is the one place that answers "how many seats
// are in use, and is there room for one more?", so the API guard and the
// UI meter can never disagree.
//
// What consumes a seat: an active, non-deleted user, INCLUDING the
// partner admin — they're a person in the office like anyone else, and
// the Trial's "up to 5 users" is meant to mean five people in total.
//
// A DEACTIVATED user does not consume one. An office that loses a clerk
// can deactivate them (keeping their name on old activity rows) and hire
// a replacement without being charged for both. Re-activating is
// therefore also a seat-taking action and is checked the same way.

export type SeatStatus = {
  used: number;
  /** 0 or less means the plan doesn't cap seats. */
  limit: number;
  unlimited: boolean;
  /** Seats still available. `null` when unlimited. */
  remaining: number | null;
  atCap: boolean;
  planKey: string;
  planLabel: string;
};

export async function getSeatStatus(
  partnerId: string | mongoose.Types.ObjectId
): Promise<SeatStatus> {
  await connectDB();
  const pid =
    typeof partnerId === "string"
      ? new mongoose.Types.ObjectId(partnerId)
      : partnerId;

  const [partner, used] = await Promise.all([
    Partner.findById(pid).select("plan subscription.seatLimit").lean(),
    User.countDocuments({ partnerId: pid, isDeleted: false, active: true }),
  ]);

  const limit = partner?.subscription?.seatLimit ?? 0;
  const planKey = partner?.plan ?? "";
  const unlimited = !Number.isFinite(limit) || limit <= 0;

  // The plan's display label is only needed for the message, and only when
  // there IS a limit worth naming.
  let planLabel = planKey;
  if (!unlimited && planKey) {
    const plan = await Plan.findOne({ key: planKey }).select("label").lean();
    if (plan?.label) planLabel = plan.label;
  }

  return {
    used,
    limit,
    unlimited,
    remaining: unlimited ? null : Math.max(0, limit - used),
    atCap: !unlimited && used >= limit,
    planKey,
    planLabel,
  };
}

/**
 * The message shown when someone tries to take a seat that isn't there.
 * Names the plan and the number so the admin knows exactly what to ask
 * Legalezi for.
 */
export function seatLimitMessage(status: SeatStatus, action: "add" | "activate"): string {
  const plan = status.planLabel || status.planKey || "current";
  const verb =
    action === "add"
      ? "add another person"
      : "switch this person back on";
  return `Your ${plan} plan includes ${status.limit} ${
    status.limit === 1 ? "user" : "users"
  }, and all ${status.limit} are in use. Deactivate someone first, or contact Legalezi to move to a larger plan, to ${verb}.`;
}
