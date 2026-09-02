import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { verifyMobileJWT } from "@/lib/jwt";
import { connectDB } from "@/lib/db";
import { Partner } from "@/models/Partner";
import { User } from "@/models/User";
import { corsHeaders } from "@/lib/cors";
import {
  featureForApiPath,
  isFeatureEnabled,
  readFeatures,
  FEATURE_BY_KEY,
  type FeatureMap,
} from "@/lib/features";

export type PartnerRole =
  | "admin"
  | "advocate"
  | "junior"
  | "clerk"
  | "viewer";

export type PartnerContext = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userType: "partner_admin" | "user";
    role: PartnerRole;
    partnerId: string;
  };
  isMobile: boolean;
  /** Modules the global admin has left switched on for this chambers. */
  features: FeatureMap;
};

/**
 * Guards a partner-side route. Accepts either Auth.js cookie session
 * (web partner app) or Bearer JWT (mobile, future). Always returns a context
 * with `partnerId` so handlers can scope their queries by tenant.
 *
 * Also re-checks the partner's subscription status — a suspended/cancelled
 * partner gets blocked here even if they had a valid session.
 */
export async function requirePartner(
  request: Request
): Promise<{ ctx: PartnerContext } | { error: NextResponse }> {
  let userType: string | undefined;
  let partnerId: string | null = null;
  let userId = "";
  let email = "";
  let firstName = "";
  let lastName = "";
  let isMobile = false;

  // Try JWT first (mobile)
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const payload = await verifyMobileJWT(token);
      userType = payload.userType;
      partnerId = payload.partnerId;
      userId = payload.sub;
      email = payload.email;
      firstName = payload.firstName;
      lastName = payload.lastName;
      isMobile = true;
    } catch {
      return {
        error: NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 401, headers: corsHeaders() }
        ),
      };
    }
  } else {
    // Cookie session (web)
    const session = await auth();
    if (!session?.user) {
      return {
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    userType = session.user.userType;
    partnerId = session.user.partnerId;
    userId = session.user.id ?? "";
    email = session.user.email ?? "";
    firstName = session.user.firstName ?? "";
    lastName = session.user.lastName ?? "";
  }

  if (userType !== "partner_admin" && userType !== "user") {
    return {
      error: NextResponse.json(
        { error: "Forbidden — partner side only" },
        { status: 403, headers: isMobile ? corsHeaders() : undefined }
      ),
    };
  }
  if (!partnerId) {
    return {
      error: NextResponse.json(
        { error: "No tenant" },
        { status: 403, headers: isMobile ? corsHeaders() : undefined }
      ),
    };
  }

  // Tenant guard
  await connectDB();
  const partner = await Partner.findById(partnerId).lean();
  if (!partner || partner.isDeleted) {
    return {
      error: NextResponse.json(
        { error: "Account inactive" },
        { status: 403, headers: isMobile ? corsHeaders() : undefined }
      ),
    };
  }
  const status = partner.subscription.status;
  if (status === "suspended" || status === "cancelled") {
    return {
      error: NextResponse.json(
        { error: "Account inactive" },
        { status: 403, headers: isMobile ? corsHeaders() : undefined }
      ),
    };
  }
  if (
    status === "trial" &&
    new Date() > new Date(partner.subscription.endDate)
  ) {
    return {
      error: NextResponse.json(
        { error: "Trial has ended" },
        { status: 403, headers: isMobile ? corsHeaders() : undefined }
      ),
    };
  }

  // Module switches. Enforcing here rather than route-by-route means every
  // partner-side endpoint is covered — including ones written after this —
  // and there's exactly one path→module table to keep honest.
  const features = readFeatures(partner.features);
  const requiredFeature = featureForApiPath(new URL(request.url).pathname);
  if (requiredFeature && !isFeatureEnabled(features, requiredFeature)) {
    return {
      error: NextResponse.json(
        {
          error: FEATURE_BY_KEY[requiredFeature].offMessage,
          code: "feature_disabled",
          feature: requiredFeature,
        },
        { status: 403, headers: isMobile ? corsHeaders() : undefined }
      ),
    };
  }

  // Look up the within-office role (admin/advocate/junior/clerk/viewer).
  // Partner admin always carries the admin role; staff default to junior.
  let role: PartnerRole = userType === "partner_admin" ? "admin" : "junior";
  if (userId && mongoose.isValidObjectId(userId)) {
    const u = await User.findById(userId).select("role active").lean();
    if (u) {
      if (u.active === false) {
        return {
          error: NextResponse.json(
            { error: "Account deactivated" },
            { status: 403, headers: isMobile ? corsHeaders() : undefined }
          ),
        };
      }
      // The partner admin is ALWAYS the office admin — their authority is
      // their userType, not the User.role field, which is frequently left
      // at a staff default (e.g. "advocate") when the account is set up.
      // Only read the stored role for staff; never let it downgrade the
      // admin out of admin-only actions (export, direct delete, approving
      // delete requests). This restores the intent of the line above.
      if (userType !== "partner_admin") {
        const VALID: PartnerRole[] = [
          "admin",
          "advocate",
          "junior",
          "clerk",
          "viewer",
        ];
        if (u.role && VALID.includes(u.role as PartnerRole)) {
          role = u.role as PartnerRole;
        }
      }
    }
  }

  return {
    ctx: {
      user: {
        id: userId,
        email,
        firstName,
        lastName,
        userType: userType as "partner_admin" | "user",
        role,
        partnerId,
      },
      isMobile,
      features,
    },
  };
}
