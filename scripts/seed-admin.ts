// Seeds the global admin. Idempotent — safe to re-run.
// Usage: npm run seed:admin
//        (or: npx tsx --env-file=.env.local scripts/seed-admin.ts)

import bcrypt from "bcryptjs";
import { connectDB, disconnectDB } from "../src/lib/db";
import { User } from "../src/models/User";

const ADMIN_EMAIL = "globaladmin@gmail.com";
const ADMIN_PASSWORD = "123";

async function main() {
  console.log("→ Connecting to MongoDB...");
  await connectDB();
  console.log("✓ Connected\n");

  const existing = await User.findOne({ email: ADMIN_EMAIL });

  if (existing) {
    console.log("• Global admin already exists (idempotent run, no changes):");
    console.log("  _id:       " + existing._id);
    console.log("  email:     " + existing.email);
    console.log("  userType:  " + existing.userType);
    console.log("  partnerId: " + (existing.partnerId ?? "null"));
    console.log("  active:    " + existing.active);
    console.log("  created:   " + existing.createdAt.toISOString());
  } else {
    console.log("→ Creating global admin...");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const admin = await User.create({
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: "Global",
      lastName: "Admin",
      userType: "global_admin",
      partnerId: null,
      active: true,
    });

    console.log("✓ Global admin created:");
    console.log("  _id:       " + admin._id);
    console.log("  email:     " + admin.email);
    console.log("  userType:  " + admin.userType);
    console.log("  partnerId: " + (admin.partnerId ?? "null"));
    console.log("  password:  " + ADMIN_PASSWORD + " (CHANGE LATER)");
  }

  // Total user count for sanity
  const totalUsers = await User.countDocuments();
  const globalAdmins = await User.countDocuments({ userType: "global_admin" });
  console.log("\nUsers collection summary:");
  console.log("  total:         " + totalUsers);
  console.log("  global_admins: " + globalAdmins);

  await disconnectDB();
  console.log("\n✓ Done");
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err);
  process.exit(1);
});
