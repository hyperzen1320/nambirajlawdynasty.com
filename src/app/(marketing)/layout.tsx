import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DisclaimerGate from "@/components/DisclaimerGate";
import { getDocument } from "@/cms/content";

// Shell for every public page. Site settings (brand, menu, office details) and
// the disclaimer come from the CMS through cached reads, so this layout is
// still prerendered and only re-renders when an editor saves.
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [site, disclaimer] = await Promise.all([
    getDocument("site"),
    getDocument("disclaimer"),
  ]);

  return (
    <div
      className="flex min-h-full flex-col"
      style={{
        backgroundColor: "var(--color-heritage-paper)",
        color: "var(--color-heritage-navy)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <Header nav={site.nav} brand={site.brand} />
      <main className="flex-1">{children}</main>
      <Footer site={site} />
      <DisclaimerGate content={disclaimer} />
    </div>
  );
}
