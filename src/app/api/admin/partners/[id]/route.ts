import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { Plan, PLAN_KEY_PATTERN } from "@/models/Plan";
import { User } from "@/models/User";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";
import {
  FEATURE_BY_KEY,
  FEATURE_KEYS,
  fullFeatureMap,
  isFeatureEnabled,
  readFeatures,
  sanitizeFeatureInput,
} from "@/lib/features";

type Status = "trial" | "active" | "past_due" | "cancelled" | "suspended";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: corsHeaders() }
    );
  }

  await connectDB();
  const partner = await Partner.findById(id).lean();
  if (!partner) {
    return NextResponse.json(
      { error: "Partner not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  const partnerAdmin = await User.findOne({
    partnerId: partner._id,
    userType: "partner_admin",
    isDeleted: false,
  }).lean();

  return NextResponse.json(
    {
      partner: {
        id: String(partner._id),
        name: partner.name,
        slug: partner.slug,
        primaryEmail: partner.primaryEmail,
        primaryContactName: partner.primaryContactName,
        phone: partner.phone,
        city: partner.city,
        state: partner.state,
        plan: partner.plan,
        subscription: {
          status: partner.subscription.status,
          startDate: partner.subscription.startDate.toISOString(),
          endDate: partner.subscription.endDate.toISOString(),
          seatLimit: partner.subscription.seatLimit,
          matterLimit: partner.subscription.matterLimit,
        },
        features: fullFeatureMap(readFeatures(partner.features)),
        isDeleted: partner.isDeleted,
        createdAt: partner.createdAt.toISOString(),
        updatedAt: partner.updatedAt.toISOString(),
      },
      partnerAdmin: partnerAdmin
        ? { id: String(partnerAdmin._id), email: partnerAdmin.email }
        : null,
    },
    { headers: corsHeaders() }
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: corsHeaders() }
    );
  }

  await connectDB();
  const partner = await Partner.findById(id);
  if (!partner) {
    return NextResponse.json(
      { error: "Partner not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  type Diff = { field: string; before: unknown; after: unknown };
  const changes: Diff[] = [];
  let activityAction = "partner_updated";

  const fields = [
    "name",
    "primaryContactName",
    "phone",
    "city",
    "state",
  ] as const;
  for (const f of fields) {
    if (typeof body[f] === "string" && body[f] !== partner[f]) {
      const trimmed = (body[f] as string).trim();
      if (trimmed) {
        const before = partner[f];
        partner[f] = trimmed;
        changes.push({ field: f, before, after: trimmed });
      }
    }
  }

  // Keep the partner-admin user's name in sync with the Contact Name — the
  // dashboard, sidebar and profile all read that User (via the session), so
  // editing Contact Name here must propagate to it. Runs even on an unchanged
  // save, so a stale legacy name reconciles with a single Save.
  if (typeof body.primaryContactName === "string") {
    const trimmed = body.primaryContactName.trim();
    if (trimmed) {
      const parts = trimmed.split(/\s+/);
      await User.updateOne(
        { partnerId: partner._id, userType: "partner_admin", isDeleted: false },
        { $set: { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") } }
      );
    }
  }

  if (typeof body.plan === "string" && body.plan !== partner.plan) {
    const nextPlan = body.plan.trim().toLowerCase();
    if (!PLAN_KEY_PATTERN.test(nextPlan)) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400, headers: corsHeaders() }
      );
    }
    // Limits follow the chosen Plan doc (same as partner creation), so any
    // admin-created plan is assignable to an existing office too.
    const planDoc = await Plan.findOne({ key: nextPlan }).lean();
    if (!planDoc) {
      return NextResponse.json(
        {
          error: `Unknown plan “${nextPlan}”. Pick a plan that exists in Subscriptions.`,
        },
        { status: 400, headers: corsHeaders() }
      );
    }
    const beforePlan = partner.plan;
    partner.plan = nextPlan;
    partner.subscription.seatLimit = planDoc.seatLimit;
    partner.subscription.matterLimit = planDoc.matterLimit;
    if (nextPlan !== "trial" && partner.subscription.status === "trial") {
      partner.subscription.status = "active";
      partner.subscription.startDate = new Date();
      partner.subscription.endDate = new Date(Date.now() + ONE_YEAR_MS);
    }
    changes.push({ field: "plan", before: beforePlan, after: nextPlan });
    activityAction = "partner_plan_changed";
  }

  if (typeof body.subscriptionStatus === "string") {
    const newStatus = body.subscriptionStatus as Status;
    if (
      !["trial", "active", "past_due", "cancelled", "suspended"].includes(
        newStatus
      )
    ) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (newStatus !== partner.subscription.status) {
      const old = partner.subscription.status;
      partner.subscription.status = newStatus;
      changes.push({ field: "status", before: old, after: newStatus });
      if (newStatus === "suspended") activityAction = "partner_suspended";
      else if (old === "suspended" && newStatus === "active")
        activityAction = "partner_unsuspended";
    }
  }

  if (typeof body.extendTrialDays === "number" && body.extendTrialDays > 0) {
    if (partner.subscription.status !== "trial") {
      return NextResponse.json(
        { error: "Can only extend a trial subscription" },
        { status: 400, headers: corsHeaders() }
      );
    }
    const days = Math.min(90, Math.max(1, Math.floor(body.extendTrialDays)));
    const before = new Date(partner.subscription.endDate).toISOString();
    const base = Math.max(
      Date.now(),
      new Date(partner.subscription.endDate).getTime()
    );
    partner.subscription.endDate = new Date(base + days * ONE_DAY_MS);
    changes.push({
      field: "trialEndDate",
      before,
      after: partner.subscription.endDate.toISOString(),
    });
    changes.push({ field: "trialExtendedBy", before: 0, after: days });
    activityAction = "partner_trial_extended";
  }

  // Module switches. The client sends the FULL map (every key with an
  // explicit boolean), so this is a straight replace rather than a merge —
  // a key going missing would otherwise silently mean "leave as-is" and a
  // switch-off could be lost. Only keys that actually moved are recorded,
  // so the activity row reads like a change list rather than a dump.
  if (body.features !== undefined) {
    const incoming = sanitizeFeatureInput(body.features);
    if (!incoming) {
      return NextResponse.json(
        { error: "Invalid modules payload" },
        { status: 400, headers: corsHeaders() }
      );
    }
    const before = readFeatures(partner.features);
    const turnedOff: string[] = [];
    const turnedOn: string[] = [];
    for (const key of FEATURE_KEYS) {
      const wasOn = isFeatureEnabled(before, key);
      const nowOn = incoming[key] !== false;
      if (wasOn && !nowOn) turnedOff.push(FEATURE_BY_KEY[key].label);
      if (!wasOn && nowOn) turnedOn.push(FEATURE_BY_KEY[key].label);
    }

    if (turnedOff.length > 0 || turnedOn.length > 0) {
      // Store only what's switched OFF. An absent key means enabled, so the
      // document stays empty for the common "everything on" case and no
      // existing chambers ever needed migrating.
      const stored = new Map<string, boolean>();
      for (const key of FEATURE_KEYS) {
        if (incoming[key] === false) stored.set(key, false);
      }
      partner.features = stored.size > 0 ? stored : undefined;
      changes.push({
        field: "features",
        before: turnedOn,
        after: turnedOff,
      });
      activityAction = "partner_features_changed";
    }
  }

  if (changes.length === 0) {
    return NextResponse.json(
      { error: "No changes to save" },
      { status: 400, headers: corsHeaders() }
    );
  }

  await partner.save();

  await logActivity({
    actor: {
      id: guard.ctx.user.id,
      name: `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim(),
      email: guard.ctx.user.email,
      type: "global_admin",
    },
    action: activityAction,
    targetType: "partner",
    targetId: String(partner._id),
    targetName: partner.name,
    message:
      activityAction === "partner_trial_extended"
        ? `Extended ${partner.name}'s trial.`
        : activityAction === "partner_suspended"
          ? `Suspended ${partner.name}.`
          : activityAction === "partner_unsuspended"
            ? `Unsuspended ${partner.name}.`
            : activityAction === "partner_plan_changed"
              ? `Changed ${partner.name}'s plan.`
              : activityAction === "partner_features_changed"
                ? `Changed which modules ${partner.name} can use.`
                : `Updated ${partner.name}.`,
    metadata: { changes, via: guard.ctx.isMobile ? "mobile" : "web" },
    partnerId: String(partner._id),
  });

  return NextResponse.json(
    { ok: true, changes: changes.map((c) => c.field) },
    { headers: corsHeaders() }
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: corsHeaders() }
    );
  }

  await connectDB();
  const partner = await Partner.findById(id);
  if (!partner) {
    return NextResponse.json(
      { error: "Partner not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  partner.isDeleted = true;
  partner.subscription.status = "cancelled";
  await partner.save();

  await User.updateMany(
    { partnerId: partner._id },
    { $set: { active: false } }
  );

  await logActivity({
    actor: {
      id: guard.ctx.user.id,
      name: `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim(),
      email: guard.ctx.user.email,
      type: "global_admin",
    },
    action: "partner_deleted",
    targetType: "partner",
    targetId: String(partner._id),
    targetName: partner.name,
    message: `Deleted chambers ${partner.name}. All users locked out.`,
    metadata: { via: guard.ctx.isMobile ? "mobile" : "web" },
    partnerId: String(partner._id),
  });

  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
