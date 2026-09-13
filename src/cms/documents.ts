// Every editable document on the site: its admin label, its fields, and its
// default content. The defaults are the site's original copy, and they do two
// jobs — they seed the database (scripts/cms-seed-sql.mts turns them into
// supabase/seed.sql) and they are the fallback the site renders whenever
// Supabase is not configured or cannot be reached, so a page is never blank.
//
// Keep this file free of runtime imports (type imports only): the seed script
// loads it directly under Node's TypeScript type stripping.

import type { Field, InferFields } from "./fields";

function defineDocument<const S extends readonly Field[]>(doc: {
  label: string;
  description: string;
  /** Public page this document feeds, for the admin's "View page" link. */
  path: string | null;
  fields: S;
  defaults: InferFields<S>;
}) {
  return doc;
}

/* ───────────────────────── shared field sets ───────────────────────── */

const seo = {
  type: "group",
  name: "seo",
  label: "Search & sharing",
  help: "What Google and link previews show for this page.",
  fields: [
    { type: "text", name: "title", label: "Page title" },
    { type: "textarea", name: "description", label: "Description", rows: 3 },
  ],
} as const satisfies Field;

const heroFields = [
  { type: "text", name: "eyebrow", label: "Eyebrow", help: "Small gold line above the title." },
  { type: "text", name: "title", label: "Title" },
  { type: "textarea", name: "lead", label: "Lead paragraph", rows: 3, help: "Optional." },
] as const satisfies readonly Field[];

const cta = {
  type: "group",
  name: "cta",
  label: "Closing call to action",
  fields: [
    { type: "text", name: "heading", label: "Heading" },
    { type: "textarea", name: "body", label: "Text", rows: 2 },
    { type: "text", name: "buttonLabel", label: "Button label", help: "The button opens the Contact page." },
  ],
} as const satisfies Field;

const ICONS = [
  { value: "section", label: "§ Section mark" },
  { value: "courthouse", label: "Courthouse" },
  { value: "scales", label: "Scales of justice" },
  { value: "gavel", label: "Gavel" },
  { value: "document", label: "Document" },
  { value: "shield", label: "Shield" },
] as const;

const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X (Twitter)" },
] as const;

/* ───────────────────────────── documents ───────────────────────────── */

const site = defineDocument({
  label: "Site settings",
  description: "Brand, navigation, office details, social links and footer — shared by every page.",
  path: "/",
  fields: [
    {
      type: "group",
      name: "brand",
      label: "Brand",
      fields: [
        { type: "text", name: "name", label: "Wordmark", help: "Large line beside the logo." },
        { type: "text", name: "tagline", label: "Wordmark sub-line" },
        { type: "image", name: "logo", label: "Logo" },
      ],
    },
    {
      type: "group",
      name: "seo",
      label: "Default search & sharing",
      help: "Used wherever a page doesn't set its own.",
      fields: [
        { type: "text", name: "title", label: "Site title" },
        { type: "textarea", name: "description", label: "Description", rows: 3 },
      ],
    },
    {
      type: "list",
      name: "nav",
      label: "Navigation",
      help: "Header menu, mobile menu and the footer's Explore column.",
      itemLabel: "menu item",
      titleField: "label",
      fields: [
        { type: "text", name: "label", label: "Label" },
        { type: "url", name: "href", label: "Link", placeholder: "/services" },
        {
          type: "list",
          name: "children",
          label: "Dropdown items",
          help: "Optional. Items here turn the entry into a dropdown on desktop.",
          itemLabel: "dropdown item",
          titleField: "label",
          fields: [
            { type: "text", name: "label", label: "Label" },
            { type: "url", name: "href", label: "Link", placeholder: "/about#about-us" },
          ],
        },
      ],
    },
    {
      type: "group",
      name: "contact",
      label: "Office & contact details",
      help: "Shown in the footer and on the Contact page.",
      fields: [
        { type: "textarea", name: "address", label: "Address", rows: 4, help: "One line per row." },
        { type: "text", name: "email", label: "Email", help: "Also where the enquiry form's email fallback goes." },
        {
          type: "list",
          name: "phones",
          label: "Phone numbers",
          itemLabel: "phone number",
          titleField: "display",
          fields: [
            { type: "text", name: "display", label: "As displayed", placeholder: "+91 63695 04141" },
            { type: "text", name: "number", label: "Dialled number", placeholder: "+916369504141" },
          ],
        },
        {
          type: "text",
          name: "whatsappNumber",
          label: "WhatsApp number",
          help: "Country code and number, digits only — e.g. 916369504141.",
        },
        { type: "textarea", name: "whatsappMessage", label: "WhatsApp greeting", rows: 2, help: "Pre-filled in the visitor's chat." },
        { type: "text", name: "hours", label: "Office hours" },
      ],
    },
    {
      type: "list",
      name: "social",
      label: "Social links",
      itemLabel: "social link",
      titleField: "platform",
      fields: [
        { type: "select", name: "platform", label: "Platform", options: SOCIAL_PLATFORMS },
        { type: "url", name: "url", label: "Profile link" },
      ],
    },
    {
      type: "group",
      name: "footer",
      label: "Footer",
      fields: [
        { type: "textarea", name: "about", label: "About blurb", rows: 3 },
        { type: "text", name: "exploreHeading", label: "Links column heading" },
        { type: "text", name: "officeHeading", label: "Office column heading" },
        { type: "text", name: "copyright", label: "Copyright line" },
      ],
    },
  ],
  defaults: {
    brand: { name: "NAMBIRAJ", tagline: "LAW DYNASTY", logo: "/logo.png" },
    seo: {
      title: "Nambiraj Law Dynasty — Justice is our lineage",
      description:
        "Continuing the legacy of Mr. C. Nambiraj — timeless ethical values with modern legal infrastructure.",
    },
    nav: [
      { label: "Home", href: "/", children: [] },
      {
        label: "The Firm",
        href: "/about",
        children: [
          { label: "Firm History", href: "/about#firm-history" },
          { label: "About Us", href: "/about#about-us" },
        ],
      },
      { label: "Practicing Area", href: "/practicing-area", children: [] },
      { label: "Services", href: "/services", children: [] },
      { label: "Our Team", href: "/our-team", children: [] },
      { label: "News", href: "/news", children: [] },
      { label: "Contact Us", href: "/contact", children: [] },
    ],
    contact: {
      address: "Nambiraj Law Dynasty LLP.,\nH-14, T.N.H.B. Colony, 2nd Phase,\nKrishnagiri - 635 002",
      email: "nambirajlawdynasty@gmail.com",
      phones: [
        { display: "+91 63695 04141", number: "+916369504141" },
        { display: "04343 225164", number: "+914343225164" },
      ],
      whatsappNumber: "916369504141",
      whatsappMessage: "Hello, I would like to inquire about your legal services.",
      hours: "Mon — Sat · 9 AM to 6 PM",
    },
    social: [
      { platform: "instagram", url: "https://www.instagram.com/nambirajlawdynasty" },
      { platform: "facebook", url: "https://www.facebook.com/share/1KD26bRhzb/" },
      { platform: "linkedin", url: "https://www.linkedin.com/in/nambiraj-law-dynasty-8251a0417" },
    ],
    footer: {
      about: "Continuing a 55-year legacy of legal excellence. Dedicated to the vision of Mr. C. Nambiraj.",
      exploreHeading: "Explore",
      officeHeading: "Office",
      copyright: "© 2026 Nambiraj Law Dynasty LLP. All rights reserved.",
    },
  },
});

const home = defineDocument({
  label: "Home page",
  description: "Hero, the founder's story, featured practice areas and the modern-environment section.",
  path: "/",
  fields: [
    seo,
    {
      type: "group",
      name: "hero",
      label: "Hero",
      fields: [
        { type: "image", name: "image", label: "Background photo" },
        { type: "text", name: "badge", label: "Badge", help: "Centred at the top, e.g. “Since 1969”." },
        { type: "text", name: "title", label: "Title" },
        { type: "text", name: "subtitle", label: "Gold sub-title" },
        { type: "textarea", name: "lead", label: "Lead paragraph", rows: 3 },
      ],
    },
    {
      type: "group",
      name: "founder",
      label: "Founder section",
      fields: [
        { type: "image", name: "image", label: "Portrait" },
        { type: "text", name: "imageAlt", label: "Portrait description", help: "Read aloud by screen readers." },
        { type: "text", name: "statNumber", label: "Stat number", placeholder: "55" },
        { type: "text", name: "statSuffix", label: "Stat suffix", placeholder: "+" },
        { type: "textarea", name: "statLabel", label: "Stat label", rows: 2 },
        { type: "text", name: "statSince", label: "Stat footnote" },
        { type: "textarea", name: "heading", label: "Heading", rows: 2, help: "A line break here breaks the heading." },
        { type: "textarea", name: "intro", label: "First paragraph", rows: 3, rich: true },
        { type: "textarea", name: "quote", label: "Quote", rows: 2, help: "Quotation marks are added for you." },
        { type: "textarea", name: "closing", label: "Closing paragraph", rows: 3, rich: true },
      ],
    },
    {
      type: "group",
      name: "areas",
      label: "Practicing areas teaser",
      fields: [
        { type: "text", name: "eyebrow", label: "Eyebrow" },
        { type: "text", name: "heading", label: "Heading" },
        { type: "text", name: "linkLabel", label: "Link label", help: "Links to the Practicing Area page." },
        {
          type: "list",
          name: "items",
          label: "Cards",
          itemLabel: "card",
          titleField: "name",
          fields: [
            { type: "select", name: "icon", label: "Icon", options: ICONS },
            { type: "text", name: "name", label: "Title" },
            { type: "textarea", name: "blurb", label: "Text", rows: 3 },
          ],
        },
      ],
    },
    {
      type: "group",
      name: "environment",
      label: "Modern environment section",
      fields: [
        { type: "text", name: "heading", label: "Heading" },
        { type: "textarea", name: "body", label: "Text", rows: 3, rich: true },
        { type: "lines", name: "bullets", label: "Bullets", itemLabel: "bullet" },
        { type: "image", name: "image", label: "Photo" },
        { type: "text", name: "imageAlt", label: "Photo description" },
      ],
    },
  ],
  defaults: {
    seo: {
      title: "Nambiraj Law Dynasty — Justice is our lineage",
      description:
        "Continuing the legacy of Mr. C. Nambiraj — timeless ethical values with modern legal infrastructure.",
    },
    hero: {
      image: "/hero-library.jpg",
      badge: "Since 1969",
      title: "Justice is not just a profession",
      subtitle: "it is our lineage.",
      lead:
        "Continuing the legacy of Mr. C. Nambiraj, we blend timeless ethical values with modern legal infrastructure to serve the under-privileged and the visionary alike.",
    },
    founder: {
      image: "/nambiraj.jpg",
      imageAlt: "Mr. C. Nambiraj",
      statNumber: "55",
      statSuffix: "+",
      statLabel: "Years of\nPractice",
      statSince: "Since 1969",
      heading: "The Phenomenon of\nMr. C. Nambiraj",
      intro:
        "He was more than a lawyer; he was an intellectual legend who entered practice in 1969 and focused on the welfare of the under-privileged with absolute grace and humility.",
      quote: "A good lawyer throws himself on your part so heartily, that makes him win in all situations.",
      closing:
        "Today, N. Sureka leads a team of talented legal professionals, guiding the dynasty with the same principles of ethical practice and resourcefulness.",
    },
    areas: {
      eyebrow: "Expertise",
      heading: "Practicing Areas",
      linkLabel: "View All Domains",
      items: [
        {
          icon: "section",
          name: "Civil Litigation",
          blurb: "Defending rights and resolving disputes with the same tenacity that built our dynasty.",
        },
        {
          icon: "courthouse",
          name: "Governmental Affairs",
          blurb: "Navigating complex regulatory landscapes with decades of institutional knowledge.",
        },
        {
          icon: "scales",
          name: "Business Law",
          blurb: "Practical knowledge and legal foresight for modern enterprises and startups alike.",
        },
      ],
    },
    environment: {
      heading: "A Modern Learning Environment",
      body:
        "We invest in technology and infrastructure to collaborate effectively while maintaining the highest standards of publication and research.",
      bullets: ["Holistic Frameworks", "Mentoring Relationships", "Exclusive Legal Resources"],
      image: "/modern-office.jpg",
      imageAlt: "Modern office",
    },
  },
});

const about = defineDocument({
  label: "About page",
  description: "The Firm — masthead, Firm History and About Us.",
  path: "/about",
  fields: [
    seo,
    {
      type: "group",
      name: "hero",
      label: "Masthead",
      fields: [
        { type: "text", name: "eyebrow", label: "Eyebrow" },
        { type: "text", name: "title", label: "Title" },
        { type: "text", name: "statNumber", label: "Stat number", placeholder: "55+" },
        { type: "text", name: "statLabel", label: "Stat label" },
      ],
    },
    {
      type: "group",
      name: "history",
      label: "Firm History",
      fields: [
        { type: "text", name: "heading", label: "Heading" },
        { type: "textarea", name: "body", label: "Text", rows: 12, rich: true },
      ],
    },
    {
      type: "group",
      name: "aboutUs",
      label: "About Us",
      fields: [
        { type: "text", name: "heading", label: "Heading" },
        { type: "textarea", name: "body", label: "Text", rows: 12, rich: true },
        { type: "text", name: "ctaLabel", label: "Button label", help: "The button opens the Contact page." },
      ],
    },
  ],
  defaults: {
    seo: {
      title: "About Us — Nambiraj Law Dynasty",
      description:
        "The phenomenon of Mr. C. Nambiraj — 55+ years of legal practice, continued today as the Nambiraj Law Dynasty.",
    },
    hero: {
      eyebrow: "Our Firm",
      title: "About Nambiraj Law Dynasty",
      statNumber: "55+",
      statLabel: "Years of Legal Practice · Since 1969",
    },
    history: {
      heading: "Firm History",
      body: [
        "A good lawyer is not the man who has an eye to every side and angle of contingency, but who throws himself on your part so heartily that it makes him win in all situations. Mr. C. Nambiraj was such a legend — intellectual, smart, learned, cultured, resourceful, wise, modest, demure and exemplary.",
        "He fought for the rights of his clients, focusing on the welfare of the people exceptionally and principally for the under-privileged. He was honest and dedicated to his profession, and maintained an ethical practice throughout his lifetime with cordial relationships with his clients.",
        "He used his talents to the fullest, for all the right purposes — by living for what he believed in, by working very hard, respecting the people he worked with, and living with absolute grace and humility. These are the old fashioned, timeless values that made this man a phenomenon. He earned name, fame and men.",
      ].join("\n\n"),
    },
    aboutUs: {
      heading: "About Us",
      body: [
        "Mr. C. Nambiraj, the founder of this dynasty, began his practice in 1969. After his demise in 2008, the office was succeeded by his daughter **N. Sureka**, who has developed it into a team of talented legal professionals — guided by the principles of C. Nambiraj as *“Nambiraj Law Dynasty”*.",
        "We offer diverse legal, business and governmental backgrounds, bringing vast experience and practical knowledge to each client we represent. The firm prides itself on its commitment to knowing the law and encouraging its professionals to be at the forefront of the latest legal developments.",
        "The firm has built a learning environment, rich with mentoring relationships and knowledge sharing through invaluable publications, holistic frameworks and access to the most exclusive resources. We invest in technology and infrastructure that allows our professionals and clients to work more efficiently, collaborate effectively and maintain standards.",
      ].join("\n\n"),
      ctaLabel: "Consult Our Dynasty",
    },
  },
});

const practiceAreas = defineDocument({
  label: "Practicing Area page",
  description: "The full list of practice domains.",
  path: "/practicing-area",
  fields: [
    seo,
    { type: "group", name: "hero", label: "Masthead", fields: heroFields },
    {
      type: "list",
      name: "areas",
      label: "Practice areas",
      help: "Numbered automatically in this order.",
      itemLabel: "practice area",
      titleField: "name",
      fields: [
        { type: "text", name: "name", label: "Name" },
        { type: "textarea", name: "blurb", label: "Description", rows: 3 },
      ],
    },
  ],
  defaults: {
    seo: {
      title: "Practicing Areas — Nambiraj Law Dynasty",
      description:
        "Nine domains of practice supported by a team of talented professionals and decades of institutional memory.",
    },
    hero: {
      eyebrow: "Expertise",
      title: "Practicing Areas",
      lead: "Nine domains of practice supported by a team of talented professionals and decades of institutional memory.",
    },
    areas: [
      {
        name: "Civil Litigation",
        blurb: "Comprehensive representation in civil disputes — contracts, property, commercial and personal matters.",
      },
      {
        name: "Criminal Defense",
        blurb: "Rigorous defense strategies in trial and appellate courts protecting constitutional rights.",
      },
      {
        name: "Family Law",
        blurb: "Discreet, compassionate counsel for matrimonial, succession, custody and maintenance matters.",
      },
      {
        name: "Corporate & Business Law",
        blurb: "Advising businesses on governance, compliance, contracts and regulatory frameworks.",
      },
      { name: "Property & Real Estate", blurb: "Title verification, land disputes, conveyancing and registration." },
      { name: "Constitutional Law", blurb: "Writ petitions, fundamental rights and public interest litigation." },
      { name: "Governmental Affairs", blurb: "Navigating regulatory frameworks with deep institutional knowledge." },
      { name: "Arbitration & Mediation", blurb: "Out-of-court dispute resolution with practical commercial sense." },
      { name: "Taxation & Revenue", blurb: "Direct and indirect tax disputes, advisory and assessments." },
    ],
  },
});

const services = defineDocument({
  label: "Services page",
  description: "Numbered service groups, each with its service cards.",
  path: "/services",
  fields: [
    seo,
    { type: "group", name: "hero", label: "Masthead", fields: heroFields },
    {
      type: "list",
      name: "groups",
      label: "Service groups",
      help: "Numbered automatically in this order.",
      itemLabel: "service group",
      titleField: "title",
      fields: [
        { type: "text", name: "title", label: "Title" },
        { type: "textarea", name: "description", label: "Description", rows: 3 },
        {
          type: "list",
          name: "items",
          label: "Services",
          itemLabel: "service",
          titleField: "name",
          fields: [
            { type: "text", name: "name", label: "Name" },
            { type: "textarea", name: "blurb", label: "Description", rows: 3 },
          ],
        },
      ],
    },
    cta,
  ],
  defaults: {
    seo: {
      title: "Services — Nambiraj Law Dynasty",
      description:
        "A full spectrum of legal services — from courtroom advocacy to quiet, careful drafting — delivered with the ethical rigor that has defined our practice since 1969.",
    },
    hero: {
      eyebrow: "What We Do",
      title: "Services",
      lead: "A full spectrum of legal services — from courtroom advocacy to quiet, careful drafting — delivered with the ethical rigor that has defined our practice since 1969.",
    },
    groups: [
      {
        title: "Litigation & Dispute Resolution",
        description:
          "Representation and advocacy across trial courts and the High Court, with thorough case preparation at every stage.",
        items: [
          {
            name: "Trial Court Representation",
            blurb:
              "Conducting civil, criminal and family matters before district and metropolitan courts with thorough preparation of pleadings and evidence.",
          },
          {
            name: "High Court Practice",
            blurb: "Drafting and arguing writs, appeals and revisions before the High Court with rigorous case preparation.",
          },
          {
            name: "Arbitration & Mediation",
            blurb:
              "Cost-effective resolution of commercial and civil disputes through institutional and ad-hoc arbitration, conciliation and mediation.",
          },
        ],
      },
      {
        title: "Advisory & Counseling",
        description:
          "Strategic legal counsel for individuals, families and enterprises facing complex or recurring legal questions.",
        items: [
          {
            name: "Strategic Legal Opinions",
            blurb: "Reasoned written opinions on contentious points of law, regulatory exposure and litigation risk.",
          },
          {
            name: "Retainer Advisory",
            blurb: "Ongoing counsel for businesses and HNIs covering day-to-day legal queries, compliance and risk reviews.",
          },
          {
            name: "Pre-Litigation Strategy",
            blurb:
              "Notice drafting, negotiation and settlement structuring to resolve matters before they reach the courtroom.",
          },
        ],
      },
      {
        title: "Drafting & Documentation",
        description:
          "Precision drafting of contracts, deeds and personal instruments — clear, enforceable and tailored to intent.",
        items: [
          {
            name: "Contracts & Agreements",
            blurb: "Commercial contracts, service agreements, NDAs, leases, MoUs and shareholder arrangements.",
          },
          {
            name: "Conveyancing & Title Deeds",
            blurb: "Sale deeds, gift deeds, partition deeds, mortgages and releases drafted with full title verification.",
          },
          {
            name: "Wills, Trusts & Succession",
            blurb: "Confidential preparation of wills, family settlements, trust deeds and succession planning instruments.",
          },
        ],
      },
      {
        title: "Property & Real Estate",
        description: "End-to-end property practice — from due diligence through registration and dispute defence.",
        items: [
          {
            name: "Title Search & Due Diligence",
            blurb: "Verification of ownership, encumbrances and statutory clearances before purchase or financing.",
          },
          {
            name: "Land & Property Disputes",
            blurb: "Recovery of possession, specific performance, partition suits and boundary disputes.",
          },
          {
            name: "Registration & Mutation",
            blurb: "Coordination of registration, stamp duty and revenue mutation across applicable authorities.",
          },
        ],
      },
      {
        title: "Corporate, Tax & Regulatory",
        description: "Practical counsel for businesses navigating compliance, structuring and regulatory engagement.",
        items: [
          {
            name: "Corporate Compliance",
            blurb: "Companies Act, FEMA, labour and sectoral compliance — periodic filings, registers and audit support.",
          },
          {
            name: "Taxation & Revenue Disputes",
            blurb: "Representation in income tax, GST, customs and stamp duty proceedings, including appellate forums.",
          },
          {
            name: "Regulatory Liaison",
            blurb: "Engagement with statutory authorities, licensing bodies and tribunals on behalf of clients.",
          },
        ],
      },
      {
        title: "Registrations & Statutory Filings",
        description:
          "End-to-end assistance with statutory registrations and identity instruments required to start, run and formalise a business.",
        items: [
          {
            name: "GST Registration & Filings",
            blurb:
              "New GST registration, monthly and annual return filings, amendments, cancellations and representation in GST proceedings.",
          },
          {
            name: "FSSAI Food Licence",
            blurb:
              "Basic, State and Central FSSAI registrations and renewals for food businesses, traders, manufacturers and cloud kitchens.",
          },
          {
            name: "Company & LLP Registration",
            blurb:
              "Incorporation of Private Limited Companies, LLPs, OPCs and partnership firms, including MoA/AoA drafting and post-incorporation compliance.",
          },
          {
            name: "Digital Signature Certificate (DSC)",
            blurb:
              "Issuance and renewal of Class 3 Digital Signature Certificates for individuals, directors and authorised signatories.",
          },
          {
            name: "PAN & TAN Applications",
            blurb:
              "Fresh PAN and TAN applications, corrections, reprints and linkage with statutory records for individuals and entities.",
          },
        ],
      },
      {
        title: "Notarial & Allied Services",
        description: "Practical, day-to-day legal services that support both individuals and ongoing client matters.",
        items: [
          {
            name: "Notarisation & Attestation",
            blurb: "Affidavits, declarations, indemnities, power of attorney and document attestations.",
          },
          {
            name: "Court & Document Filing",
            blurb: "Filing, certified copy applications and procedural follow-ups across courts and registries.",
          },
          {
            name: "Legal Audits & Research",
            blurb: "Bespoke legal research, case-law studies and internal legal audits for institutional clients.",
          },
        ],
      },
    ],
    cta: {
      heading: "Not sure which service applies?",
      body: "Share a brief and we will route your matter to the right counsel within the firm.",
      buttonLabel: "Request a Consultation",
    },
  },
});

const team = defineDocument({
  label: "Our Team page",
  description: "Masthead with the founder's portrait, the team cards and the closing call to action.",
  path: "/our-team",
  fields: [
    seo,
    { type: "group", name: "hero", label: "Masthead", fields: heroFields },
    {
      type: "group",
      name: "founder",
      label: "Masthead portrait",
      fields: [
        { type: "image", name: "photo", label: "Portrait" },
        { type: "text", name: "name", label: "Name" },
        { type: "text", name: "role", label: "Role" },
      ],
    },
    {
      type: "list",
      name: "members",
      label: "Team members",
      help: "Shown in this order. Without a photo, a card shows the initials.",
      itemLabel: "team member",
      titleField: "name",
      fields: [
        { type: "text", name: "name", label: "Name" },
        { type: "text", name: "initials", label: "Initials", help: "Optional — worked out from the name if left empty." },
        { type: "text", name: "role", label: "Role", help: "Optional." },
        { type: "textarea", name: "bio", label: "Bio", rows: 3, help: "Optional." },
        { type: "lines", name: "focus", label: "Focus tags", itemLabel: "tag" },
        { type: "image", name: "photo", label: "Photo" },
      ],
    },
    cta,
  ],
  defaults: {
    seo: {
      title: "Our Team — Nambiraj Law Dynasty",
      description:
        "The advocates and counsel who carry the Nambiraj Law Dynasty forward — specialists across litigation, corporate, property and advisory practice.",
    },
    hero: {
      eyebrow: "The People",
      title: "Our Team",
      lead: "The advocates and counsel who carry the Nambiraj Law Dynasty forward — each a specialist, all held to the same standard of diligence and discretion.",
    },
    founder: { photo: "/team/c-nambiraj.jpg", name: "Mr. C. Nambiraj", role: "Founder · Senior Advocate" },
    members: [
      {
        name: "N. Sureka",
        initials: "NS",
        role: "Partner · Senior Advocate",
        bio: "Successor to the dynasty's founder. Trial and appellate advocacy across civil, commercial and family matters, with a record of hard-fought, thoroughly prepared cases.",
        focus: ["Litigation", "Family"],
        photo: "/team/n-sureka.jpg",
      },
      {
        name: "Nagendhran. S",
        initials: "NG",
        role: "Managing Partner · Administration",
        bio: "The visionary behind the Nambiraj Law Dynasty platform, committed to blending law, technology and professional excellence. Inspired by the legacy of Senior Advocate C. Nambiraj.",
        focus: ["Administration", "Technology"],
        photo: "/team/nagendhran-s.jpg",
      },
      {
        name: "L. Pachappan",
        initials: "LP",
        role: "Senior Associate · Criminal Defence",
        bio: "Disciple of C. Nambiraj. Defence strategy and bail-to-trial representation, with a steady focus on protecting constitutional rights.",
        focus: ["Criminal", "Bail"],
        photo: "/team/l-pachappan.jpg",
      },
      {
        name: "Sanjay Balamurugaen",
        initials: "SB",
        role: "Associate Advocate · Real Estate",
        bio: "Handling civil matters and real estate — end-to-end property disputes.",
        focus: ["Real Estate", "Civil"],
        photo: "/team/sanjay-balamurugaen.jpg",
      },
      {
        name: "Syed Safeer Ahmed",
        initials: "SA",
        role: "Senior Advocate Clerk",
        bio: "Handling all clerical work for the chambers.",
        focus: ["Clerical"],
        photo: "/team/syed-safeer-ahmed.jpg",
      },
      {
        name: "G. Pradeepa",
        initials: "GP",
        role: "Junior Associate · Criminal",
        bio: "Assisting on criminal matters from bail to trial.",
        focus: ["Criminal", "Trial"],
        photo: "/team/g-pradeepa.jpg",
      },
      {
        name: "N. Balaji",
        initials: "NB",
        role: "Junior Associate · Civil",
        bio: "Civil, Criminal, Bail, Return of Property and Relaxation",
        focus: ["Civil", "Criminal", "Bail", "Return of Property", "Relaxation"],
        photo: "/team/n-balaji.jpg",
      },
      {
        name: "S. Tharani Shree",
        initials: "TS",
        role: "Junior Advocate · Civil",
        bio: "",
        focus: ["Civil"],
        photo: "/team/s-tharani-shree.jpg",
      },
      {
        name: "S. Saranya",
        initials: "SS",
        role: "Junior Advocate · Civil",
        bio: "",
        focus: ["Civil"],
        photo: "/team/s-saranya.jpg",
      },
      {
        name: "K. Kalaimathi",
        initials: "KK",
        role: "Junior Advocate · Family",
        bio: "",
        focus: ["Family"],
        photo: "/team/k-kalaimathi.jpg",
      },
      {
        name: "S. Abinaya",
        initials: "AB",
        role: "Junior Advocate · Civil & Criminal",
        bio: "",
        focus: ["Civil", "Criminal"],
        photo: "/team/s-abinaya.jpg",
      },
      { name: "A. Kannadhasan", initials: "AK", role: "", bio: "", focus: [], photo: "/team/a-kannadhasan.jpg" },
      { name: "V. Cecilia Abigail", initials: "CA", role: "", bio: "", focus: [], photo: "/team/v-cecilia-abigail.jpg" },
    ],
    cta: {
      heading: "Work with our bench.",
      body: "Tell us about your matter and we’ll route it to the right counsel within the firm.",
      buttonLabel: "Request a Consultation",
    },
  },
});

const contact = defineDocument({
  label: "Contact page",
  description: "Masthead, office panel and the enquiry form. Address, phones and email live in Site settings.",
  path: "/contact",
  fields: [
    seo,
    { type: "group", name: "hero", label: "Masthead", fields: heroFields },
    { type: "text", name: "officeHeading", label: "Office panel heading" },
    { type: "text", name: "whatsappLinkLabel", label: "WhatsApp link text" },
    {
      type: "boolean",
      name: "showWhatsappButton",
      label: "Show the floating WhatsApp button on this page",
    },
    {
      type: "group",
      name: "form",
      label: "Enquiry form",
      fields: [
        { type: "lines", name: "inquiryTypes", label: "Inquiry types", itemLabel: "inquiry type" },
        { type: "text", name: "submitLabel", label: "Submit button label" },
        { type: "textarea", name: "successMessage", label: "Thank-you message", rows: 2 },
      ],
    },
  ],
  defaults: {
    seo: {
      title: "Contact Us — Nambiraj Law Dynasty",
      description:
        "Reach Nambiraj Law Dynasty in Krishnagiri — office address, phone, email and WhatsApp, or send an inquiry.",
    },
    hero: { eyebrow: "Get in Touch", title: "Contact Us", lead: "" },
    officeHeading: "Office",
    whatsappLinkLabel: "Chat with us on WhatsApp",
    showWhatsappButton: true,
    form: {
      inquiryTypes: [
        "Civil Matter",
        "Criminal Matter",
        "Property Dispute",
        "Corporate Advisory",
        "Family Law",
        "Other",
      ],
      submitLabel: "Submit Inquiry",
      successMessage: "Thank you — your enquiry has reached the chambers. We’ll be in touch shortly.",
    },
  },
});

const newsPage = defineDocument({
  label: "News page",
  description: "Heading and wording around the news list. The posts themselves are under News posts.",
  path: "/news",
  fields: [
    seo,
    { type: "group", name: "hero", label: "Masthead", fields: heroFields },
    { type: "text", name: "readMoreLabel", label: "“Read more” link text" },
    { type: "textarea", name: "emptyMessage", label: "Message when there are no posts", rows: 2 },
    { type: "text", name: "backLabel", label: "“Back to news” link text", help: "Shown on each article." },
  ],
  defaults: {
    seo: {
      title: "News — Nambiraj Law Dynasty",
      description: "Updates, announcements and legal insights from the Nambiraj Law Dynasty.",
    },
    hero: {
      eyebrow: "From the Chambers",
      title: "News",
      lead: "Updates, announcements and legal insights from the Nambiraj Law Dynasty.",
    },
    readMoreLabel: "Read more",
    emptyMessage: "There are no news posts yet — please check back soon.",
    backLabel: "All news",
  },
});

const disclaimer = defineDocument({
  label: "Disclaimer popup",
  description: "The Bar Council of India notice visitors accept before entering the site.",
  path: "/",
  fields: [
    {
      type: "boolean",
      name: "enabled",
      label: "Show the disclaimer to new visitors",
    },
    { type: "text", name: "title", label: "Heading" },
    { type: "textarea", name: "intro", label: "Introduction", rows: 3 },
    { type: "lines", name: "bullets", label: "Acknowledgements", itemLabel: "acknowledgement", multiline: true },
    { type: "textarea", name: "closing", label: "Closing paragraph", rows: 4 },
    { type: "text", name: "heading2", label: "Second heading" },
    { type: "textarea", name: "intro2", label: "Second introduction", rows: 3 },
    { type: "lines", name: "bullets2", label: "Second acknowledgements", itemLabel: "acknowledgement", multiline: true },
    { type: "textarea", name: "closing2", label: "Second closing paragraph", rows: 2 },
    { type: "textarea", name: "cookieNote", label: "Cookie note", rows: 2 },
    { type: "text", name: "agreeLabel", label: "Agree button" },
    { type: "text", name: "disagreeLabel", label: "Disagree button" },
    {
      type: "url",
      name: "declineUrl",
      label: "Where “disagree” sends the visitor",
    },
  ],
  defaults: {
    enabled: true,
    title: "DISCLAIMER",
    intro:
      "The rules of the Bar Council of India prohibit law firms from soliciting work or advertising in any manner. By clicking on ‘I AGREE’, the user acknowledges that:",
    bullets: [
      "The user wishes to gain more information about Legalezi, its practice areas and its attorneys, for his/her own information and use;",
      "The information is made available/provided to the user only on his/her specific request and any information obtained or material downloaded from this website is completely at the user’s volition and any transmission, receipt or use of this site is not intended to, and will not, create any lawyer-client relationship; and",
      "None of the information contained on the website is in the nature of a legal opinion or otherwise amounts to any legal advice.",
    ],
    closing:
      "Legalezi is not liable for any consequence of any action taken by the user relying on material/information provided under this website. In cases where the user has any legal issues, he/she in all cases must seek independent legal advice.",
    heading2: "Disclaimer & Confirmation",
    intro2:
      "As per the rules of the Bar Council of India, we are not permitted to solicit work and advertise. By clicking on the “I AGREE” button below, you acknowledge the following:",
    bullets2: [
      "there has been no advertisement, personal communication, solicitation, invitation or inducement of any sort whatsoever from us or any of our members to solicit any work through this website;",
      "you wish to gain more information about us for your own information and use;",
      "the information about us is provided to you on your specific request and any information obtained or materials downloaded from this website is completely at your own volition and any transmission, receipt or use of this site does not create any lawyer-client relationship; and that",
      "we are not liable for any consequence of any action taken by you relying on the material / information provided on this website.",
    ],
    closing2: "If you have any legal issues, you, in all cases, must seek independent legal advice.",
    cookieNote:
      "We use cookies to enhance your experience. By continuing to visit this website you agree to our use of cookies.",
    agreeLabel: "I Agree",
    disagreeLabel: "I Disagree",
    declineUrl: "https://www.google.com",
  },
});

/** Every document, keyed by the id stored in cms_documents.id. */
export const DOCUMENTS = {
  site,
  home,
  about,
  "practice-areas": practiceAreas,
  services,
  team,
  "news-page": newsPage,
  contact,
  disclaimer,
};

export type DocumentId = keyof typeof DOCUMENTS;
export type DocumentData<K extends DocumentId> = (typeof DOCUMENTS)[K]["defaults"];

export const DOCUMENT_IDS = Object.keys(DOCUMENTS) as DocumentId[];

export function isDocumentId(value: string): value is DocumentId {
  return Object.prototype.hasOwnProperty.call(DOCUMENTS, value);
}
