import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

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
  title: "Dharma Automations",
  description: "Turn scheduling requests into ready-to-send replies.",
  icons: { icon: "/logo.png" },
  verification: { google: "SUsOgV_GSE3i_oIVGZ_T27koRqa9PpfNU4S_wqtNO38" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}
