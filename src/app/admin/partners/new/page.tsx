import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Plan } from "@/models/Plan";
import AddPartnerForm from "./AddPartnerForm";

export default async function NewPartnerPage() {
  await connectDB();
  const planDocs = await Plan.find({ isActive: true })
    .sort({ sortOrder: 1 })
    .lean();
  const plans = planDocs.map((p) => ({
    key: p.key,
    label: p.label,
    priceLabel: p.priceLabel,
    priceSuffix: p.priceSuffix,
    description: p.description,
    isTrial: p.isTrial,
  }));

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="fade-up-sm">
        <Link
          href="/admin/partners"
          className="inline-flex items-center gap-1.5 text-[12px] text-admin-fg-muted transition-colors hover:text-admin-fg"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          <span>←</span> Partners
        </Link>
        <div
          className="mt-6 text-[11px] font-medium uppercase tracking-[0.18em] text-admin-accent"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          New chambers
        </div>
        <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-admin-fg">
          Add a Partner
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-7 text-admin-fg-muted">
          Create a new partner chambers and its primary admin login. The email
          you enter is the partner-admin&rsquo;s user ID — they&rsquo;ll sign
          into the same{" "}
          <code
            className="rounded bg-admin-bg px-1.5 py-0.5 text-[12px] text-admin-fg"
            style={{ fontFamily: "var(--font-plex-mono), monospace" }}
          >
            /login
          </code>{" "}
          page and be routed to their own workspace. Plan pricing reflects
          whatever you have set in{" "}
          <Link
            href="/admin/subscriptions"
            className="text-admin-accent hover:underline"
          >
            Subscriptions
          </Link>
          .
        </p>
      </div>

      <div className="fade-up-sm mt-10" style={{ animationDelay: "0.1s" }}>
        <AddPartnerForm plans={plans} />
      </div>
    </div>
  );
}
