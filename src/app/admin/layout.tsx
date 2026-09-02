import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.userType !== "global_admin") redirect("/app");

  const user = {
    id: session.user.id,
    email: session.user.email ?? "",
    firstName: session.user.firstName ?? "",
    lastName: session.user.lastName ?? "",
  };

  return (
    <div className="admin-shell grid min-h-screen grid-cols-[260px_1fr]">
      <Sidebar user={user} />
      <div className="flex min-h-screen flex-col">
        <Topbar user={user} />
        <main className="flex-1 px-10 py-10">{children}</main>
      </div>
    </div>
  );
}
