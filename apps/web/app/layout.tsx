import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import { Providers } from "@/components/providers";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: "299 RELAY",
  description: "Campus errands, carried by students already on the way.",
  applicationName: "299 RELAY",
  appleWebApp: { capable: true, title: "299 RELAY", statusBarStyle: "default" },
  icons: { icon: "/brand/mark.svg", apple: "/brand/mark.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f8" },
    { media: "(prefers-color-scheme: dark)", color: "#060c1a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} antialiased`}>
      <body className="min-h-dvh" suppressHydrationWarning>
        <Providers>
          <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-band sm:shadow-[0_0_0_1px_var(--border)]">
            {children}
          </div>
        </Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
