import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { AccessRequest } from "@/models/AccessRequest";
import { logActivity } from "@/lib/activity";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: corsHeaders() }
    );
  }
  const b = body as Record<string, unknown>;

  const required = ["name", "chambers", "email", "phone"] as const;
  for (const k of required) {
    if (typeof b[k] !== "string" || !(b[k] as string).trim()) {
      return NextResponse.json(
        { error: `${k} is required` },
        { status: 400, headers: corsHeaders() }
      );
    }
  }

  const email = (b.email as string).toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: "Email looks invalid" },
      { status: 400, headers: corsHeaders() }
    );
  }

  await connectDB();

  const ar = await AccessRequest.create({
    name: (b.name as string).trim(),
    chambers: (b.chambers as string).trim(),
    email,
    phone: (b.phone as string).trim(),
    message: typeof b.message === "string" ? (b.message as string).trim() : "",
    status: "pending",
    source: typeof b.source === "string" && b.source === "mobile" ? "mobile" : "web",
  });

  await logActivity({
    actor: {
      id: null,
      name: ar.name,
      email: ar.email,
      type: "system",
    },
    action: "access_request_received",
    targetType: "system",
    targetId: ar._id.toString(),
    targetName: ar.chambers,
    message: `New access request from ${ar.name} (${ar.email}) — ${ar.chambers} · ${ar.phone}.`,
    metadata: { source: ar.source, message: ar.message || null },
    partnerId: null,
  });

  return NextResponse.json(
    { ok: true, id: ar._id.toString() },
    { status: 201, headers: corsHeaders() }
  );
}
