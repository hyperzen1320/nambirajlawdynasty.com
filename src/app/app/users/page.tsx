import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getSeatStatus, type SeatStatus } from "@/lib/seats";
import UsersClient, { type UserRow } from "./UsersClient";
import { guardFeature } from "@/lib/feature-guard";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await guardFeature("users");
  const session = await auth();
  const partnerId = session?.user?.partnerId
    ? new mongoose.Types.ObjectId(session.user.partnerId)
    : null;
  const currentUserId = session?.user?.id ?? "";
  const isAdmin = session?.user?.userType === "partner_admin";

  let users: UserRow[] = [];
  // Unlimited until we know better — a page render without a tenant has no
  // plan to cap against, and the API is the real gate either way.
  let seats: SeatStatus = {
    used: 0,
    limit: 0,
    unlimited: true,
    remaining: null,
    atCap: false,
    planKey: "",
    planLabel: "",
  };

  if (partnerId) {
    await connectDB();
    seats = await getSeatStatus(partnerId);
    const docs = await User.find({ partnerId, isDeleted: false })
      .sort({ userType: 1, firstName: 1, lastName: 1 })
      .lean();

    users = docs.map((u) => ({
      id: String(u._id),
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      name: `${u.firstName} ${u.lastName}`.trim(),
      userType: u.userType,
      role:
        u.userType === "partner_admin"
          ? "admin"
          : u.role || "junior",
      phone: u.phone || "",
      designation: u.designation || "",
      active: u.active,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      isYou: String(u._id) === currentUserId,
    }));
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1280px]">
        <UsersClient
          initialUsers={users}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          initialSeats={seats}
        />
      </div>
    </div>
  );
}
