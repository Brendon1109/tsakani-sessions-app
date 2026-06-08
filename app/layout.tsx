import type { Metadata, Viewport } from "next";
import { Inter, Dancing_Script } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PWARegister from "@/components/PWARegister";
import SiteJsonLd from "@/components/SiteJsonLd";
import AnalyticsTracker from "@/components/AnalyticsTracker";
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

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tsakanisessions.co.za";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tsakani Sessions — DJ & Live Entertainment in Cape Town",
    template: "%s | Tsakani Sessions",
  },
  description:
    "Tsakani Sessions delivers premium DJ entertainment, live performance, and event content creation across Cape Town and South Africa. Book your next experience.",
  keywords: [
    "Tsakani Sessions",
    "Cape Town DJ",
    "DJ entertainment",
    "content creation",
    "events",
    "South Africa",
    "amapiano",
    "house music",
    "event videography",
  ],
  alternates: {
    canonical: "/",
  },
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
    title: "Tsakani Sessions — DJ & Live Entertainment in Cape Town",
    description:
      "Premium DJ entertainment, live performance, and event content creation across Cape Town and South Africa.",
    url: siteUrl,
    siteName: "Tsakani Sessions",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Tsakani Sessions — DJ & Live Entertainment in Cape Town",
      },
    ],
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tsakani Sessions — DJ & Live Entertainment in Cape Town",
    description:
      "Premium DJ entertainment, live performance, and event content creation — Cape Town.",
    images: ["/og-image.jpg"],
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
    <html lang="en-ZA" className={`${inter.variable} ${dancingScript.variable}`}>
      <body className="font-sans bg-black text-white min-h-screen flex flex-col">
        <SiteJsonLd />
        <Navbar />
        <main className="flex-1 pt-16 sm:pt-20">{children}</main>
        <Footer />
        <PWARegister />
        <AnalyticsTracker />
      </body>
    </html>
  );
}
