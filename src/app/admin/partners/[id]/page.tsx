import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { User } from "@/models/User";
import EditPartnerForm from "./EditPartnerForm";
import PasswordResetForm from "./PasswordResetForm";
import DangerZone from "./DangerZone";
import ModulesForm from "./ModulesForm";
import { fullFeatureMap, readFeatures } from "@/lib/features";

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectDB();

  const partnerDoc = await Partner.findById(id).lean();
  if (!partnerDoc) notFound();

  const partnerAdmin = await User.findOne({
    partnerId: partnerDoc._id,
    userType: "partner_admin",
    isDeleted: false,
  }).lean();

  const partner = {
    id: String(partnerDoc._id),
    name: partnerDoc.name,
    slug: partnerDoc.slug,
    primaryEmail: partnerDoc.primaryEmail,
    primaryContactName: partnerDoc.primaryContactName,
    phone: partnerDoc.phone,
    address: partnerDoc.address,
    city: partnerDoc.city,
    state: partnerDoc.state,
    plan: partnerDoc.plan as "trial" | "solo" | "office" | "chambers",
    subscription: {
      status: partnerDoc.subscription.status,
      startDate: partnerDoc.subscription.startDate.toISOString(),
      endDate: partnerDoc.subscription.endDate.toISOString(),
      seatLimit: partnerDoc.subscription.seatLimit,
      matterLimit: partnerDoc.subscription.matterLimit,
    },
    features: fullFeatureMap(readFeatures(partnerDoc.features)),
    signupSource: partnerDoc.signupSource ?? "admin",
    emailVerifiedAt: partnerDoc.emailVerifiedAt
      ? partnerDoc.emailVerifiedAt.toISOString()
      : null,
    createdAt: partnerDoc.createdAt.toISOString(),
    updatedAt: partnerDoc.updatedAt.toISOString(),
    isDeleted: partnerDoc.isDeleted,
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Breadcrumb + Header */}
      <div className="fade-up-sm">
        <Link
          href="/admin/partners"
          className="inline-flex items-center gap-1.5 text-[12px] text-admin-fg-muted transition-colors hover:text-admin-fg"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          <span>←</span> Partners
        </Link>

        <div className="mt-6 flex items-start justify-between gap-6">
          <div>
            <div
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-admin-accent"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Chambers · /{partner.slug}
              {partner.signupSource === "self" && (
                <>
                  <span className="mx-2 opacity-40">·</span>
                  <span className="text-admin-fg-muted">
                    {partner.emailVerifiedAt
                      ? "Self sign-up · email verified"
                      : "Self sign-up"}
                  </span>
                </>
              )}
            </div>
            <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-admin-fg">
              {partner.name}
            </h2>
            <p
              className="mt-2 text-[12px] text-admin-fg-muted"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              Created{" "}
              {new Date(partner.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}{" "}
              · last updated{" "}
              {new Date(partner.updatedAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <StatusPill status={partner.subscription.status} />
        </div>
      </div>

      <div className="mt-10 space-y-6">
        <EditPartnerForm partner={partner} />
        <ModulesForm
          partnerId={partner.id}
          partnerName={partner.name}
          initialFeatures={partner.features}
        />
        <PasswordResetForm
          partnerId={partner.id}
          partnerName={partner.name}
          loginEmail={partner.primaryEmail}
          partnerAdminId={partnerAdmin ? String(partnerAdmin._id) : null}
        />
        <DangerZone
          partnerId={partner.id}
          partnerName={partner.name}
          status={partner.subscription.status}
        />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; dot: string }> = {
    active: { bg: "bg-admin-accent-soft", fg: "text-admin-accent", dot: "bg-admin-accent" },
    trial: { bg: "bg-admin-saffron-soft", fg: "text-admin-saffron", dot: "bg-admin-saffron" },
    past_due: { bg: "bg-admin-warning-soft", fg: "text-admin-warning", dot: "bg-admin-warning" },
    cancelled: { bg: "bg-admin-danger-soft", fg: "text-admin-danger", dot: "bg-admin-danger" },
    suspended: { bg: "bg-admin-danger-soft", fg: "text-admin-danger", dot: "bg-admin-danger" },
  };
  const s = map[status] ?? map.trial;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] ${s.bg} ${s.fg}`}
      style={{ fontFamily: "var(--font-plex-mono), monospace" }}
    >
      <span className={`block h-2 w-2 rounded-full ${s.dot}`} />
      {status.replace("_", " ")}
    </span>
  );
}
