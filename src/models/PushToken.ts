import mongoose, { Schema, Types, type Model } from "mongoose";

// One Expo push token per device per signed-in user.
//
// Tokens are the address a notification is delivered to, not a secret: an
// expired or reinstalled app produces a new one and Expo reports the old
// one as DeviceNotRegistered, at which point lib/push.ts deletes it. That
// pruning is why `token` is unique — the same device signing in as a
// different user must move the row, not add a second one, or the previous
// user would keep receiving this office's notifications.
//
// partnerId is denormalised off the user so a send can be tenant-scoped
// in one query.

export interface IPushToken {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  userId: Types.ObjectId;
  /** ExponentPushToken[...] */
  token: string;
  platform: "ios" | "android" | "web";
  /** "Pixel 7" — only so a user can recognise their own devices. */
  deviceName: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PushTokenSchema = new Schema<IPushToken>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: { type: String, required: true, unique: true, trim: true },
    platform: {
      type: String,
      enum: ["ios", "android", "web"],
      default: "android",
    },
    deviceName: { type: String, default: "", trim: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// The send path always asks "which devices do these users have?", scoped
// to one office.
PushTokenSchema.index({ partnerId: 1, userId: 1 });

export const PushToken: Model<IPushToken> =
  (mongoose.models.PushToken as Model<IPushToken>) ||
  mongoose.model<IPushToken>("PushToken", PushTokenSchema);
