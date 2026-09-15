import type { Metadata } from "next";
import HeritageHero from "@/components/HeritageHero";
import Reveal from "@/components/Reveal";
import WhatsAppFab, { whatsappHref } from "@/components/WhatsAppFab";
import { getDocument } from "@/cms/content";
import ContactForm from "./ContactForm";

// NAMBIRAJ LAW DYNASTY — Contact. Navy masthead, then the office details on
// the left and the inquiry form on the right, on the heritage palette. Page
// wording comes from the "Contact page" CMS document; the address, phones,
// email and WhatsApp number from Site settings, so the footer and this page
// can never disagree.

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getDocument("contact");
  return { title: seo.title, description: seo.description };
}

const playfair = "var(--font-playfair), Georgia, serif";
const inter = "var(--font-inter), system-ui, sans-serif";

export default async function ContactPage() {
  const [page, site] = await Promise.all([getDocument("contact"), getDocument("site")]);
  const { contact } = site;
  const addressLines = contact.address.split("\n").map((l) => l.trim()).filter(Boolean);
  const hasWhatsapp = Boolean(contact.whatsappNumber.replace(/\D/g, ""));

  return (
    <>
      <HeritageHero eyebrow={page.hero.eyebrow} title={page.hero.title} lead={page.hero.lead} />

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
                  {page.officeHeading}
                </h2>

                <dl className="mt-10 space-y-8">
                  {addressLines.length ? (
                    <Detail label="Address">
                      {addressLines.map((line, i) => (
                        <span key={i}>
                          {i > 0 ? <br /> : null}
                          {line}
                        </span>
                      ))}
                    </Detail>
                  ) : null}

                  {contact.email ? (
                    <Detail label="Email">
                      <a
                        href={`mailto:${contact.email}`}
                        className="transition-colors hover:text-[var(--color-heritage-gold-deep)]"
                      >
                        {contact.email}
                      </a>
                    </Detail>
                  ) : null}

                  {contact.phones.length ? (
                    <Detail label="Phone">
                      {contact.phones.map((p, i) => (
                        <span key={`${p.display}-${i}`}>
                          {i > 0 ? <br /> : null}
                          <a
                            href={`tel:${(p.number || p.display).replace(/[^\d+]/g, "")}`}
                            className="transition-colors hover:text-[var(--color-heritage-gold-deep)]"
                          >
                            {p.display || p.number}
                          </a>
                        </span>
                      ))}
                    </Detail>
                  ) : null}

                  {hasWhatsapp ? (
                    <Detail label="WhatsApp">
                      <a
                        href={whatsappHref(contact.whatsappNumber, contact.whatsappMessage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                        style={{ color: "#1f9d55" }}
                      >
                        {page.whatsappLinkLabel || "Chat with us on WhatsApp"}
                        <span aria-hidden>→</span>
                      </a>
                    </Detail>
                  ) : null}

                  {contact.hours ? <Detail label="Hours">{contact.hours}</Detail> : null}
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
                  <ContactForm
                    recipient={contact.email}
                    inquiryTypes={page.form.inquiryTypes}
                    submitLabel={page.form.submitLabel}
                    successMessage={page.form.successMessage}
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* The floating WhatsApp shortcut lives on this page only — it used to
          sit in the marketing layout and follow the visitor everywhere. */}
      {page.showWhatsappButton ? (
        <WhatsAppFab number={contact.whatsappNumber} message={contact.whatsappMessage} />
      ) : null}
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
