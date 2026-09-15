import type { NextConfig } from "next";

// Images uploaded through the CMS live in Supabase Storage. Hosted projects
// are all *.supabase.co; a self-hosted Supabase on its own domain is picked up
// from SUPABASE_URL.
const storagePath = "/storage/v1/object/public/**";
const customSupabaseHost = (() => {
  try {
    const { hostname } = new URL(process.env.SUPABASE_URL ?? "");
    return hostname.endsWith(".supabase.co") ? null : hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // CMS reads are cached with "use cache" + cacheTag, and the admin's save
  // action expires them with updateTag — see src/cms/content.ts.
  cacheComponents: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: storagePath },
      ...(customSupabaseHost
        ? [{ protocol: "https" as const, hostname: customSupabaseHost, pathname: storagePath }]
        : []),
    ],
  },
};

export default nextConfig;
