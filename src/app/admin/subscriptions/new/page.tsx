import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Plan } from "@/models/Plan";
import AddPlanForm from "./AddPlanForm";

export default async function NewPlanPage() {
  await connectDB();
  const docs = await Plan.find({}).select("key").sort({ sortOrder: 1 }).lean();
  const takenKeys = docs.map((d) => d.key);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="fade-up-sm">
        <Link
          href="/admin/subscriptions"
          className="inline-flex items-center gap-1.5 text-[12px] text-admin-fg-muted transition-colors hover:text-admin-fg"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          <span>←</span> Subscriptions
        </Link>
        <div
          className="mt-6 text-[11px] font-medium uppercase tracking-[0.18em] text-admin-accent"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          New plan
        </div>
        <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-admin-fg">
          Add a plan
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-7 text-admin-fg-muted">
          Create a new subscription tier. The{" "}
          <strong className="text-admin-fg">key</strong> is a permanent, URL-safe
          slug used to assign the plan to offices — pick it carefully, it
          can&rsquo;t be changed later. Seat and matter limits set here apply to
          every chambers created on this plan. Everything is editable afterwards
          from the plan&rsquo;s{" "}
          <Link
            href="/admin/subscriptions"
            className="text-admin-accent hover:underline"
          >
            edit page
          </Link>
          .
        </p>
      </div>

      <div className="fade-up-sm mt-10" style={{ animationDelay: "0.1s" }}>
        <AddPlanForm takenKeys={takenKeys} />
      </div>
    </div>
  );
}
