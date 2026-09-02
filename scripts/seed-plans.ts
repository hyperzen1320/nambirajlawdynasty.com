// Seed the 4 plans into MongoDB. Idempotent: only inserts what's missing,
// never overwrites edits made by the global admin.
//
// Run: npm run seed:plans

import { connectDB, disconnectDB } from "../src/lib/db";
import { Plan } from "../src/models/Plan";

const SEED = [
  {
    key: "trial" as const,
    label: "Trial",
    tagline: "Free · time-limited",
    description:
      "Full access for a fixed window. Login is blocked the moment the trial ends.",
    priceAmount: 0,
    priceLabel: "Free",
    priceSuffix: "· time-limited",
    billingCycle: "trial" as const,
    features: [
      "Full Office plan capabilities for the trial window",
      "Up to 5 users · 50 matters",
      "Auto-blocks login after expiry",
    ],
    seatLimit: 5,
    matterLimit: 50,
    isTrial: true,
    isPopular: false,
    showOnLanding: false,
    isActive: true,
    sortOrder: 0,
    ctaLabel: "Start trial",
  },
  {
    key: "solo" as const,
    label: "Solo Practitioner",
    tagline: "Single advocate, 100 active matters.",
    description: "For one advocate. Up to 100 active matters. Word & PDF export.",
    priceAmount: 1499,
    priceLabel: "₹1,499",
    priceSuffix: "/ mo",
    billingCycle: "monthly" as const,
    features: [
      "Case Vault, Hearings, Pending Dates",
      "Court Hub, Client Crew",
      "Document Export (Word & PDF)",
      "AI Assistant — basic prompts",
      "Mobile + Web",
      "1 user · 100 matters",
    ],
    seatLimit: 1,
    matterLimit: 100,
    isTrial: false,
    isPopular: false,
    showOnLanding: true,
    isActive: true,
    sortOrder: 1,
    ctaLabel: "Begin practice",
  },
  {
    key: "office" as const,
    label: "Office",
    tagline: "Up to 10 users, 1,000 matters.",
    description:
      "For an office of advocates and clerks. Workflow boards. Senior Desk.",
    priceAmount: 4999,
    priceLabel: "₹4,999",
    priceSuffix: "/ mo",
    billingCycle: "monthly" as const,
    features: [
      "Everything in Solo",
      "Senior Desk + Reminders",
      "Work Flow Kanban (7 boards)",
      "Users / Advocates roles",
      "Activity log + Audit",
      "10 users · 1,000 matters",
    ],
    seatLimit: 10,
    matterLimit: 1000,
    isTrial: false,
    isPopular: true,
    showOnLanding: true,
    isActive: true,
    sortOrder: 2,
    ctaLabel: "Set up office",
  },
  {
    key: "chambers" as const,
    label: "Chambers",
    tagline: "Unlimited users + matters.",
    description:
      "For multi-branch chambers, with on-prem deployment and integrations.",
    priceAmount: 0,
    priceLabel: "Bespoke",
    priceSuffix: "",
    billingCycle: "bespoke" as const,
    features: [
      "Everything in Office",
      "Multi-branch tenancy",
      "On-prem deployment",
      "e-Courts CNR auto-fetch",
      "Custom export templates",
      "Unlimited users · matters",
    ],
    seatLimit: 999999,
    matterLimit: 999999,
    isTrial: false,
    isPopular: false,
    showOnLanding: true,
    isActive: true,
    sortOrder: 3,
    ctaLabel: "Speak to us",
  },
];

async function main() {
  console.log("→ Connecting to MongoDB...");
  await connectDB();
  console.log("✓ Connected\n");

  let added = 0;
  let skipped = 0;

  for (const seed of SEED) {
    const existing = await Plan.findOne({ key: seed.key });
    if (existing) {
      console.log(
        `• Skipping ${seed.key} — already exists (last edited ${existing.updatedAt.toISOString()})`
      );
      skipped++;
      continue;
    }
    await Plan.create(seed);
    console.log(`✓ Seeded: ${seed.key} (${seed.label})`);
    added++;
  }

  console.log(`\nSummary: ${added} added, ${skipped} skipped (already existed)`);
  console.log("\nTip: edits made via /admin/subscriptions are preserved on re-run.");

  await disconnectDB();
  console.log("\n✓ Done");
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err);
  process.exit(1);
});
