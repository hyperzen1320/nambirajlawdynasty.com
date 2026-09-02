import mongoose, { Schema, Types, type Model } from "mongoose";

export interface ICaseHearing {
  date: Date;
  status: string;
  outcome: string;
  nextDate: Date | null;
}

export interface ICase {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  caseNo: string;
  fileNo: string;
  cnr: string;
  title: string;

  // Parties
  clientId: Types.ObjectId | null;
  clientName: string;
  clientPhone: string;
  clientWhatsapp: string;
  clientAddress: string;
  oppositeParty: string;

  // Representation
  appearingFor: string;
  oppositeAdvocate: string;
  iaNumbers: string;

  // Court — courtId links to the Court Hub master when the user picks
  // from the combobox; the other four fields are denormalised so a case
  // keeps rendering correctly even if the master court is renamed,
  // re-numbered, or deleted. courtNumber is the ordinal ("2", "Hall 3")
  // copied from the picked court at filing time.
  courtId: Types.ObjectId | null;
  courtName: string;
  courtNumber: string;
  courtHall: string;
  courtPlace: string;

  // Status & dates
  status: string;
  nextHearingDate: Date | null;
  lastHearingDate: Date | null;
  hearings: ICaseHearing[];

  // Disposal — set when status transitions to "Disposed", cleared on
  // re-open. Drives every "active vs archived" filter in the app:
  //   • disposedAt: null   → active matter, appears in Case Vault,
  //                          Hearing Track, Dashboard, AI search, etc.
  //   • disposedAt: <Date> → archived, appears ONLY in Disposed Cases.
  // Storing it as a separate field (rather than deriving from status)
  // means re-editing status to "Disposed" twice doesn't move the
  // disposal date around, and it gives us a real timestamp for the
  // archive's chronological view.
  disposedAt: Date | null;
  // The disposal date the office records for the order — editable, and
  // distinct from disposedAt (the system archive timestamp). The archive
  // shows and sorts by this.
  disposalDate: Date | null;
  disposalRemarks: string;
  // C.A. (certified-copy application) status — e.g. Applied / Ready /
  // Delivered — plus whether the client has received the copy. The rest of
  // the disposal record captured when a matter is closed.
  caStatus: string;
  receivedByClient: boolean;

  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

const HearingSchema = new Schema<ICaseHearing>(
  {
    date: { type: Date, required: true },
    status: { type: String, default: "" },
    outcome: { type: String, default: "" },
    nextDate: { type: Date, default: null },
  },
  { _id: false }
);

const CaseSchema = new Schema<ICase>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    caseNo: { type: String, required: true, trim: true },
    fileNo: { type: String, default: "", trim: true },
    cnr: { type: String, default: "", trim: true },
    title: { type: String, default: "", trim: true },

    // Parties
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    clientName: { type: String, default: "", trim: true },
    clientPhone: { type: String, default: "", trim: true },
    clientWhatsapp: { type: String, default: "", trim: true },
    clientAddress: { type: String, default: "", trim: true },
    oppositeParty: { type: String, default: "", trim: true },

    // Representation
    appearingFor: { type: String, default: "", trim: true },
    oppositeAdvocate: { type: String, default: "", trim: true },
    iaNumbers: { type: String, default: "", trim: true },

    // Court
    courtId: { type: Schema.Types.ObjectId, ref: "Court", default: null },
    courtName: { type: String, default: "", trim: true },
    courtNumber: { type: String, default: "", trim: true },
    courtHall: { type: String, default: "", trim: true },
    courtPlace: { type: String, default: "", trim: true },

    status: { type: String, default: "Filed", trim: true },
    nextHearingDate: { type: Date, default: null },
    lastHearingDate: { type: Date, default: null },
    hearings: { type: [HearingSchema], default: [] },
    disposedAt: { type: Date, default: null },
    disposalDate: { type: Date, default: null },
    disposalRemarks: { type: String, default: "", trim: true },
    caStatus: { type: String, default: "", trim: true },
    receivedByClient: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CaseSchema.index({ partnerId: 1, isDeleted: 1, nextHearingDate: 1 });
CaseSchema.index({ partnerId: 1, isDeleted: 1, createdAt: -1 });
CaseSchema.index({ partnerId: 1, caseNo: 1 });

// CNR uniqueness within a chambers. A partial index so it only governs
// LIVE matters with an actual CNR: blank CNRs are allowed to repeat
// (many matters are filed before a CNR is assigned), and a soft-deleted
// matter frees its CNR for re-entry. CNR is normalised to upper-case on
// write (see lib/cnr.ts), so a plain index is enough — no collation
// needed — and "tnch01…"/"TNCH01…" can't both slip through. This is the
// race backstop; lib/cnr.ts does the friendly app-level check first.
CaseSchema.index(
  { partnerId: 1, cnr: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false, cnr: { $gt: "" } },
    name: "uniq_partner_active_cnr",
  }
);
// Active-cases queries hit `disposedAt: null` constantly (Case Vault,
// Hearing Track, Dashboard) — this index keeps the filter index-only.
CaseSchema.index({ partnerId: 1, isDeleted: 1, disposedAt: 1, updatedAt: -1 });
// Disposed-cases page sorts by disposalDate desc — covering index for
// the archive view.
CaseSchema.index({ partnerId: 1, isDeleted: 1, disposedAt: -1 });

export const Case: Model<ICase> =
  (mongoose.models.Case as Model<ICase>) ||
  mongoose.model<ICase>("Case", CaseSchema);
