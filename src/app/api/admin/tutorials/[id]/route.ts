import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { TutorialMedia } from "@/models/TutorialMedia";
import { requireAdmin } from "@/lib/admin-auth";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function loadTutorial(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return TutorialMedia.findOne({
    _id: new mongoose.Types.ObjectId(id),
    isDeleted: false,
  });
}

// PATCH — edit title / description / order / isActive.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: corsHeaders() }
    );
  }

  await connectDB();
  const tutorial = await loadTutorial(id);
  if (!tutorial) {
    return NextResponse.json(
      { error: "Tutorial not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  const b = body as Record<string, unknown>;

  if (typeof b.title === "string") {
    const title = b.title.trim();
    if (!title) {
      return NextResponse.json(
        { error: "Title can't be empty." },
        { status: 400, headers: corsHeaders() }
      );
    }
    tutorial.title = title;
  }

  if (typeof b.description === "string") {
    tutorial.description = b.description.trim();
  }

  if (typeof b.order === "number" && Number.isFinite(b.order)) {
    tutorial.order = Math.trunc(b.order);
  }

  if (typeof b.isActive === "boolean") {
    tutorial.isActive = b.isActive;
  }

  await tutorial.save();

  return NextResponse.json(
    {
      ok: true,
      tutorial: {
        id: String(tutorial._id),
        title: tutorial.title,
        description: tutorial.description,
        kind: tutorial.kind,
        filename: tutorial.filename,
        contentType: tutorial.contentType,
        size: tutorial.size,
        order: tutorial.order,
        isActive: tutorial.isActive,
        uploadedByName: tutorial.uploadedByName,
        createdAt: tutorial.createdAt.toISOString(),
        updatedAt: tutorial.updatedAt.toISOString(),
      },
    },
    { headers: corsHeaders() }
  );
}

// DELETE — soft delete. Keeps the metadata row and the GridFS binary
// recoverable, consistent with the rest of the app.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const tutorial = await loadTutorial(id);
  if (!tutorial) {
    return NextResponse.json(
      { error: "Tutorial not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  tutorial.isDeleted = true;
  await tutorial.save();

  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
