import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "./auth.config";
import { connectDB } from "./lib/db";
import { User } from "./models/User";
import { Partner } from "./models/Partner";

class TrialExpiredError extends CredentialsSignin {
  code = "trial_expired";
}
class AccountSuspendedError extends CredentialsSignin {
  code = "account_suspended";
}
class AccountCancelledError extends CredentialsSignin {
  code = "account_cancelled";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        await connectDB();
        const user = await User.findOne({ email, isDeleted: false });
        if (!user || !user.active) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Tenant-level guard: if user is in a partner, the partner must be reachable.
        if (user.userType !== "global_admin" && user.partnerId) {
          const partner = await Partner.findById(user.partnerId).lean();
          if (!partner || partner.isDeleted) return null;

          const status = partner.subscription.status;
          if (status === "suspended") throw new AccountSuspendedError();
          if (status === "cancelled") throw new AccountCancelledError();
          if (
            status === "trial" &&
            new Date() > new Date(partner.subscription.endDate)
          ) {
            throw new TrialExpiredError();
          }
        }

        await User.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() } }
        );

        return {
          id: user._id.toString(),
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          partnerId: user.partnerId ? user.partnerId.toString() : null,
        };
      },
    }),
  ],
});
