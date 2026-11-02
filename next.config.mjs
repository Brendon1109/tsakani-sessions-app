// The one Supabase project this site talks to. connect-src used to allow
// https://*.supabase.co, which is any project, including one an attacker set
// up, so an injected script could have sent data there. The browser is held to
// this host only. Read from the build env (.env.production), with the
// production ref as the fallback.
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin;
  } catch {
    return "https://gryssobrndqukwnjyosf.supabase.co";
  }
})();

// Gallery photos on R2, the same value as PHOTOS_ORIGIN in
// lib/photo-storage.ts (this file cannot import TypeScript, a test keeps the
// two in step). img-src shows them, connect-src lets Save fetch them.
const PHOTOS_ORIGIN = "https://photos.tsakanisessions.co.za";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "i1.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "i2.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "i3.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "i4.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "*.tiktokcdn.com",
      },
      {
        protocol: "https",
        hostname: "*.tiktokcdn-us.com",
      },
      {
        protocol: "https",
        hostname: "p16-sign-va.tiktokcdn.com",
      },
      {
        protocol: "https",
        hostname: "p16-sign.tiktokcdn-us.com",
      },
      {
        protocol: "https",
        hostname: "p19-common-sign-useast1a.tiktokcdn-us.com",
      },
      {
        protocol: "https",
        hostname: "*.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "*.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "scontent.cdninstagram.com",
      },
    ],
  },
  // www to apex. These run inside the app on the Cloudflare Worker, so the
  // zone needs no redirect rule of its own.
  async redirects() {
    const www = [{ type: "host", value: "www.tsakanisessions.co.za" }];
    return [
      {
        source: "/",
        has: www,
        destination: "https://tsakanisessions.co.za/",
        permanent: true,
      },
      {
        source: "/:path+",
        has: www,
        destination: "https://tsakanisessions.co.za/:path+",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://www.tiktok.com",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://*.supabase.co ${PHOTOS_ORIGIN} https://*.googleusercontent.com https://i.ytimg.com`,
              "font-src 'self' https://fonts.gstatic.com",
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com https://www.instagram.com",
              `connect-src 'self' ${SUPABASE_ORIGIN} ${PHOTOS_ORIGIN}`,
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
