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
              "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com https://i.ytimg.com",
              "font-src 'self' https://fonts.gstatic.com",
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com https://www.instagram.com",
              "connect-src 'self' https://*.supabase.co",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
