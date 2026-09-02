import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import AppShell from "./components/AppShell";
import MaintenanceScreen from "./components/MaintenanceScreen";
import { getGlobalSettings } from "@/lib/global-settings";
import { currentPartnerChrome } from "@/lib/feature-guard";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.userType === "global_admin") redirect("/admin");

  // Platform maintenance — while it's on, the whole office app is replaced by
  // a holding screen for every chambers user. The global admin operates via
  // /admin (a separate shell, not gated here), so they can still turn it off.
  // getGlobalSettings fails OPEN, so a DB hiccup never locks everyone out.
  const settings = await getGlobalSettings();
  if (settings.maintenanceMode) {
    return <MaintenanceScreen message={settings.maintenanceMessage} />;
  }

  // Pull the chambers name (and its module switches) fresh from the DB, so
  // a rename or a module change in global admin shows in the sidebar right
  // away rather than only after the next login. The lookup is request-cached,
  // so the page's own guardFeature() call doesn't repeat it.
  //
  // Switched-off modules are dropped from the rail here; the page redirect
  // and the API 403 back that up, so this layer is purely so nothing dead
  // is on screen.
  const { name: partnerName, features } = await currentPartnerChrome();
  let freshFirst = session.user.firstName ?? "";
  let freshLast = session.user.lastName ?? "";
  await connectDB();
  if (session.user.email) {
    const me = await User.findOne({ email: session.user.email })
      .select("firstName lastName")
      .lean();
    if (me) {
      freshFirst = me.firstName ?? "";
      freshLast = me.lastName ?? "";
    }
  }

  const user = {
    firstName: freshFirst,
    lastName: freshLast,
    email: session.user.email ?? "",
  };
  const isAdmin = session.user.userType === "partner_admin";

  return (
    <AppShell
      partnerName={partnerName}
      user={user}
      isAdmin={isAdmin}
      features={features}
    >
      {children}
    </AppShell>
  );
}
