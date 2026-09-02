import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { Plan } from "@/models/Plan";
import { User } from "@/models/User";
import { uniquePartnerSlug } from "@/lib/slug";
import { logActivity } from "@/lib/activity";

// Provisioning a new chambers on the free trial.
//
// This is the one place that knows how a self-serve sign-up becomes a
// Partner + its partner-admin User, so the marketing sign-up and anything
// that follows it can't drift apart on trial length or seat limits.

export const TRIAL_PLAN_KEY = "trial";
export const SELF_SIGNUP_TRIAL_DAYS = 7;

// Only used if the Plan catalogue hasn't been seeded on this deployment.
// They match scripts/seed-plans.ts so a fallback and a seeded install give
// a new chambers exactly the same allowance.
const FALLBACK_SEAT_LIMIT = 5;
const FALLBACK_MATTER_LIMIT = 50;

export type SignupPayload = {
  chambersName: string;
  contactName: string;
  phone: string;
  // Already hashed by the time it gets here — the plaintext never leaves
  // the request that collected it.
  passwordHash: string;
};

export type ProvisionResult =
  | {
      ok: true;
      partnerId: string;
      partnerName: string;
      slug: string;
      trialEndsAt: Date;
      seatLimit: number;
    }
  | { ok: false; error: string; status: number };

/**
 * What the Trial plan currently grants. Read from the Plan catalogue so
 * editing Trial in Subscriptions changes both the allowance a new chambers
 * receives AND the promise the sign-up page prints, with no code change.
 * Falls back rather than failing if the catalogue was never seeded.
 */
export async function getTrialAllowance(): Promise<{
  seatLimit: number;
  matterLimit: number;
  seeded: boolean;
}> {
  try {
    await connectDB();
    const planDoc = await Plan.findOne({ key: TRIAL_PLAN_KEY })
      .select("seatLimit matterLimit")
      .lean();
    if (!planDoc) {
      console.warn(
        `[signup] Plan "${TRIAL_PLAN_KEY}" is missing — falling back to ${FALLBACK_SEAT_LIMIT} seats / ${FALLBACK_MATTER_LIMIT} matters. Run: npm run seed:plans`
      );
      return {
        seatLimit: FALLBACK_SEAT_LIMIT,
        matterLimit: FALLBACK_MATTER_LIMIT,
        seeded: false,
      };
    }
    return {
      seatLimit: planDoc.seatLimit,
      matterLimit: planDoc.matterLimit,
      seeded: true,
    };
  } catch (err) {
    // A public page must never 500 because the database blinked.
    console.error("[signup] trial allowance lookup failed:", err);
    return {
      seatLimit: FALLBACK_SEAT_LIMIT,
      matterLimit: FALLBACK_MATTER_LIMIT,
      seeded: false,
    };
  }
}

/** Splits "K.S Nagendhran" into first + rest. A single token stays whole. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * True when the address is free to register. Both collections are checked
 * because a Partner's primaryEmail and a User's email are independently
 * unique, and either one colliding breaks login routing.
 */
export async function emailAvailable(email: string): Promise<boolean> {
  await connectDB();
  const [user, partner] = await Promise.all([
    User.findOne({ email }).select("_id").lean(),
    Partner.findOne({ primaryEmail: email }).select("_id").lean(),
  ]);
  return !user && !partner;
}

/**
 * Creates the chambers and its partner-admin in one go. Rolls the Partner
 * back if the User can't be created, so a failed sign-up never leaves an
 * orphaned tenant nobody can log into — same guarantee the global-admin
 * create route gives.
 */
export async function provisionTrialChambers(args: {
  email: string;
  payload: SignupPayload;
}): Promise<ProvisionResult> {
  const email = args.email.trim().toLowerCase();
  const { chambersName, contactName, phone, passwordHash } = args.payload;

  await connectDB();

  // Re-check at the last moment: the address was free when the code was
  // mailed, but that was up to ten minutes ago.
  if (!(await emailAvailable(email))) {
    return {
      ok: false,
      status: 409,
      error:
        "That email now belongs to another account. Sign in instead, or use a different address.",
    };
  }

  const { seatLimit, matterLimit } = await getTrialAllowance();

  const now = new Date();
  const trialEndsAt = new Date(
    now.getTime() + SELF_SIGNUP_TRIAL_DAYS * 24 * 60 * 60 * 1000
  );
  const slug = await uniquePartnerSlug(chambersName);

  const partner = await Partner.create({
    name: chambersName,
    slug,
    primaryEmail: email,
    primaryContactName: contactName,
    phone,
    plan: TRIAL_PLAN_KEY,
    subscription: {
      status: "trial",
      startDate: now,
      endDate: trialEndsAt,
      seatLimit,
      matterLimit,
    },
    signupSource: "self",
    emailVerifiedAt: now,
  });

  const { firstName, lastName } = splitName(contactName);

  try {
    await User.create({
      email,
      passwordHash,
      firstName,
      lastName,
      userType: "partner_admin",
      role: "admin",
      partnerId: partner._id,
      phone,
      active: true,
    });
  } catch (err) {
    await Partner.deleteOne({ _id: partner._id });
    console.error("[signup] user create failed, chambers rolled back:", err);
    return {
      ok: false,
      status: 500,
      error:
        "We couldn't finish setting up your chambers. Nothing was saved — please try again.",
    };
  }

  await logActivity({
    actor: {
      id: null,
      name: contactName,
      email,
      type: "system",
    },
    action: "partner_created",
    targetType: "partner",
    targetId: String(partner._id),
    targetName: partner.name,
    message: `${contactName} signed ${partner.name} up for a ${SELF_SIGNUP_TRIAL_DAYS}-day trial (self sign-up, email verified).`,
    metadata: {
      plan: TRIAL_PLAN_KEY,
      trialDays: SELF_SIGNUP_TRIAL_DAYS,
      seatLimit,
      via: "self_signup",
    },
    partnerId: String(partner._id),
  });

  return {
    ok: true,
    partnerId: String(partner._id),
    partnerName: partner.name,
    slug: partner.slug,
    trialEndsAt,
    seatLimit,
  };
}
