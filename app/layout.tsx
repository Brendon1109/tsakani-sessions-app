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
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "Tsakani Sessions",
    description:
      "Two Tales of Happiness, Friendship & Brotherhood. Premium DJ entertainment and content creation — Cape Town.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://tsakani-sessions-app.vercel.app",
    siteName: "Tsakani Sessions",
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "Tsakani Sessions",
      },
    ],
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tsakani Sessions",
    description:
      "Two Tales of Happiness, Friendship & Brotherhood. Cape Town DJ entertainment.",
    images: ["/icons/icon-512x512.png"],
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
