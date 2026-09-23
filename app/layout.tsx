import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  // 300 (Light) removed: no font-light usage in the codebase — every skipped
  // weight is a render-blocking font file on mobile Lighthouse.
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  // Mono sets only small labels/badges — never the hero LCP text (serif/sans).
  // Skipping preload removes 3+ font files from the critical request chain;
  // swap keeps labels painting instantly with fallback glyphs.
  preload: false,
});

export const metadata: Metadata = {
  title: "NyaySetu — AI Legal Assistance & Document Intelligence",
  description:
    "Plain-language contract simplification, clause risk analysis, and lawyer preparation for tenants, gig workers, and citizens.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
