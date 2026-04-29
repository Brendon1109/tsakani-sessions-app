import Image from "next/image";
import Link from "next/link";
import {
  Music,
  Camera,
  PartyPopper,
  Calendar,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { getFeaturedEvents } from "@/lib/queries";
import { getLatestYouTubeVideos } from "@/lib/youtube";
import { getFeaturedPosts } from "@/lib/social";
import { eventDateShort } from "@/lib/date";

export const revalidate = 60; // Cache for 1 minute, reduces DB hits

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tsakanisessions.co.za";

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Tsakani Sessions",
  description:
    "Premium DJ entertainment, live performance, and event content creation based in Cape Town, South Africa.",
  url: SITE_URL,
  image: `${SITE_URL}/og-image.jpg`,
  logo: `${SITE_URL}/images/tsakani-logo.png`,
  telephone: "+27769961477",
  email: "tsakanisessions@gmail.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Cape Town",
    addressRegion: "Western Cape",
    addressCountry: "ZA",
  },
  areaServed: {
    "@type": "Country",
    name: "South Africa",
  },
  sameAs: [
    "https://instagram.com/tsakani_sessions",
    "https://youtube.com/@tsakanisessions",
    "https://www.tiktok.com/@tsakani_sessions",
  ],
};

const services = [
  {
    icon: PartyPopper,
    title: "Full Tsakani Experience",
    description:
      "Complete event package with DJs, vibe zones, and content creation.",
    href: "/services",
  },
  {
    icon: Music,
    title: "DJ & Live Performance",
    description:
      "Professional DJ selection with curated playlists for your event.",
    href: "/services",
  },
  {
    icon: Camera,
    title: "Content & Documentation",
    description:
      "Professional videography, photography, and post-production.",
    href: "/services",
  },
];

export default async function HomePage() {
  const [events, videos, tiktokPosts, instagramPosts] = await Promise.all([
    getFeaturedEvents(),
    getLatestYouTubeVideos(4),
    getFeaturedPosts("tiktok"),
    getFeaturedPosts("instagram"),
  ]);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessJsonLd),
        }}
      />
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/95 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,215,0,0.08)_0%,_transparent_70%)]" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <Image
            src="/images/tsakani-logo.png"
            alt="Tsakani Sessions"
            width={120}
            height={120}
            className="mx-auto mb-6 w-24 h-24 sm:w-32 sm:h-32 animate-fade-in"
            priority
          />
          <p className="font-cursive text-gold-500 text-xl sm:text-2xl mb-4 animate-fade-in">
            A hi Tsakeni!!
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 animate-slide-up">
            <span className="text-gold-gradient">Tsakani</span> Sessions
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10 animate-slide-up">
            Two Tales of Happiness, Friendship & Brotherhood. Premium DJ
            entertainment and content creation — Cape Town.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <Link
              href="/events"
              className="bg-gold-gradient text-black font-semibold px-8 py-3.5 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Calendar size={18} />
              Upcoming Events
            </Link>
            <Link
              href="/gallery"
              className="border border-gold-500/40 text-gold-500 font-semibold px-8 py-3.5 rounded-full hover:bg-gold-500/10 transition-colors flex items-center gap-2"
            >
              <Camera size={18} />
              View Gallery
            </Link>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-gold-500/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-gold-500/60 rounded-full" />
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
      {events.length > 0 && (
        <section className="py-16 sm:py-24 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold">
                  Upcoming <span className="text-gold-gradient">Events</span>
                </h2>
                <p className="text-gray-400 mt-2">
                  Don&apos;t miss the next Tsakani experience
                </p>
              </div>
              <Link
                href="/events"
                className="hidden sm:flex items-center gap-1 text-gold-500 hover:text-gold-400 text-sm font-medium transition-colors"
              >
                View All <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className={`group relative bg-dark-500 border rounded-2xl p-6 sm:p-8 hover:border-gold-500/40 transition-all duration-300 ${
                    event.is_featured
                      ? "border-gold-500/30 bg-gradient-to-br from-dark-500 to-gold-900/10"
                      : "border-white/10"
                  }`}
                >
                  {event.is_featured && (
                    <div className="absolute top-4 right-4 bg-gold-gradient text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Sparkles size={12} /> Featured
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="bg-gold-500/10 text-gold-500 p-3 rounded-xl">
                      <Calendar size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-1 group-hover:text-gold-500 transition-colors">
                        {event.title}
                      </h3>
                      <p className="text-gray-400 text-sm mb-1">
                        {eventDateShort(event.date)}
                      </p>
                      {event.venue_name && (
                        <p className="text-gray-500 text-sm">{event.venue_name}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <Link
              href="/events"
              className="sm:hidden flex items-center justify-center gap-1 text-gold-500 hover:text-gold-400 text-sm font-medium mt-6 transition-colors"
            >
              View All Events <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      {/* Services Preview */}
      <section className="py-16 sm:py-24 px-4 bg-dark-700/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              What We <span className="text-gold-gradient">Offer</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              From unforgettable DJ sets to professional content creation, we
              bring the complete entertainment experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <Link
                  key={service.title}
                  href={service.href}
                  className="group bg-dark-500 border border-white/10 rounded-2xl p-6 sm:p-8 hover:border-gold-500/30 transition-all duration-300"
                >
                  <div className="bg-gold-500/10 text-gold-500 p-3 rounded-xl w-fit mb-5 group-hover:bg-gold-500/20 transition-colors">
                    <Icon size={28} />
                  </div>
                  <h3 className="text-lg font-bold mb-2 group-hover:text-gold-500 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {service.description}
                  </p>
                  <span className="inline-flex items-center gap-1 text-gold-500 text-sm font-medium mt-4 group-hover:gap-2 transition-all">
                    Learn More <ArrowRight size={14} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Social Content */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Follow the <span className="text-gold-gradient">Vibe</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Watch our latest content, catch up on past events, and stay
              connected across all platforms.
            </p>
          </div>

          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gold-500 flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
                Latest on YouTube
              </h3>
              <a
                href="https://youtube.com/@tsakanisessions?si=_bLUBTv9sImhsK4R"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors flex items-center gap-2"
              >
                Subscribe
              </a>
            </div>

            {videos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {videos.map((video) => (
                  <a
                    key={video.id}
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-dark-500 border border-white/10 rounded-xl overflow-hidden hover:border-red-500/40 transition-all duration-300"
                  >
                    <div className="relative aspect-video bg-dark-300 overflow-hidden">
                      <Image
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, 25vw"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-red-600 w-14 h-14 rounded-full flex items-center justify-center shadow-lg">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="m10 15 5-3-5-3z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-red-400 transition-colors">
                        {video.title}
                      </h4>
                      {video.views !== null && (
                        <p className="text-gray-500 text-xs mt-2">
                          {video.views.toLocaleString()} views
                        </p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="bg-dark-500 border border-white/10 rounded-2xl p-10 text-center">
                <p className="text-gray-400 mb-4">Visit our YouTube channel for the latest mixes.</p>
                <a
                  href="https://youtube.com/@tsakanisessions?si=_bLUBTv9sImhsK4R"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-full transition-colors inline-flex items-center gap-2"
                >
                  Watch on YouTube
                </a>
              </div>
            )}
          </div>

          {/* TikTok */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                Latest on TikTok
              </h3>
              <a
                href="https://www.tiktok.com/@tsakani_sessions?_r=1&_t=ZS-95aeaagWjob"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white hover:bg-gray-200 text-black text-sm font-semibold px-4 py-2 rounded-full transition-colors"
              >
                Follow
              </a>
            </div>

            {tiktokPosts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {tiktokPosts.slice(0, 4).map((post) => (
                  <a
                    key={post.id}
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-dark-500 border border-white/10 rounded-xl overflow-hidden hover:border-white/40 transition-all duration-300"
                  >
                    <div className="relative aspect-[9/16] bg-dark-300 overflow-hidden">
                      {post.thumbnail_url ? (
                        <Image
                          src={post.thumbnail_url}
                          alt={post.caption || "TikTok post"}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="w-full h-full bg-black flex items-center justify-center">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                    </div>
                    {post.caption && (
                      <div className="p-3">
                        <p className="text-sm line-clamp-2 text-gray-300">{post.caption}</p>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            ) : (
              <a
                href="https://www.tiktok.com/@tsakani_sessions?_r=1&_t=ZS-95aeaagWjob"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-dark-500 border border-white/10 rounded-2xl p-6 sm:p-8 hover:border-white/40 transition-all duration-300 flex items-center gap-4 block"
              >
                <div className="bg-black border border-white/20 p-3 rounded-xl">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold">Watch on TikTok</h4>
                  <p className="text-gray-500 text-sm">@tsakani_sessions · Short-form event highlights, DJ clips, and BTS content</p>
                </div>
                <ArrowRight size={20} className="text-gray-400 group-hover:text-white transition-colors" />
              </a>
            )}
          </div>

          {/* Instagram */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-transparent">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#ig-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <defs>
                    <linearGradient id="ig-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#f97316" />
                    </linearGradient>
                  </defs>
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
                Latest on Instagram
              </h3>
              <a
                href="https://instagram.com/tsakani_sessions"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-to-br from-purple-600 to-orange-500 hover:opacity-90 text-white text-sm font-semibold px-4 py-2 rounded-full transition-opacity"
              >
                Follow
              </a>
            </div>

            {instagramPosts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {instagramPosts.slice(0, 4).map((post) => (
                  <a
                    key={post.id}
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-dark-500 border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/40 transition-all duration-300"
                  >
                    <div className="relative aspect-square bg-dark-300 overflow-hidden">
                      {post.thumbnail_url ? (
                        <Image
                          src={post.thumbnail_url}
                          alt={post.caption || "Instagram post"}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                    </div>
                    {post.caption && (
                      <div className="p-3">
                        <p className="text-sm line-clamp-2 text-gray-300">{post.caption}</p>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            ) : (
              <a
                href="https://instagram.com/tsakani_sessions"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-dark-500 border border-white/10 rounded-2xl p-6 sm:p-8 hover:border-purple-500/40 transition-all duration-300 flex items-center gap-4 block"
              >
                <div className="bg-gradient-to-br from-purple-600 to-orange-500 p-3 rounded-xl">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold">Follow on Instagram</h4>
                  <p className="text-gray-500 text-sm">@tsakani_sessions · Event photos, stories, Reels, and announcements</p>
                </div>
                <ArrowRight size={20} className="text-gray-400 group-hover:text-white transition-colors" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to <span className="text-gold-gradient">Tsakani</span>?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Book us for your next event or browse our merch. Let&apos;s create
            an unforgettable experience together.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://wa.me/27769961477?text=Hi%20Tsakani%20Sessions!%20I'd%20like%20to%20enquire%20about%20booking."
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gold-gradient text-black font-semibold px-8 py-3.5 rounded-full hover:opacity-90 transition-opacity"
            >
              Book via WhatsApp
            </a>
            <Link
              href="/shop"
              className="border border-gold-500/40 text-gold-500 font-semibold px-8 py-3.5 rounded-full hover:bg-gold-500/10 transition-colors"
            >
              Shop Merch
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
