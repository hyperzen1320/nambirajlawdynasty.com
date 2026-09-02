import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { PushToken } from "@/models/PushToken";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";

// POST   /api/app/push   { token, platform?, deviceName? }  — register
// DELETE /api/app/push   { token }                          — revoke
//
// The mobile app registers its Expo push token after signing in and
// revokes it on sign-out. Revoking matters: a shared office phone that
// keeps a signed-out advocate's token would keep showing that advocate's
// chambers notifications to whoever picks it up next.

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// Expo's own format. Checked so a stray string can't fill the collection
// with addresses that will never deliver.
const TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

const PLATFORMS = ["ios", "android", "web"] as const;
type Platform = (typeof PLATFORMS)[number];

async function readToken(request: Request): Promise<string | null> {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  return TOKEN_RE.test(token) ? token : null;
}

export async function POST(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json(
      { error: "Not a valid Expo push token." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const platformIn =
    typeof body?.platform === "string" ? body.platform.toLowerCase() : "";
  const platform: Platform = (PLATFORMS as readonly string[]).includes(
    platformIn
  )
    ? (platformIn as Platform)
    : "android";
  const deviceName =
    typeof body?.deviceName === "string" ? body.deviceName.trim().slice(0, 80) : "";

  await connectDB();

  // Upsert on the token, not on (user, device): the same handset signing
  // in as someone else must MOVE the row, or the previous advocate would
  // keep receiving notifications on a phone they've handed over.
  await PushToken.updateOne(
    { token },
    {
      $set: {
        partnerId: new mongoose.Types.ObjectId(guard.ctx.user.partnerId),
        userId: new mongoose.Types.ObjectId(guard.ctx.user.id),
        platform,
        deviceName,
        lastSeenAt: new Date(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function DELETE(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  const token = await readToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Not a valid Expo push token." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await connectDB();
  // Scoped to the caller so one signed-in user can't unregister another's
  // device by guessing a token.
  await PushToken.deleteOne({
    token,
    userId: new mongoose.Types.ObjectId(guard.ctx.user.id),
  });

  return NextResponse.json(
    { ok: true },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
