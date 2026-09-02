import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { GlobalSettings } from "@/models/GlobalSettings";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function loadOrCreate() {
  await connectDB();
  const existing = await GlobalSettings.findOne({ singleton: "global" });
  if (existing) return existing;
  return GlobalSettings.create({ singleton: "global" });
}

// GET /api/admin/settings — read the platform settings singleton.
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;
  const cors = guard.ctx.isMobile ? corsHeaders() : undefined;

  const doc = await loadOrCreate();
  return NextResponse.json(
    {
      settings: {
        maintenanceMode: doc.maintenanceMode,
        maintenanceMessage: doc.maintenanceMessage,
      },
    },
    { headers: cors }
  );
}

// PATCH /api/admin/settings — toggle maintenance and/or set the message.
export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
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

  const doc = await loadOrCreate();
  const wasOn = doc.maintenanceMode;
  let changed = false;

  if (typeof body.maintenanceMode === "boolean") {
    doc.maintenanceMode = body.maintenanceMode;
    changed = true;
  }
  if (typeof body.maintenanceMessage === "string") {
    doc.maintenanceMessage = body.maintenanceMessage.trim();
    changed = true;
  }

  if (changed) {
    await doc.save();
    if (wasOn !== doc.maintenanceMode) {
      await logActivity({
        actor: {
          id: guard.ctx.user.id,
          name: `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim(),
          email: guard.ctx.user.email,
          type: "global_admin",
        },
        action: "maintenance_toggled",
        targetType: "system",
        targetId: String(doc._id),
        targetName: "Maintenance",
        message: doc.maintenanceMode
          ? "Turned maintenance mode ON."
          : "Turned maintenance mode OFF.",
        metadata: { maintenanceMode: doc.maintenanceMode },
        partnerId: null,
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      settings: {
        maintenanceMode: doc.maintenanceMode,
        maintenanceMessage: doc.maintenanceMessage,
      },
    },
    { headers: cors }
  );
}
