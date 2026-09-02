import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

// GridFS bucket for case-document binaries. We reach the driver through
// `mongoose.mongo` (the bundled mongodb package) so there's no separate
// "mongodb" dependency to keep in sync with mongoose's own.
const BUCKET_NAME = "case_documents";
// Senior Desk chat attachments live in their own bucket so they're easy to
// reason about and lifecycle separately from case documents.
const CHAT_BUCKET_NAME = "chat_attachments";
// Global-admin tutorial media (videos / images / PDFs the mobile app plays)
// lives in its own bucket, isolated from tenant case data.
const TUTORIAL_BUCKET_NAME = "tutorial_media";

export async function getDocsBucket(): Promise<
  InstanceType<typeof mongoose.mongo.GridFSBucket>
> {
  return getBucket(BUCKET_NAME);
}

export async function getChatBucket(): Promise<
  InstanceType<typeof mongoose.mongo.GridFSBucket>
> {
  return getBucket(CHAT_BUCKET_NAME);
}

export async function getTutorialBucket(): Promise<
  InstanceType<typeof mongoose.mongo.GridFSBucket>
> {
  return getBucket(TUTORIAL_BUCKET_NAME);
}

async function getBucket(
  bucketName: string
): Promise<InstanceType<typeof mongoose.mongo.GridFSBucket>> {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection is not ready for GridFS.");
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName });
}
