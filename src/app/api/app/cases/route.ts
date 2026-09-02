import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Case } from "@/models/Case";
import { User } from "@/models/User";
import { requirePartner } from "@/lib/partner-auth";
import { corsHeaders } from "@/lib/cors";
import { logWorkflowActivity } from "@/lib/activity";
import {
  buildCaseFilter,
  readCaseFilterParams,
} from "@/lib/case-filter";
import { buildCaseSort, readCaseSort } from "@/lib/case-sort";
import {
  normalizeCnr,
  findCnrConflict,
  cnrConflictMessage,
  isDuplicateKeyError,
} from "@/lib/cnr";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// Caps that exist so a runaway client (or a typo in a URL) can't ask
// the server for the entire collection. 500 is plenty for the Case
// Vault table; the export endpoint has its own larger cap.
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

export async function GET(request: Request) {
  const guard = await requirePartner(request);
  if ("error" in guard) return guard.error;

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);
  const url = new URL(request.url);

  const filterInput = {
    partnerId,
    ...readCaseFilterParams(url.searchParams),
  };
  const filter = buildCaseFilter(filterInput);

  // Pagination params. The Case Vault table doesn't paginate today
  // (it uses a single bumpable limit) but the wire shape is paginated
  // so we can add page controls later without a breaking change.
  const limitParam = Number(url.searchParams.get("limit") || "");
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;
  const pageParam = Number(url.searchParams.get("page") || "");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const skip = (page - 1) * limit;

  // Ordering is a request parameter now, defaulting to newest-filed
  // first. It used to be hard-coded to next-hearing-date, which put a
  // matter listed months out at the far end of a few hundred rows — so a
  // case added minutes ago was the hardest one in the vault to find.
  const sort = readCaseSort(url.searchParams.get("sort"));

  const [docs, total] = await Promise.all([
    Case.find(filter)
      .sort(buildCaseSort(sort))
      .skip(skip)
      .limit(limit)
      .lean(),
    Case.countDocuments(filter),
  ]);

  // Pull the advocate (createdBy) names for the rows we're returning,
  // in one round-trip. The Vault table renders the advocate column and
  // the filter dropdown wants the office roster, so we hand both back.
  const creatorIds = Array.from(
    new Set(
      docs
        .map((d) => (d.createdBy ? String(d.createdBy) : null))
        .filter((x): x is string => Boolean(x))
    )
  );

  const advocateLookup: Array<{
    _id: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
  }> = creatorIds.length > 0
    ? await User.find({
        _id: {
          $in: creatorIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        partnerId,
      })
        .select("firstName lastName email")
        .lean()
    : [];

  const advocateMap = new Map<string, { id: string; name: string }>();
  for (const u of advocateLookup) {
    const name =
      `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;
    advocateMap.set(String(u._id), { id: String(u._id), name });
  }

  const cases = docs.map((c) => {
    const createdById = c.createdBy ? String(c.createdBy) : null;
    const advocate = createdById ? advocateMap.get(createdById) : undefined;
    return {
      id: String(c._id),
      caseNo: c.caseNo,
      fileNo: c.fileNo,
      cnr: c.cnr,
      title: c.title,
      iaNumbers: c.iaNumbers || "",
      clientName: c.clientName,
      clientPhone: c.clientPhone,
      clientWhatsapp: c.clientWhatsapp,
      oppositeParty: c.oppositeParty,
      oppositeAdvocate: c.oppositeAdvocate || "",
      courtId: c.courtId ? String(c.courtId) : null,
      courtName: c.courtName,
      courtNumber: c.courtNumber || "",
      courtHall: c.courtHall,
      courtPlace: c.courtPlace,
      status: c.status,
      appearingFor: c.appearingFor,
      advocateId: createdById,
      advocateName: advocate?.name || "",
      nextHearingDate: c.nextHearingDate
        ? c.nextHearingDate.toISOString()
        : null,
      lastHearingDate: c.lastHearingDate
        ? c.lastHearingDate.toISOString()
        : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  });

  return NextResponse.json(
    {
      cases,
      total,
      page,
      limit,
      sort,
      hasMore: skip + cases.length < total,
    },
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

  const caseNo = typeof body.caseNo === "string" ? body.caseNo.trim() : "";
  if (!caseNo) {
    return NextResponse.json(
      { error: "Case number is required" },
      { status: 400, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
    );
  }

  const str = (k: string): string =>
    typeof body[k] === "string" ? (body[k] as string).trim() : "";

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(guard.ctx.user.partnerId);

  const nextHearingDate =
    typeof body.nextHearingDate === "string" && body.nextHearingDate.length > 0
      ? new Date(body.nextHearingDate)
      : null;
  const lastHearingDate =
    typeof body.lastHearingDate === "string" && body.lastHearingDate.length > 0
      ? new Date(body.lastHearingDate)
      : null;

  // courtId is the link to the Court Hub master — set only if the caller
  // sent a valid ObjectId from picking a court out of the combobox. Free-
  // form court names (typed without picking) leave courtId null and the
  // matter just carries the denormalised strings.
  const courtIdRaw = typeof body.courtId === "string" ? body.courtId : "";
  const courtId =
    courtIdRaw && mongoose.isValidObjectId(courtIdRaw)
      ? new mongoose.Types.ObjectId(courtIdRaw)
      : null;

  // CNR uniqueness. Blank CNRs are fine to repeat (matters get filed
  // before a CNR is assigned); a non-blank one must be free within the
  // chambers. The friendly pre-check runs first; the unique index is the
  // race backstop, caught below.
  const cnr = normalizeCnr(body.cnr);
  if (cnr) {
    const conflict = await findCnrConflict({ partnerId, cnr });
    if (conflict) {
      return NextResponse.json(
        { error: cnrConflictMessage(conflict), code: "cnr_conflict" },
        {
          status: 409,
          headers: guard.ctx.isMobile ? corsHeaders() : undefined,
        }
      );
    }
  }

  let doc;
  try {
    doc = await Case.create({
      partnerId,
      caseNo,
      fileNo: str("fileNo"),
      cnr,
      title: str("title"),

      clientName: str("clientName"),
      clientPhone: str("clientPhone"),
      clientWhatsapp: str("clientWhatsapp"),
      clientAddress: str("clientAddress"),
      oppositeParty: str("oppositeParty"),

      appearingFor: str("appearingFor"),
      oppositeAdvocate: str("oppositeAdvocate"),
      iaNumbers: str("iaNumbers"),

      courtId,
      courtName: str("courtName"),
      courtNumber: str("courtNumber"),
      courtHall: str("courtHall"),
      courtPlace: str("courtPlace"),

      status: str("status") || "Filed",
      nextHearingDate,
      lastHearingDate,

      createdBy: guard.ctx.user.id
        ? new mongoose.Types.ObjectId(guard.ctx.user.id)
        : null,
    });
  } catch (err) {
    // The unique index fired between our pre-check and the insert (two
    // tabs racing the same CNR). Re-resolve the conflict so the message
    // still names the matter that won.
    if (isDuplicateKeyError(err)) {
      const conflict = cnr
        ? await findCnrConflict({ partnerId, cnr })
        : null;
      return NextResponse.json(
        {
          error: conflict
            ? cnrConflictMessage(conflict)
            : "That CNR is already on record under another matter.",
          code: "cnr_conflict",
        },
        {
          status: 409,
          headers: guard.ctx.isMobile ? corsHeaders() : undefined,
        }
      );
    }
    throw err;
  }

  await logWorkflowActivity(guard.ctx, {
    action: "case.created",
    targetType: "case",
    targetId: String(doc._id),
    targetName: doc.caseNo,
    message: `filed case **${doc.caseNo}**${doc.title ? ` — ${doc.title}` : ""}`,
    metadata: {
      caseNo: doc.caseNo,
      fileNo: doc.fileNo,
      cnr: doc.cnr,
      clientName: doc.clientName,
      oppositeParty: doc.oppositeParty,
      courtName: doc.courtName,
    },
  });

  return NextResponse.json(
    { ok: true, id: String(doc._id) },
    { status: 201, headers: guard.ctx.isMobile ? corsHeaders() : undefined }
  );
}
