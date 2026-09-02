import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { PromptTemplate } from "@/models/PromptTemplate";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { PROMPT_DEFAULTS } from "@/lib/prompt-defaults";
import { logWorkflowActivity } from "@/lib/activity";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function ensureSeeded(partnerId: mongoose.Types.ObjectId) {
  const count = await PromptTemplate.countDocuments({
    partnerId,
    isDeleted: false,
  });
  if (count > 0) return;

  await PromptTemplate.insertMany(
    PROMPT_DEFAULTS.map((p, idx) => ({
      partnerId,
      title: p.title,
      body: p.body,
      category: p.category,
      sortOrder: idx,
      isSeeded: true,
    }))
  );
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  await ensureSeeded(partnerId);

  const docs = await PromptTemplate.find({ partnerId, isDeleted: false })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const prompts = docs.map((p) => ({
    id: String(p._id),
    title: p.title,
    body: p.body,
    category: p.category,
    isSeeded: p.isSeeded,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json(
    { prompts },
    { headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}

export async function POST(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "Title is required." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const promptBody = typeof body.body === "string" ? body.body : "";
  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : "Custom";

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const last = await PromptTemplate.findOne({ partnerId, isDeleted: false })
    .sort({ sortOrder: -1 })
    .select("sortOrder")
    .lean();
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  const doc = await PromptTemplate.create({
    partnerId,
    title,
    body: promptBody,
    category,
    sortOrder,
    isSeeded: false,
    createdBy: guard.ctx.user.id
      ? new mongoose.Types.ObjectId(guard.ctx.user.id)
      : null,
  });

  await logWorkflowActivity(guard.ctx, {
    action: "prompt.created",
    targetType: "prompt",
    targetId: String(doc._id),
    targetName: doc.title,
    message: `added prompt **${doc.title}**`,
    metadata: { category: doc.category },
  });

  return NextResponse.json(
    {
      ok: true,
      prompt: {
        id: String(doc._id),
        title: doc.title,
        body: doc.body,
        category: doc.category,
        isSeeded: false,
        updatedAt: doc.updatedAt.toISOString(),
      },
    },
    { status: 201, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
