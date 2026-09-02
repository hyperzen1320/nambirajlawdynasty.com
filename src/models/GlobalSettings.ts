import mongoose, { Schema, Types, type Model } from "mongoose";

// Platform-wide settings, stored as a SINGLE document (a singleton, guarded by
// the unique `singleton` key). Today it carries the maintenance switch; future
// global toggles live here too.
export interface IGlobalSettings {
  _id: Types.ObjectId;
  singleton: "global";
  maintenanceMode: boolean;
  maintenanceMessage: string;
  createdAt: Date;
  updatedAt: Date;
}

const GlobalSettingsSchema = new Schema<IGlobalSettings>(
  {
    singleton: {
      type: String,
      default: "global",
      unique: true,
      enum: ["global"],
    },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export const GlobalSettings: Model<IGlobalSettings> =
  (mongoose.models.GlobalSettings as Model<IGlobalSettings>) ||
  mongoose.model<IGlobalSettings>("GlobalSettings", GlobalSettingsSchema);
