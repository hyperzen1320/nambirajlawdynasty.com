// The public NAMBIRAJ company-site navigation — shared by the Header (a client
// component) and the Footer (a server component). It must live in a plain,
// non-"use client" module so both can import the real array without crossing
// the client/server boundary (importing it from the client Header turned it
// into a client-reference proxy and broke prerendering).

export type NavChild = { name: string; href: string };
export type NavItem = { name: string; href: string; children?: NavChild[] };

export const NAV: NavItem[] = [
  { name: "Home", href: "/" },
  {
    name: "The Firm",
    href: "/about",
    // Both entries are sections of /about rather than separate pages, so the
    // dropdown scrolls to them instead of splitting the page in two.
    children: [
      { name: "Firm History", href: "/about#firm-history" },
      { name: "About Us", href: "/about#about-us" },
    ],
  },
  { name: "Practicing Area", href: "/practicing-area" },
  { name: "Services", href: "/services" },
  { name: "Our Team", href: "/our-team" },
  { name: "Contact", href: "/contact" },
];
