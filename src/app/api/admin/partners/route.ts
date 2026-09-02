import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { Plan, PLAN_KEY_PATTERN } from "@/models/Plan";
import { User } from "@/models/User";
import { uniquePartnerSlug } from "@/lib/slug";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";

type CreatePartnerInput = {
  name: string;
  primaryEmail: string;
  primaryContactName: string;
  phone: string;
  city?: string;
  state?: string;
  plan: string;
  trialDays: number;
  password: string;
};

function validate(body: unknown): CreatePartnerInput | { error: string } {
  if (!body || typeof body !== "object")
    return { error: "Invalid request body" };
  const b = body as Record<string, unknown>;
  const required = (k: string) =>
    typeof b[k] === "string" && (b[k] as string).trim().length > 0;

  if (!required("name")) return { error: "Chambers name is required" };
  if (!required("primaryEmail")) return { error: "Login email is required" };
  if (!required("primaryContactName"))
    return { error: "Contact name is required" };
  if (!required("phone")) return { error: "Phone is required" };
  if (!required("password")) return { error: "Password is required" };

  const password = b.password as string;
  if (password.length < 6)
    return { error: "Password must be at least 6 characters" };

  // Plan is the key of a Plan document; validate the slug shape here and check
  // that it actually exists in the catalogue in the handler (needs the DB).
  const plan =
    typeof b.plan === "string" ? b.plan.trim().toLowerCase() : "";
  if (!PLAN_KEY_PATTERN.test(plan)) return { error: "Invalid plan" };

  const trialDays = Number(b.trialDays ?? 0);
  if (plan === "trial") {
    if (!Number.isFinite(trialDays) || trialDays < 1 || trialDays > 90)
      return { error: "Trial days must be between 1 and 90" };
  }

  const primaryEmail = (b.primaryEmail as string).toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(primaryEmail))
    return { error: "Login email looks invalid" };

  return {
    name: (b.name as string).trim(),
    primaryEmail,
    primaryContactName: (b.primaryContactName as string).trim(),
    phone: (b.phone as string).trim(),
    city: typeof b.city === "string" ? (b.city as string).trim() : "",
    state: typeof b.state === "string" ? (b.state as string).trim() : "",
    plan,
    trialDays,
    password,
  };
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const docs = await Partner.find({ isDeleted: false })
    .sort({ createdAt: -1 })
    .lean();

  const partners = docs.map((p) => ({
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    primaryEmail: p.primaryEmail,
    primaryContactName: p.primaryContactName,
    phone: p.phone,
    city: p.city,
    state: p.state,
    plan: p.plan,
    status: p.subscription.status,
    startDate: p.subscription.startDate.toISOString(),
    endDate: p.subscription.endDate.toISOString(),
    signupSource: p.signupSource ?? "admin",
    emailVerifiedAt: p.emailVerifiedAt
      ? p.emailVerifiedAt.toISOString()
      : null,
    createdAt: p.createdAt.toISOString(),
  }));

  return NextResponse.json({ partners }, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const parsed = validate(body);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400, headers: corsHeaders() }
    );
  }

  await connectDB();
  const [existingUser, existingPartner, planDoc] = await Promise.all([
    User.findOne({ email: parsed.primaryEmail }),
    Partner.findOne({ primaryEmail: parsed.primaryEmail }),
    Plan.findOne({ key: parsed.plan }).lean(),
  ]);
  if (existingUser || existingPartner) {
    return NextResponse.json(
      {
        error:
          "This email is already in use. Each email can belong to only one chambers.",
      },
      { status: 409, headers: corsHeaders() }
    );
  }
  // The chosen plan must exist in the catalogue. Seat/matter limits are read
  // straight off the Plan doc, so any admin-created plan is assignable and any
  // edit to a plan's limits takes effect for chambers created afterwards.
  if (!planDoc) {
    return NextResponse.json(
      {
        error: `Unknown plan “${parsed.plan}”. Pick a plan that exists in Subscriptions.`,
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  const slug = await uniquePartnerSlug(parsed.name);
  const now = new Date();
  const isTrial = parsed.plan === "trial";
  const subscription = {
    status: (isTrial ? "trial" : "active") as "trial" | "active",
    startDate: now,
    endDate: new Date(
      now.getTime() +
        (isTrial ? parsed.trialDays * 24 * 60 * 60 * 1000 : ONE_YEAR_MS)
    ),
    seatLimit: planDoc.seatLimit,
    matterLimit: planDoc.matterLimit,
  };

  const partner = await Partner.create({
    name: parsed.name,
    slug,
    primaryEmail: parsed.primaryEmail,
    primaryContactName: parsed.primaryContactName,
    phone: parsed.phone,
    city: parsed.city ?? "",
    state: parsed.state ?? "",
    plan: parsed.plan,
    subscription,
  });

  const passwordHash = await bcrypt.hash(parsed.password, 12);
  // Match the My Profile / partner-edit split: first token is the first name,
  // the rest the surname, no "—" placeholder (a no-space name like
  // "G.S.Tejas" stays whole in firstName and shows in full).
  const nameParts = parsed.primaryContactName.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ");

  try {
    await User.create({
      email: parsed.primaryEmail,
      passwordHash,
      firstName,
      lastName,
      userType: "partner_admin",
      // Pin the office role from creation. The pre-save hook on User
      // also enforces this, but being explicit here matches reader
      // expectations and avoids relying on the hook for correctness.
      role: "admin",
      partnerId: partner._id,
      active: true,
    });
  } catch (err) {
    await Partner.deleteOne({ _id: partner._id });
    return NextResponse.json(
      {
        error:
          "Could not create the partner-admin user. The chambers was rolled back.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500, headers: corsHeaders() }
    );
  }

  await logActivity({
    actor: {
      id: guard.ctx.user.id,
      name: `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim(),
      email: guard.ctx.user.email,
      type: "global_admin",
    },
    action: "partner_created",
    targetType: "partner",
    targetId: String(partner._id),
    targetName: partner.name,
    message: `Created chambers ${partner.name} on the ${parsed.plan} plan${
      isTrial ? ` (${parsed.trialDays}-day trial)` : ""
    }.${guard.ctx.isMobile ? " · via mobile" : ""}`,
    metadata: {
      plan: parsed.plan,
      trialDays: isTrial ? parsed.trialDays : null,
      via: guard.ctx.isMobile ? "mobile" : "web",
    },
    partnerId: String(partner._id),
  });

  return NextResponse.json(
    {
      ok: true,
      partner: {
        id: String(partner._id),
        slug: partner.slug,
        name: partner.name,
        primaryEmail: partner.primaryEmail,
      },
    },
    { status: 201, headers: corsHeaders() }
  );
}
