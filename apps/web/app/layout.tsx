import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "299 RELAY",
  description: "Campus errands, carried by students already on the way.",
  applicationName: "299 RELAY",
  appleWebApp: { capable: true, title: "299 RELAY", statusBarStyle: "default" },
  icons: { icon: "/brand/mark.svg", apple: "/brand/mark.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0B1F44",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable} antialiased`}>
      <body className="min-h-dvh">
        <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg sm:border-x sm:border-line">
          {children}
        </div>
        <ServiceWorker />
      </body>
    </html>
  );
}
