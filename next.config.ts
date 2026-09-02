import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The case-export pipeline pulls in pdfkit, exceljs and docx — all of
  // which ship binary / non-JS assets (AFM font files for pdfkit, schema
  // files for the office formats). Next's serverless bundler strips
  // anything it doesn't recognise as code, which is why the PDF export
  // was returning a 500 on Vercel ("ENOENT … Helvetica.afm"). Marking
  // these as external packages tells Next to require them at runtime
  // from node_modules — the files come along intact and the generators
  // can read their data.
  serverExternalPackages: ["pdfkit", "exceljs", "docx"],

  // Never let the browser cache the signed-in surfaces. Without this the
  // back/forward cache can resurrect a fully-rendered /app or /admin page
  // after sign-out — so it looks like you're still "in" even though the
  // session is gone. no-store disables that cache; the Back button then
  // re-requests the page and the auth proxy bounces it to /login.
  async headers() {
    const noStore = [
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate, max-age=0",
      },
    ];
    return [
      { source: "/app", headers: noStore },
      { source: "/app/:path*", headers: noStore },
      { source: "/admin", headers: noStore },
      { source: "/admin/:path*", headers: noStore },
    ];
  },
};

export default nextConfig;
