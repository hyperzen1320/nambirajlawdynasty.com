import mongoose, { Schema, Types, type Model } from "mongoose";

// A partner's plan is the `key` of a Plan document. Plans are admin-creatable,
// so this is a free-form slug string rather than a fixed enum. The API validates
// that the chosen key actually exists in the Plan collection at assign time.
export type Plan = string;
export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "suspended";

export interface IPartner {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  primaryEmail: string;
  primaryContactName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  plan: Plan;
  subscription: {
    status: SubscriptionStatus;
    startDate: Date;
    endDate: Date;
    seatLimit: number;
    matterLimit: number;
  };
  branding: {
    officeName: string | null;
    letterhead: string | null;
  };
  settings: {
    // Activity log retention. null = keep forever; otherwise the number of
    // days after which entries are auto-pruned (90, 180 or 365 — see
    // VALID_RETENTION in api/app/settings/route.ts).
    activityRetentionDays: number | null;
  };
  // The office's pre-filled WhatsApp hearing-notice template. Admin-editable
  // in My Profile; merge tokens like {{caseNo}} / {{nextHearingDate}} are
  // substituted per matter when the notice is built. Empty = use the default.
  noticeTemplate: string;
  // Which modules this chambers can reach, set by the global admin. Only
  // switched-OFF entries need storing: a key that isn't here is enabled.
  // That's what lets this ship without a migration — every existing
  // chambers has no map at all and therefore keeps everything.
  // See lib/features.ts.
  features?: Map<string, boolean>;
  // How this chambers got here. "admin" = created by a global admin in the
  // console (the only route that existed before self-serve sign-up);
  // "self" = someone signed themselves up on the marketing site and
  // verified their email. Existing rows default to "admin", which is what
  // they are.
  signupSource: "admin" | "self";
  // Set when the primary email proved itself with a one-time code. Only
  // self-serve sign-ups go through that, so it stays null for chambers a
  // global admin created by hand — those are vouched for by the admin.
  emailVerifiedAt: Date | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PartnerSchema = new Schema<IPartner>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    primaryEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    primaryContactName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    plan: {
      type: String,
      default: "trial",
      required: true,
      lowercase: true,
      trim: true,
    },
    subscription: {
      status: {
        type: String,
        enum: ["trial", "active", "past_due", "cancelled", "suspended"],
        default: "trial",
        required: true,
      },
      startDate: { type: Date, required: true, default: () => new Date() },
      endDate: { type: Date, required: true },
      seatLimit: { type: Number, default: 1 },
      matterLimit: { type: Number, default: 100 },
    },
    branding: {
      officeName: { type: String, default: null },
      letterhead: { type: String, default: null },
    },
    settings: {
      activityRetentionDays: {
        type: Number,
        default: null,
      },
    },
    noticeTemplate: { type: String, default: "" },
    features: {
      type: Map,
      of: Boolean,
      default: undefined,
    },
    signupSource: {
      type: String,
      enum: ["admin", "self"],
      default: "admin",
      required: true,
    },
    emailVerifiedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// slug + primaryEmail unique indexes are set on the fields themselves.
PartnerSchema.index({ "subscription.status": 1, isDeleted: 1 });

export const Partner: Model<IPartner> =
  (mongoose.models.Partner as Model<IPartner>) ||
  mongoose.model<IPartner>("Partner", PartnerSchema);
