import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";
import "./globals.css";

// Public (client-exposed) GTM container ID, e.g. "GTM-XXXXXXX". Read from the
// environment so the ID is never hardcoded; GA4 fires via a tag inside GTM.
const gtmId = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID;

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute base for canonical + OG URLs. Must match the redirect *target*
  // (www), so Google consolidates the apex → www 308 onto one canonical URL.
  metadataBase: new URL("https://www.dharmaautomations.com"),
  title: "Dharma Automations · Gmail-native AI email assistant",
  description: "Gmail-native AI that drafts replies in your voice, schedules meetings, and sorts your inbox. No links, no setup, no new tools.",
  icons: { icon: "/logo.png" },
  verification: { google: "SUsOgV_GSE3i_oIVGZ_T27koRqa9PpfNU4S_wqtNO38" },
  // Default canonical for the homepage (a client component that can't export
  // its own metadata). Child routes override this via their own `alternates`.
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
      <body className={`${plusJakartaSans.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}
