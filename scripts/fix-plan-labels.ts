// One-off fix: restore any plan priceLabel where the rupee glyph (₹) got
// mangled to "?" by Windows bash UTF-8 mishandling during dev tests.
//
// Run: npm run fix:plan-labels


import { connectDB, disconnectDB } from "../src/lib/db";
import { Plan } from "../src/models/Plan";

// Canonical priceLabel for each plan key. Adjust here if you've actually
// changed the price; this script will only touch labels that contain "?".
const CANONICAL: Record<string, string> = {
  trial: "Free",
  solo: "₹1,499",
  office: "₹4,999",
  chambers: "Bespoke",
};

async function main() {
  await connectDB();
  let fixed = 0;
  for (const [key, correct] of Object.entries(CANONICAL)) {
    const plan = await Plan.findOne({ key });
    if (!plan) continue;
    if (plan.priceLabel.includes("?") || plan.priceLabel === "") {
      console.log(
        `→ ${key}: "${plan.priceLabel}" → "${correct}"`
      );
      plan.priceLabel = correct;
      await plan.save();
      fixed++;
    } else {
      console.log(`• ${key}: "${plan.priceLabel}" — clean, skipped`);
    }
  }
  console.log(`\nFixed ${fixed} plan(s).`);
  await disconnectDB();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
