import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";
import { DEFAULT_NOTICE_TEMPLATE } from "@/lib/notice-template";

export const dynamic = "force-dynamic";

// The office's WhatsApp notice template. Any user can read it (so their
// WhatsApp button uses it); only the partner admin can change it.

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;
  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;

  await connectDB();
  const partner = await Partner.findById(guard.ctx.user.partnerId)
    .select("noticeTemplate")
    .lean();

  return NextResponse.json(
    { template: partner?.noticeTemplate || DEFAULT_NOTICE_TEMPLATE },
    { headers }
  );
}

export async function PATCH(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;
  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;

  if (guard.ctx.user.userType !== "partner_admin") {
    return NextResponse.json(
      { error: "Only the office admin can edit the notice template." },
      { status: 403, headers }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    template?: string;
  } | null;
  if (!body || typeof body.template !== "string") {
    return NextResponse.json(
      { error: "Expected { template }." },
      { status: 400, headers }
    );
  }
  // Keep it sane — a WhatsApp message can't be a novel.
  const template = body.template.slice(0, 4000);

  await connectDB();
  await Partner.findByIdAndUpdate(
    new mongoose.Types.ObjectId(guard.ctx.user.partnerId),
    { noticeTemplate: template }
  );

  await logWorkflowActivity(guard.ctx, {
    action: "profile.updated",
    targetType: "profile",
    targetId: guard.ctx.user.partnerId,
    targetName: "WhatsApp notice template",
    message: "updated the WhatsApp notice template",
  });

  return NextResponse.json({ ok: true, template }, { headers });
}
