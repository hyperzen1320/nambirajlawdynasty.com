import HeritageHero from "@/components/HeritageHero";
import Reveal from "@/components/Reveal";
import ContactForm from "./ContactForm";

// NAMBIRAJ LAW DYNASTY — Contact. Navy masthead, then the office details on
// the left and the inquiry form on the right, on the heritage palette.

export const metadata = {
  title: "Contact Us — Nambiraj Law Dynasty",
  description:
    "Reach Nambiraj Law Dynasty in Krishnagiri — office address, phone, email and WhatsApp, or send an inquiry.",
};

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

const WHATSAPP_HREF =
  "https://wa.me/916369504141?text=" +
  encodeURIComponent("Hello, I would like to inquire about your legal services.");

export default function ContactPage() {
  return (
    <>
      <HeritageHero eyebrow="Get in Touch" title="Contact Us" />

      <section
        style={{
          backgroundColor:
            "color-mix(in oklch, var(--color-heritage-stone) 35%, white)",
        }}
      >
        <div className="mx-auto max-w-[1320px] px-6 py-16 md:px-10 md:py-24">
          <div className="grid gap-12 md:grid-cols-12 md:gap-16">
            {/* Office details */}
            <div className="md:col-span-5">
              <Reveal>
                <h2
                  className="text-[30px] tracking-[-0.01em] md:text-[36px]"
                  style={{
                    fontFamily: playfair,
                    color: "var(--color-heritage-navy)",
                  }}
                >
                  Office
                </h2>

                <dl className="mt-10 space-y-8">
                  <Detail label="Address">
                    Nambiraj Law Dynasty LLP.,
                    <br />
                    H-14, T.N.H.B. Colony, 2nd Phase,
                    <br />
                    Krishnagiri - 635 002
                  </Detail>

                  <Detail label="Email">
                    <a
                      href="mailto:nambirajlawdynasty@gmail.com"
                      className="transition-colors hover:text-[var(--color-heritage-gold-deep)]"
                    >
                      nambirajlawdynasty@gmail.com
                    </a>
                  </Detail>

                  <Detail label="Phone">
                    <a
                      href="tel:+916369504141"
                      className="transition-colors hover:text-[var(--color-heritage-gold-deep)]"
                    >
                      +91 63695 04141
                    </a>
                    <br />
                    <a
                      href="tel:+914343225164"
                      className="transition-colors hover:text-[var(--color-heritage-gold-deep)]"
                    >
                      04343 225164
                    </a>
                  </Detail>

                  <Detail label="WhatsApp">
                    <a
                      href={WHATSAPP_HREF}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                      style={{ color: "#1f9d55" }}
                    >
                      Chat with us on WhatsApp
                      <span aria-hidden>→</span>
                    </a>
                  </Detail>

                  <Detail label="Hours">Mon — Sat · 9 AM to 6 PM</Detail>
                </dl>
              </Reveal>
            </div>

            {/* Inquiry form */}
            <div className="md:col-span-7">
              <Reveal delay={0.08}>
                <div
                  className="border bg-white p-7 md:p-10"
                  style={{
                    borderColor: "var(--color-heritage-border)",
                    boxShadow: "0 30px 60px -40px rgba(10,16,28,0.4)",
                  }}
                >
                  <ContactForm />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ fontFamily: inter, color: "var(--color-heritage-gold-deep)" }}
      >
        {label}
      </dt>
      <dd
        className="mt-2 text-[16px] leading-7"
        style={{ fontFamily: inter, color: "var(--color-heritage-navy)" }}
      >
        {children}
      </dd>
    </div>
  );
}
