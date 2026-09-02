import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import SeniorDeskClient, { type SeniorDeskMember } from "./SeniorDeskClient";
import { guardFeature } from "@/lib/feature-guard";

// Senior Desk — server shell. Loads the office roster (used by the New
// Private Chat picker and for resolving names in the live feed) and the
// caller's identity, then hands everything to the client component which
// owns the toggle, the rooms list, and the message threads.
//
// Forces dynamic rendering because every render depends on the caller's
// session — there's no point caching this page.

export const dynamic = "force-dynamic";

export default async function SeniorDeskPage() {
  await guardFeature("seniorDesk");
  const session = await auth();
  const userId = session?.user?.id ?? "";
  const partnerId = session?.user?.partnerId
    ? new mongoose.Types.ObjectId(session.user.partnerId)
    : null;

  let members: SeniorDeskMember[] = [];
  let me: SeniorDeskMember | null = null;

  if (partnerId && userId) {
    await connectDB();
    const docs = await User.find({
      partnerId,
      isDeleted: false,
    })
      .sort({ firstName: 1, lastName: 1 })
      .select("firstName lastName email role active userType")
      .lean();
    members = docs.map((u) => ({
      id: String(u._id),
      name:
        `${u.firstName} ${u.lastName}`.trim() || u.email,
      email: u.email,
      role: u.role || (u.userType === "partner_admin" ? "admin" : "junior"),
      active: u.active !== false,
    }));
    const meDoc = members.find((m) => m.id === userId) || null;
    me = meDoc;
  }

  if (!me) {
    // Fall back to the empty desk — caller isn't in any partner.
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-[1100px]">
          <h2
            className="text-[30px] font-semibold tracking-tight sm:text-[40px]"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            Senior Desk
          </h2>
          <p
            className="mt-3 text-[14px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            You don't appear to belong to any office. Sign in again, or ask
            your office admin to add you.
          </p>
        </div>
      </div>
    );
  }

  const userType = (session?.user?.userType ?? "user") as
    | "partner_admin"
    | "user";

  return (
    <SeniorDeskClient
      me={me}
      members={members}
      isAdmin={userType === "partner_admin"}
    />
  );
}
