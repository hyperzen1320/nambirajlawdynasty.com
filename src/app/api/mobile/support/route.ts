import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { SupportTicket } from "@/models/SupportTicket";
import { User } from "@/models/User";
import { Partner } from "@/models/Partner";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// POST /api/mobile/support — raise a support ticket from the app. Any
// signed-in office user may report an issue (it sits under Account, not an
// admin gate). The reporter's name / email / phone are taken from their
// record so the office can't misattribute a ticket; the client only sends
// the subject, category, message and an optional phone override.
export async function POST(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;
  const cors = guard.ctx.isMobile ? corsHeaders() : undefined;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: cors }
    );
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : "Other";
  const phoneOverride =
    typeof body.phone === "string" ? body.phone.trim() : "";

  if (message.length < 5) {
    return NextResponse.json(
      { error: "Please describe the issue in a little more detail." },
      { status: 400, headers: cors }
    );
  }

  await connectDB();
  const [user, partner] = await Promise.all([
    User.findById(new mongoose.Types.ObjectId(guard.ctx.user.id)).lean(),
    Partner.findById(
      new mongoose.Types.ObjectId(guard.ctx.user.partnerId)
    ).lean(),
  ]);

  const reporterName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "";

  const ticket = await SupportTicket.create({
    partnerId: new mongoose.Types.ObjectId(guard.ctx.user.partnerId),
    partnerName: partner?.name || "",
    userId: new mongoose.Types.ObjectId(guard.ctx.user.id),
    reporterName,
    reporterEmail: user?.email || "",
    reporterPhone: phoneOverride || user?.phone || "",
    subject:
      subject ||
      (message.length > 60 ? `${message.slice(0, 57)}…` : message),
    category,
    message,
    attachments: [],
    status: "open",
  });

  return NextResponse.json(
    { ok: true, id: String(ticket._id) },
    { status: 201, headers: cors }
  );
}
