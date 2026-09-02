import { connectDB } from "@/lib/db";
import { GlobalSettings } from "@/models/GlobalSettings";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await connectDB();
  const doc = await GlobalSettings.findOne({ singleton: "global" }).lean();
  return (
    <SettingsClient
      initial={{
        maintenanceMode: Boolean(doc?.maintenanceMode),
        maintenanceMessage: doc?.maintenanceMessage || "",
      }}
    />
  );
}
