import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFab from "@/components/WhatsAppFab";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-full flex-col"
      style={{
        backgroundColor: "var(--color-heritage-paper)",
        color: "var(--color-heritage-navy)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppFab />
    </div>
  );
}
