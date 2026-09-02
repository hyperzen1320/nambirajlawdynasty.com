import mongoose, { Schema, Types, type Model } from "mongoose";

export type UserType = "global_admin" | "partner_admin" | "user";

// Within-office RBAC role. Independent of `userType`, which is the auth scope.
// `partner_admin` always carries `role: "admin"`; `user` defaults to "junior".
export type UserRole =
  | "admin"
  | "advocate"
  | "junior"
  | "clerk"
  | "viewer";

export const USER_ROLES: UserRole[] = [
  "admin",
  "advocate",
  "junior",
  "clerk",
  "viewer",
];

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  role: UserRole;
  partnerId: Types.ObjectId | null;
  // Profile / identity (matches the requirements doc's "profiles" table)
  phone: string;
  state: string;
  country: string;
  officeAddress: string;
  barEnrolmentNo: string;
  designation: string;
  profilePhoto: string;
  active: boolean;
  isDeleted: boolean;
  invite?: {
    tokenHash: string | null;
    expiresAt: Date | null;
    acceptedAt: Date | null;
  };
  passwordReset?: {
    tokenHash: string | null;
    expiresAt: Date | null;
  };
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    // Only email + password are mandatory for an account. A team member can
    // be added with just login credentials and filled in later, so the name
    // fields default to empty rather than being required (a required empty
    // string used to throw a ValidationError that surfaced as "Network
    // error" on the add-user form).
    firstName: { type: String, default: "", trim: true },
    lastName: { type: String, default: "", trim: true },
    userType: {
      type: String,
      enum: ["global_admin", "partner_admin", "user"],
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "advocate", "junior", "clerk", "viewer"],
      default: "junior",
      required: true,
    },
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      default: null,
    },
    phone: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    country: { type: String, default: "India", trim: true },
    officeAddress: { type: String, default: "", trim: true },
    barEnrolmentNo: { type: String, default: "", trim: true },
    designation: { type: String, default: "", trim: true },
    profilePhoto: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    invite: {
      tokenHash: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      acceptedAt: { type: Date, default: null },
    },
    passwordReset: {
      tokenHash: { type: String, default: null },
      expiresAt: { type: Date, default: null },
    },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// global_admin must NOT have a partnerId; everyone else must.
// Implemented as an async pre-save hook because inline `validate` with a
// typed `this` collides with Mongoose v9's stricter ValidateFn typings.
//
// The same hook also pins partner_admin users to role="admin". The
// schema's role default is "junior", so without this coercion every
// partner-admin who didn't have role set explicitly would carry the
// wrong office role — which is why the Users / Advocates page used to
// show the firm's owner with a "Junior" badge.
UserSchema.pre("save", async function () {
  if (this.userType === "global_admin") {
    if (this.partnerId !== null && this.partnerId !== undefined) {
      throw new Error("global_admin must not have a partnerId");
    }
  } else if (!this.partnerId) {
    throw new Error("partnerId is required for partner_admin/user");
  }
  if (this.userType === "partner_admin" && this.role !== "admin") {
    this.role = "admin";
  }
});

// Compound + secondary indexes (email's unique index is set on the field itself).
UserSchema.index({ partnerId: 1, isDeleted: 1 });
UserSchema.index({ userType: 1 });

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);
