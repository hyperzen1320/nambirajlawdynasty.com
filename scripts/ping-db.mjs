// Quick MongoDB Atlas connectivity check.
// Run: node --env-file=.env.local scripts/ping-db.mjs

import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "legaleasy_dev";

if (!uri) {
  console.error("✗ MONGODB_URI is not set in .env.local");
  process.exit(1);
}

console.log("→ Connecting to MongoDB Atlas...");
const start = Date.now();

try {
  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10000,
  });

  const conn = mongoose.connection;
  const ping = await conn.db.admin().ping();
  const collections = await conn.db.listCollections().toArray();
  const elapsed = Date.now() - start;

  console.log("✓ Connected in " + elapsed + "ms");
  console.log("  host:        " + conn.host);
  console.log("  database:    " + conn.name);
  console.log("  ready state: " + (conn.readyState === 1 ? "open" : "other"));
  console.log("  ping:        " + (ping.ok === 1 ? "ok" : "failed"));
  console.log("  collections: " + collections.length + " (" + (collections.map((c) => c.name).join(", ") || "none yet") + ")");

  await mongoose.disconnect();
  console.log("✓ Disconnected cleanly");
  process.exit(0);
} catch (err) {
  console.error("✗ Connection failed");
  console.error("  " + err.message);
  process.exit(1);
}
