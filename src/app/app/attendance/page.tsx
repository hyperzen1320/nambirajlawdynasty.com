import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AttendanceClient from "./AttendanceClient";
import { guardFeature } from "@/lib/feature-guard";

// Server shell. The grid + the marking interaction live entirely in
// the client component — the page just routes the partner id + the
// admin flag down so the client can call the API correctly on mount.

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  await guardFeature("attendance");
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Attendance is office-admin only — juniors/clerks/advocates don't see
  // it in the rail and can't reach the page directly either.
  if (session.user.userType !== "partner_admin") redirect("/app");

  const isAdmin = session.user.userType === "partner_admin";
  const me = {
    id: session.user.id ?? "",
    name:
      `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim() ||
      session.user.email ||
      "You",
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1320px]">
        <AttendanceClient isAdmin={isAdmin} me={me} />
      </div>
    </div>
  );
}
