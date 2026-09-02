import type { DefaultSession } from "next-auth";

type UserType = "global_admin" | "partner_admin" | "user";

declare module "next-auth" {
  interface User {
    id: string;
    firstName: string;
    lastName: string;
    userType: UserType;
    partnerId: string | null;
  }

  interface Session {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      userType: UserType;
      partnerId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    firstName: string;
    lastName: string;
    userType: UserType;
    partnerId: string | null;
  }
}
