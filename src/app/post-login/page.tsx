import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function PostLogin() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.userType === "global_admin") redirect("/admin");
  redirect("/app");
}
