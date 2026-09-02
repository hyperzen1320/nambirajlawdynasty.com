import Link from "next/link";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Court } from "@/models/Court";
import { User } from "@/models/User";
import CaseVaultClient, {
  type CaseVaultBootstrap,
} from "./CaseVaultClient";
import ImportCasesButton from "./ImportCasesModal";
import { guardFeature } from "@/lib/feature-guard";

// Server shell. Loads the static-ish dropdown data (courts + office
// roster) up-front and hands the partner id to the client. All case
// data + filter changes are then driven client-side through the API,
// which keeps the page snappy when the user fiddles with filters.

export const dynamic = "force-dynamic";

export default async function CaseVaultPage() {
  await guardFeature("cases");
  const session = await auth();
  const partnerId = session?.user?.partnerId
    ? new mongoose.Types.ObjectId(session.user.partnerId)
    : null;
  const isAdmin = session?.user?.userType === "partner_admin";

  let bootstrap: CaseVaultBootstrap = {
    courts: [],
    courtPlaces: [],
    advocates: [],
    partnerId: "",
    isAdmin,
  };

  if (partnerId) {
    await connectDB();
    const [courtsDocs, usersDocs] = await Promise.all([
      Court.find({ partnerId, isDeleted: false })
        .select("name number place")
        .sort({ name: 1 })
        .lean(),
      // The "by which advocate" filter looks across the whole office
      // roster — including non-admins, since clerks and juniors can
      // also file cases. We exclude only deactivated / removed users
      // so the dropdown doesn't carry dead options.
      User.find({ partnerId, isDeleted: false, active: { $ne: false } })
        .select("firstName lastName email role")
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
    ]);

    const courts = courtsDocs.map((c) => ({
      id: String(c._id),
      name: c.name,
      number: c.number || "",
      place: c.place || "",
    }));

    // The Court Place dropdown is a deduped list of place strings from
    // the Court Hub. We do it server-side so the client doesn't have
    // to pull the whole court list just to compute place options.
    const placeSet = new Set<string>();
    for (const c of courts) {
      if (c.place && c.place.trim()) placeSet.add(c.place.trim());
    }
    const courtPlaces = Array.from(placeSet).sort((a, b) =>
      a.localeCompare(b)
    );

    const advocates = usersDocs.map((u) => ({
      id: String(u._id),
      name:
        `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
      role: u.role || "junior",
    }));

    bootstrap = {
      courts,
      courtPlaces,
      advocates,
      partnerId: String(partnerId),
      isAdmin,
    };
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2
              className="text-[30px] font-semibold tracking-tight leading-[1.1] sm:text-[40px]"
              style={{
                fontFamily: "var(--font-crimson), Georgia, serif",
                color: "var(--color-app-ink)",
              }}
            >
              Case Vault
            </h2>
            <p
              className="mt-2 text-[13px]"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                color: "var(--color-app-fg-muted)",
              }}
            >
              Every active matter. Filter, search and export the rolls.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <ImportCasesButton advocates={bootstrap.advocates} />
            <Link
              href="/app/cases/new"
              className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
              style={{
                fontFamily: "var(--font-manrope), sans-serif",
                backgroundColor: "var(--color-app-copper)",
                color: "var(--color-app-copper-text)",
                boxShadow: "0 8px 20px -10px rgba(197,133,58,0.6)",
              }}
            >
              <span>+</span> New Case
            </Link>
          </div>
        </div>

        <CaseVaultClient bootstrap={bootstrap} />
      </div>
    </div>
  );
}
