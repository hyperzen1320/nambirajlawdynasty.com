import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Case } from "@/models/Case";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { MAX_DOC_BYTES, MAX_DOC_LABEL } from "@/lib/case-docs";
import { normalizeCnr } from "@/lib/cnr";
import { parseCasesFromFile, type ParsedCaseRow } from "@/lib/case-import";

// Parsing docx/xlsx/pdf needs the full Node runtime (Buffers, pdfjs).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMPORT_EXTS = ["docx", "doc", "xlsx", "xls", "csv", "pdf"];

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export type RowIssue = {
  missingCaseNo: boolean;
  duplicateCnr: boolean;
  note: string;
};

// POST — upload a roll, parse it, return preview rows + per-row issues.
// Creates NOTHING; the client reviews, then calls /api/app/cases/import.
export async function POST(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;
  const headers = guard.ctx.isMobile ? corsHeaders() : undefined;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a file upload." },
      { status: 400, headers }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file was attached." },
      { status: 400, headers }
    );
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!IMPORT_EXTS.includes(ext)) {
    return NextResponse.json(
      { error: "Upload a Word (.docx), Excel (.xlsx), CSV or PDF file." },
      { status: 400, headers }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400, headers });
  }
  if (file.size > MAX_DOC_BYTES) {
    return NextResponse.json(
      { error: `File is larger than ${MAX_DOC_LABEL}.` },
      { status: 400, headers }
    );
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = await parseCasesFromFile(buffer, file.name);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Couldn't read that file. Try a Word or Excel export.",
      },
      { status: 422, headers }
    );
  }

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  // Flag CNRs that already exist in the chambers, or repeat within the file.
  const normalized = parsed.rows.map((r) => normalizeCnr(r.cnr));
  const nonBlank = [...new Set(normalized.filter(Boolean))];
  const existing = nonBlank.length
    ? await Case.find({
        partnerId,
        isDeleted: false,
        cnr: { $in: nonBlank },
      })
        .collation({ locale: "en", strength: 2 })
        .select("cnr")
        .lean()
    : [];
  const existingSet = new Set(existing.map((c) => normalizeCnr(c.cnr)));
  const batchCounts = new Map<string, number>();
  for (const c of normalized) if (c) batchCounts.set(c, (batchCounts.get(c) || 0) + 1);

  const issues: RowIssue[] = parsed.rows.map((row: ParsedCaseRow, i) => {
    const cnr = normalized[i];
    const missingCaseNo = !row.caseNo.trim();
    const dupInDb = Boolean(cnr) && existingSet.has(cnr);
    const dupInBatch = Boolean(cnr) && (batchCounts.get(cnr) || 0) > 1;
    const duplicateCnr = dupInDb || dupInBatch;
    let note = "";
    if (missingCaseNo) note = "No case number — will be skipped.";
    else if (dupInDb) note = "CNR already on record — will be skipped.";
    else if (dupInBatch) note = "CNR repeats in this file — only the first imports.";
    return { missingCaseNo, duplicateCnr, note };
  });

  return NextResponse.json(
    {
      rows: parsed.rows,
      issues,
      mappedColumns: parsed.mappedColumns,
      warnings: parsed.warnings,
    },
    { headers }
  );
}
