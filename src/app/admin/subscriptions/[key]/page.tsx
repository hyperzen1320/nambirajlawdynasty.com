import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Plan, CANONICAL_PLAN_KEYS } from "@/models/Plan";
import EditPlanForm from "./EditPlanForm";
import DeletePlanZone from "./DeletePlanZone";

export default async function PlanEditPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  await connectDB();

  const planDoc = await Plan.findOne({ key }).lean();
  if (!planDoc) notFound();

  const plan = {
    key: planDoc.key,
    label: planDoc.label,
    tagline: planDoc.tagline,
    description: planDoc.description,
    priceAmount: planDoc.priceAmount,
    priceLabel: planDoc.priceLabel,
    priceSuffix: planDoc.priceSuffix,
    billingCycle: planDoc.billingCycle,
    features: planDoc.features,
    seatLimit: planDoc.seatLimit,
    matterLimit: planDoc.matterLimit,
    isTrial: planDoc.isTrial,
    isPopular: planDoc.isPopular,
    showOnLanding: planDoc.showOnLanding,
    isActive: planDoc.isActive,
    sortOrder: planDoc.sortOrder,
    ctaLabel: planDoc.ctaLabel,
    updatedAt: planDoc.updatedAt.toISOString(),
  };

  return (
    <div className="mx-auto max-w-[1000px]">
      {/* Breadcrumb + header */}
      <div className="fade-up-sm">
        <Link
          href="/admin/subscriptions"
          className="inline-flex items-center gap-1.5 text-[12px] text-admin-fg-muted transition-colors hover:text-admin-fg"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          <span>←</span> Subscriptions
        </Link>

        <div className="mt-6 flex items-start justify-between gap-6">
          <div>
            <div
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-admin-accent"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Edit plan · /{plan.key}
            </div>
            <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-admin-fg">
              {plan.label}
            </h2>
            <p
              className="mt-2 text-[12px] text-admin-fg-muted"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Last edited{" "}
              {new Date(plan.updatedAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <EditPlanForm plan={plan} />
      </div>

      <div className="mt-8">
        <DeletePlanZone
          planKey={plan.key}
          planLabel={plan.label}
          isCanonical={(CANONICAL_PLAN_KEYS as readonly string[]).includes(
            plan.key
          )}
        />
      </div>
    </div>
  );
}
