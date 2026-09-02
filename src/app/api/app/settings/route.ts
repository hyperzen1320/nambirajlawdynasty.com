import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logActivity } from "@/lib/activity";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const VALID_RETENTION = [null, 90, 180, 365] as const;

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partner = await Partner.findById(guard.ctx.user.partnerId)
    .select("settings")
    .lean();

  return NextResponse.json(
    {
      settings: {
        activityRetentionDays:
          partner?.settings?.activityRetentionDays ?? null,
      },
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

// Only the office admin can change office-wide settings.
export async function PATCH(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  if (guard.ctx.user.role !== "admin") {
    return NextResponse.json(
      { error: "Only the office admin can change office settings." },
      { status: 403, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await connectDB();
  const partner = await Partner.findById(guard.ctx.user.partnerId);
  if (!partner) {
    return NextResponse.json(
      { error: "Office not found" },
      { status: 404, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(body, "activityRetentionDays")
  ) {
    const v = body.activityRetentionDays;
    const allowed: (number | null)[] = VALID_RETENTION as unknown as (
      | number
      | null
    )[];
    if (v === null || (typeof v === "number" && allowed.includes(v))) {
      const before = partner.settings?.activityRetentionDays ?? null;
      partner.settings = partner.settings || {
        activityRetentionDays: null,
      };
      partner.settings.activityRetentionDays = v;
      await partner.save();

      const labelOf = (n: number | null) =>
        n === null ? "keep forever" : `${n} days`;
      await logActivity({
        actor: {
          id: guard.ctx.user.id,
          name:
            `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim() ||
            guard.ctx.user.email,
          email: guard.ctx.user.email,
          type: guard.ctx.user.userType,
        },
        action: "system",
        targetType: "partner",
        targetId: String(partner._id),
        targetName: partner.name,
        message: `changed activity retention to ${labelOf(v)} (was ${labelOf(before)})`,
        metadata: { setting: "activityRetentionDays", from: before, to: v },
        partnerId: String(partner._id),
      });
    } else {
      return NextResponse.json(
        {
          error:
            "Invalid retention value. Allowed: null (forever), 90, 180, or 365.",
        },
        {
          status: 400,
          headers: guard.ctx.isMobile ? corsHeaders() : undefined,
        }
      );
    }
  }

  return NextResponse.json(
    {
      ok: true,
      settings: {
        activityRetentionDays:
          partner.settings?.activityRetentionDays ?? null,
      },
    },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
