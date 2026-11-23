import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: "299 RELAY Admin",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/mark.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} antialiased`}>
      <body className="min-h-dvh bg-band" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
