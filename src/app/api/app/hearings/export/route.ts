import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import {
  loadHearingsBucket,
  filterHearingRows,
  type Bucket,
  type HearingRow,
} from "@/lib/hearings-bucket";
import {
  resolveColumns,
  companyName,
  type CaseExportInput,
  type CaseExportRow,
} from "@/lib/case-export/types";
import { generateXlsx } from "@/lib/case-export/xlsx";
import { generateDocx } from "@/lib/case-export/docx";
import { generatePdf } from "@/lib/case-export/pdf";

// pdfkit loads AFM fonts via fs at runtime — full Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

const FORMAT_META: Record<
  "xlsx" | "docx" | "pdf",
  { mime: string; ext: string }
> = {
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
  },
  pdf: { mime: "application/pdf", ext: "pdf" },
};

const BUCKET_LABEL: Record<Bucket, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  pending: "Pending",
  all: "All cases",
};

// Map a hearing row onto the shared export row. The hearing track doesn't
// carry every case field (IA numbers, opposite advocate, court no/hall,
// the appearing-for role, the advocate name) — those export blank, which
// the default column set already tolerates.
function toExportRow(r: HearingRow): CaseExportRow {
  return {
    id: r.id,
    caseNo: r.caseNo,
    fileNo: r.fileNo,
    iaNumbers: "",
    cnr: r.cnr,
    clientName: r.clientName,
    clientPhone: r.clientPhone,
    clientWhatsapp: r.clientWhatsapp,
    appearingFor: "",
    oppositeParty: r.oppositeParty,
    oppositeAdvocate: "",
    courtName: r.courtName,
    courtNumber: "",
    courtHall: "",
    courtPlace: r.courtPlace,
    status: r.status,
    advocateName: "",
    nextHearingDate: r.nextHearingDate,
    lastHearingDate: r.lastHearingDate,
    disposedAt: null,
  };
}

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  // Exporting is office-admin only — the client was explicit that export
  // options belong to the partner admin. The UI hides the menu for
  // everyone else; this is the server half.
  if (guard.ctx.user.role !== "admin") {
    return NextResponse.json(
      { error: "Only the office admin can export the hearing track." },
      { status: 403, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const url = new URL(request.url);
  const bucketParam = url.searchParams.get("bucket");
  const bucket: Bucket =
    bucketParam === "tomorrow" ||
    bucketParam === "pending" ||
    bucketParam === "all"
      ? bucketParam
      : "today";
  const q = url.searchParams.get("q") || "";
  const format = url.searchParams.get("format");
  if (format !== "xlsx" && format !== "docx" && format !== "pdf") {
    return NextResponse.json(
      { error: "Unsupported format. Pick xlsx, docx, or pdf." },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  await connectDB();
  const partnerObjId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const [{ items }, partner] = await Promise.all([
    loadHearingsBucket(partnerObjId, bucket),
    Partner.findById(partnerObjId).lean(),
  ]);

  // Apply the same search the user had on screen so the file matches the
  // view exactly.
  const rows = filterHearingRows(items, q).map(toExportRow);

  const filterLines: string[] = [`Hearing track — ${BUCKET_LABEL[bucket]}`];
  if (q.trim()) filterLines.push(`Search — "${q.trim()}"`);

  const exportInput: CaseExportInput = {
    cases: rows,
    partner: {
      name: partner?.name || "",
      officeName: partner?.branding?.officeName || "",
      primaryContactName: partner?.primaryContactName || "",
      city: partner?.city || "",
      state: partner?.state || "",
      phone: partner?.phone || "",
    },
    columns: resolveColumns(null),
    filters: { lines: filterLines },
    generatedAt: new Date(),
  };

  let buffer: Buffer;
  try {
    if (format === "xlsx") buffer = await generateXlsx(exportInput);
    else if (format === "docx") buffer = await generateDocx(exportInput);
    else buffer = await generatePdf(exportInput);
  } catch (err) {
    console.error(
      `[hearings-export] ${format} generator failed for partner ${guard.ctx.user.partnerId}:`,
      err
    );
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Couldn't generate the ${format.toUpperCase()} export. ${detail}` },
      { status: 500, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const meta = FORMAT_META[format];
  const dateSlug = exportInput.generatedAt
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const safeCompany =
    companyName(exportInput.partner)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "hearing-track";
  const filename = `${safeCompany}-hearing-${bucket}-${dateSlug}.${meta.ext}`;

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": meta.mime,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
      ...(guard.ctx.isMobile ? corsHeaders() : {}),
    },
  });
}
