import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import {
  isFeatureEnabled,
  readFeatures,
  type FeatureKey,
  type FeatureMap,
} from "@/lib/features";

// Server-side module guards for the partner app's pages.
//
// The APIs are already gated centrally in requirePartner(); this is the
// second layer, so someone typing /app/workflow into the address bar lands
// on the dashboard instead of an empty shell that 403s on every fetch.
//
// Wrapped in React's cache() so the layout, the page guard and the
// dashboard share ONE lookup per request rather than each running their
// own — a page render touches this two or three times.

export type PartnerChrome = {
  name: string;
  features: FeatureMap;
};

export const currentPartnerChrome = cache(
  async (): Promise<PartnerChrome> => {
    const session = await auth();
    const partnerId = session?.user?.partnerId;
    if (!partnerId) return { name: "Your Chambers", features: {} };
    await connectDB();
    const partner = await Partner.findById(partnerId)
      .select("name features")
      .lean();
    return {
      name: partner?.name || "Your Chambers",
      features: readFeatures(partner?.features),
    };
  }
);

/** The calling user's chambers module map. Empty (= all on) when signed out. */
export async function currentFeatures(): Promise<FeatureMap> {
  return (await currentPartnerChrome()).features;
}

/**
 * Call at the top of a module's page. Redirects to the dashboard when the
 * global admin has switched that module off for this chambers.
 */
export async function guardFeature(key: FeatureKey): Promise<void> {
  const features = await currentFeatures();
  if (!isFeatureEnabled(features, key)) redirect("/app");
}
