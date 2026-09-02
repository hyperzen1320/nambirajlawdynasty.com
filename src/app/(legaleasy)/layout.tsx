import ProductHeader from "@/components/ProductHeader";
import ProductFooter from "@/components/ProductFooter";

// The Legalezi product surface — the product landing and the sign-in page.
// It carries the product's own editorial chrome (paper + ink, Fraunces),
// kept separate from the NAMBIRAJ company site's heritage chrome so the two
// brands never bleed into one another.
export default function LegaleziLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-body flex min-h-full flex-col bg-paper text-ink">
      <ProductHeader />
      <main className="flex-1">{children}</main>
      <ProductFooter />
    </div>
  );
}
