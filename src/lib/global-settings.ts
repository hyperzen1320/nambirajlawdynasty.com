import { connectDB } from "@/lib/db";
import { GlobalSettings } from "@/models/GlobalSettings";

export type GlobalSettingsValue = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
};

const DEFAULTS: GlobalSettingsValue = {
  maintenanceMode: false,
  maintenanceMessage: "",
};

// Read the platform-settings singleton. FAIL-OPEN: any error (DB down, etc.)
// returns the safe defaults (maintenance OFF), so a hiccup can never lock the
// whole office app out. Called from the office app layout on every request.
export async function getGlobalSettings(): Promise<GlobalSettingsValue> {
  try {
    await connectDB();
    const doc = await GlobalSettings.findOne({ singleton: "global" })
      .select("maintenanceMode maintenanceMessage")
      .lean();
    if (!doc) return DEFAULTS;
    return {
      maintenanceMode: Boolean(doc.maintenanceMode),
      maintenanceMessage: doc.maintenanceMessage || "",
    };
  } catch {
    return DEFAULTS;
  }
}
