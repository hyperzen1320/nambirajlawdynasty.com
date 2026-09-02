import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Plan, PLAN_KEY_PATTERN } from "@/models/Plan";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";

const VALID_CYCLES = ["trial", "monthly", "yearly", "bespoke"] as const;

// Keys that collide with a static route segment under /admin/subscriptions and
// therefore can't be used as a plan key (the "add plan" page owns /new).
const RESERVED_KEYS = ["new"];

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const docs = await Plan.find({}).sort({ sortOrder: 1 }).lean();

  const plans = docs.map((p) => ({
    key: p.key,
    label: p.label,
    tagline: p.tagline,
    description: p.description,
    priceAmount: p.priceAmount,
    priceLabel: p.priceLabel,
    priceSuffix: p.priceSuffix,
    billingCycle: p.billingCycle,
    features: p.features,
    seatLimit: p.seatLimit,
    matterLimit: p.matterLimit,
    isTrial: p.isTrial,
    isPopular: p.isPopular,
    showOnLanding: p.showOnLanding,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    ctaLabel: p.ctaLabel,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json({ plans }, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: corsHeaders() }
    );
  }
  const b = body as Record<string, unknown>;

  // Key — required, normalised to a lowercase slug, unique, not reserved.
  const key =
    typeof b.key === "string" ? b.key.trim().toLowerCase() : "";
  if (!PLAN_KEY_PATTERN.test(key)) {
    return NextResponse.json(
      {
        error:
          "Key must be lowercase letters, numbers or hyphens (2–31 chars), starting with a letter or number.",
      },
      { status: 400, headers: corsHeaders() }
    );
  }
  if (RESERVED_KEYS.includes(key)) {
    return NextResponse.json(
      { error: `“${key}” is a reserved key — pick another.` },
      { status: 400, headers: corsHeaders() }
    );
  }

  // Label — required.
  const label = typeof b.label === "string" ? b.label.trim() : "";
  if (!label) {
    return NextResponse.json(
      { error: "Plan label is required" },
      { status: 400, headers: corsHeaders() }
    );
  }

  await connectDB();
  const existing = await Plan.findOne({ key }).lean();
  if (existing) {
    return NextResponse.json(
      { error: `A plan with the key “${key}” already exists.` },
      { status: 409, headers: corsHeaders() }
    );
  }

  // Coercers mirroring the schema's field types + defaults.
  const str = (v: unknown, d = "") => (typeof v === "string" ? v.trim() : d);
  const num = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(0, Math.floor(v))
      : d;
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

  const billingCycle =
    typeof b.billingCycle === "string" &&
    (VALID_CYCLES as readonly string[]).includes(b.billingCycle)
      ? (b.billingCycle as (typeof VALID_CYCLES)[number])
      : "monthly";

  const features = Array.isArray(b.features)
    ? (b.features as unknown[])
        .filter((f): f is string => typeof f === "string")
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
    : [];

  try {
    const plan = await Plan.create({
      key,
      label,
      tagline: str(b.tagline),
      description: str(b.description),
      priceAmount: num(b.priceAmount, 0),
      priceLabel: str(b.priceLabel),
      priceSuffix: str(b.priceSuffix),
      billingCycle,
      features,
      seatLimit: num(b.seatLimit, 1),
      matterLimit: num(b.matterLimit, 100),
      isTrial: bool(b.isTrial, false),
      isPopular: bool(b.isPopular, false),
      showOnLanding: bool(b.showOnLanding, true),
      isActive: bool(b.isActive, true),
      sortOrder: num(b.sortOrder, 0),
      ctaLabel: str(b.ctaLabel, "Get started"),
    });

    await logActivity({
      actor: {
        id: guard.ctx.user.id,
        name: `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim(),
        email: guard.ctx.user.email,
        type: "global_admin",
      },
      action: "plan_created",
      targetType: "system",
      targetId: String(plan._id),
      targetName: plan.label,
      message: `Created subscription plan ${plan.label} (${plan.key}).`,
      metadata: { key: plan.key, via: guard.ctx.isMobile ? "mobile" : "web" },
      partnerId: null,
    });

    // Same invalidation set the PATCH uses so landing + add-partner see it now.
    revalidatePath("/");
    revalidatePath("/admin/subscriptions");
    revalidatePath("/admin/subscriptions/" + plan.key);
    revalidatePath("/admin/partners/new");

    return NextResponse.json(
      {
        ok: true,
        plan: { key: plan.key, label: plan.label },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (err) {
    // Unique-index race: another request created the same key between our
    // pre-check and this insert. Report it as a conflict, not a 500.
    if (
      err &&
      typeof err === "object" &&
      (err as { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: `A plan with the key “${key}” already exists.` },
        { status: 409, headers: corsHeaders() }
      );
    }
    return NextResponse.json(
      { error: "Could not create the plan." },
      { status: 500, headers: corsHeaders() }
    );
  }
}
