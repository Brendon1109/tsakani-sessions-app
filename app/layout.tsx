import type { Metadata, Viewport } from "next";
import { Inter, Dancing_Script } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PWARegister from "@/components/PWARegister";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Tsakani Sessions | DJ Entertainment & Content Creation",
    template: "%s | Tsakani Sessions",
  },
  description:
    "Two Tales of Happiness, Friendship & Brotherhood. Premium DJ entertainment and content creation based in Cape Town.",
  keywords: [
    "Tsakani Sessions",
    "Cape Town DJ",
    "DJ entertainment",
    "content creation",
    "events",
    "South Africa",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "/images/tsakani-logo.png",
    apple: "/images/tsakani-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${dancingScript.variable}`}>
      <body className="font-sans bg-black text-white min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pt-16 sm:pt-20">{children}</main>
        <Footer />
        <PWARegister />
      </body>
    </html>
  );
}
