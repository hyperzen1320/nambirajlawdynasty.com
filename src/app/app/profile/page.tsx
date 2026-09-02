import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Partner } from "@/models/Partner";
import { DEFAULT_NOTICE_TEMPLATE } from "@/lib/notice-template";
import MyProfileClient, { type ProfileData } from "./MyProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  let profile: ProfileData | null = null;
  let noticeTemplate = DEFAULT_NOTICE_TEMPLATE;
  const isAdmin = session?.user?.userType === "partner_admin";

  if (session?.user?.id) {
    await connectDB();
    const [user, partner] = await Promise.all([
      User.findById(new mongoose.Types.ObjectId(session.user.id)).lean(),
      session.user.partnerId
        ? Partner.findById(
            new mongoose.Types.ObjectId(session.user.partnerId)
          )
            .select("noticeTemplate")
            .lean()
        : null,
    ]);
    if (partner?.noticeTemplate) noticeTemplate = partner.noticeTemplate;
    if (user) {
      profile = {
        id: String(user._id),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`.trim(),
        phone: user.phone || "",
        state: user.state || "",
        country: user.country || "India",
        officeAddress: user.officeAddress || "",
        barEnrolmentNo: user.barEnrolmentNo || "",
        designation: user.designation || "",
        profilePhoto: user.profilePhoto || "",
      };
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="text-center">
          <h2
            className="text-[30px] font-semibold tracking-tight leading-[1.1] sm:text-[40px]"
            style={{
              fontFamily: "var(--font-crimson), Georgia, serif",
              color: "var(--color-app-ink)",
            }}
          >
            My Profile
          </h2>
          <p
            className="mt-2 text-[13px]"
            style={{
              fontFamily: "var(--font-manrope), sans-serif",
              color: "var(--color-app-fg-muted)",
            }}
          >
            Personal and office identity.
          </p>
          <div
            className="mx-auto mt-5 h-px w-16"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--color-app-copper), transparent)",
            }}
          />
        </div>
        <NambirajBanner />

        {profile ? (
          <MyProfileClient
            initialProfile={profile}
            noticeTemplate={noticeTemplate}
            isAdmin={isAdmin}
          />
        ) : null}
      </div>
    </div>
  );
}

// A "visit the public site" banner under the centred page title — full width,
// text on the left and the link on the right, so the header reads as one piece.
function NambirajBanner() {
  return (
    <a
      href="https://legalezi.com"
      target="_blank"
      rel="noopener noreferrer"
      className="group mt-7 flex flex-col gap-5 rounded-2xl px-7 py-6 transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:px-9 sm:py-7"
      style={{
        background:
          "linear-gradient(120deg, var(--color-app-ink-2) 0%, var(--color-app-ink) 100%)",
        boxShadow: "0 16px 38px -22px rgba(18,29,53,0.55)",
      }}
    >
      <div className="min-w-0">
        <div
          className="text-[9px] uppercase tracking-[0.24em]"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "var(--color-app-copper-bright)",
          }}
        >
          The Firm Online
        </div>
        <div
          className="mt-2 text-[24px] font-semibold leading-tight tracking-tight sm:text-[28px]"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            color: "var(--color-app-ivory)",
          }}
        >
          Nambiraj Law Dynasty
        </div>
        <p
          className="mt-1.5 max-w-2xl text-[13px] leading-6"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            color: "var(--color-app-ivory-soft)",
          }}
        >
          Visit our public chambers website — the firm&rsquo;s heritage,
          practice areas and contact.
        </p>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-2 rounded-lg px-6 py-3.5 text-[13px] font-semibold transition-transform group-hover:translate-x-0.5"
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          backgroundColor: "rgba(197,133,58,0.14)",
          color: "var(--color-app-copper-bright)",
          border: "1px solid rgba(197,133,58,0.35)",
        }}
      >
        legalezi.com
        <span aria-hidden>↗</span>
      </span>
    </a>
  );
}
