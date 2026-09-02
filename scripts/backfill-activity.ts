// Backfills activity entries for partners that were created before
// activity logging was wired up. Idempotent — won't duplicate.
// Usage: npm run backfill:activity

import { connectDB, disconnectDB } from "../src/lib/db";
import { Partner } from "../src/models/Partner";
import { Activity } from "../src/models/Activity";
import { User } from "../src/models/User";

async function main() {
  console.log("→ Connecting to MongoDB...");
  await connectDB();
  console.log("✓ Connected\n");

  const globalAdmin = await User.findOne({ userType: "global_admin" });
  if (!globalAdmin) {
    console.error("✗ No global admin found. Run npm run seed:admin first.");
    process.exit(1);
  }

  const partners = await Partner.find({}).sort({ createdAt: 1 }).lean();
  console.log(`Found ${partners.length} partner(s) in database.\n`);

  let added = 0;
  let skipped = 0;

  for (const p of partners) {
    const exists = await Activity.findOne({
      action: "partner_created",
      targetId: p._id,
    });

    if (exists) {
      console.log(`• Skipping ${p.name} — activity already logged`);
      skipped++;
      continue;
    }

    // Use raw insert to preserve historical createdAt timestamp
    await Activity.collection.insertOne({
      actorUserId: globalAdmin._id,
      actorName: `${globalAdmin.firstName} ${globalAdmin.lastName}`.trim(),
      actorEmail: globalAdmin.email,
      actorType: "global_admin",
      action: "partner_created",
      targetType: "partner",
      targetId: p._id,
      targetName: p.name,
      message: `Created chambers ${p.name} on the ${p.plan} plan.`,
      metadata: {
        plan: p.plan,
        primaryEmail: p.primaryEmail,
        backfilled: true,
      },
      partnerId: p._id,
      createdAt: p.createdAt,
    });

    console.log(
      `✓ Backfilled: ${p.name} (created ${p.createdAt.toISOString()})`
    );
    added++;
  }

  console.log(`\nSummary:`);
  console.log(`  added:   ${added}`);
  console.log(`  skipped: ${skipped} (already had activity)`);

  await disconnectDB();
  console.log("\n✓ Done");
}

main().catch((err) => {
  console.error("\n✗ Backfill failed:", err);
  process.exit(1);
});
