import type { Metadata } from "next";
import {
  Fraunces,
  Newsreader,
  JetBrains_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Crimson_Pro,
  Manrope,
  DM_Mono,
  Playfair_Display,
  Inter,
} from "next/font/google";
import "./globals.css";
import DisclaimerGate from "@/components/DisclaimerGate";

// Company site (NAMBIRAJ) — heritage pairing: a high-contrast display serif
// over a clean grotesque, matching the reference exactly.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jb-mono",
  subsets: ["latin"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title:
    "Legalezi — Your office, every hearing, every client, under one cover.",
  description:
    "An advocate office, in your pocket. Cases, hearings, clients, courts, workflow, and document export — built for the Indian Bar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the pre-paint disclaimer script below stamps
    // data-disclaimer-ack onto <html> before React hydrates. This silences the
    // mismatch for this element's own attributes only, not its children.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${newsreader.variable} ${jetbrainsMono.variable} ${plexSans.variable} ${plexMono.variable} ${crimsonPro.variable} ${manrope.variable} ${dmMono.variable} ${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        {/*
          Runs before first paint: a visitor who has already accepted the Bar
          Council disclaimer gets the overlay hidden by CSS immediately, so it
          never flashes while React hydrates. The gate itself is server-
          rendered open, which keeps the reverse case (a first-time visitor
          glimpsing the site behind it) from happening either.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('nld:disclaimer-accepted')==='1'){document.documentElement.setAttribute('data-disclaimer-ack','1')}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">
        {children}
        <DisclaimerGate />
      </body>
    </html>
  );
}
