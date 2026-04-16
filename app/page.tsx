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

const upcomingEvents = [
  {
    id: 1,
    title: "Tsakani Sessions Sunset Boat Cruise",
    date: "Coming Soon",
    venue: "Cape Town Waterfront",
    status: "Tickets Opening Soon",
    featured: true,
  },
  {
    id: 2,
    title: "Tsakani Sessions Vol. 5",
    date: "TBA",
    venue: "TBA — Cape Town",
    status: "Stay Tuned",
    featured: false,
  },
];

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

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background gradient */}
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

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-gold-500/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-gold-500/60 rounded-full" />
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
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
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className={`group relative bg-dark-500 border rounded-2xl p-6 sm:p-8 hover:border-gold-500/40 transition-all duration-300 ${
                  event.featured
                    ? "border-gold-500/30 bg-gradient-to-br from-dark-500 to-gold-900/10"
                    : "border-white/10"
                }`}
              >
                {event.featured && (
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
                    <p className="text-gray-400 text-sm mb-1">{event.date}</p>
                    <p className="text-gray-500 text-sm">{event.venue}</p>
                    <span className="inline-block mt-3 text-gold-500 text-sm font-medium bg-gold-500/10 px-3 py-1 rounded-full">
                      {event.status}
                    </span>
                  </div>
                </div>
              </div>
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

          {/* YouTube Embeds */}
          <div className="mb-12">
            <h3 className="text-lg font-semibold text-gold-500 mb-6 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
              Latest on YouTube
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <a
                href="https://youtube.com/@tsakanisessions?si=_bLUBTv9sImhsK4R"
                target="_blank"
                rel="noopener noreferrer"
                className="group aspect-video bg-dark-500 rounded-2xl overflow-hidden border border-white/10 hover:border-red-500/30 transition-colors flex items-center justify-center relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-transparent" />
                <div className="text-center z-10">
                  <div className="bg-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="m10 15 5-3-5-3z"/></svg>
                  </div>
                  <p className="text-white font-semibold">Watch on YouTube</p>
                  <p className="text-gray-400 text-sm">@tsakanisessions</p>
                </div>
              </a>
              <div className="flex flex-col justify-center bg-dark-500 border border-white/10 rounded-2xl p-6 sm:p-8">
                <h4 className="text-xl font-bold mb-3">Tsakani Sessions on YouTube</h4>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  Aftermovies, DJ sets, highlights, and behind-the-scenes
                  content. Subscribe to catch every moment from our events.
                </p>
                <a
                  href="https://youtube.com/@tsakanisessions?si=_bLUBTv9sImhsK4R"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-full transition-colors w-fit flex items-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
                  Subscribe on YouTube
                </a>
              </div>
            </div>
          </div>

          {/* TikTok & Instagram */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* TikTok */}
            <a
              href="https://www.tiktok.com/@tsakani_sessions?_r=1&_t=ZS-95aeaagWjob"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-dark-500 border border-white/10 rounded-2xl p-6 sm:p-8 hover:border-gold-500/30 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-white/10 p-2.5 rounded-xl group-hover:bg-white/15 transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                </div>
                <div>
                  <h4 className="font-bold group-hover:text-gold-500 transition-colors">TikTok</h4>
                  <p className="text-gray-500 text-sm">@tsakani_sessions</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Short-form event highlights, DJ clips, transitions, and
                behind-the-scenes content. Quick hits of the Tsakani vibe.
              </p>
              <span className="text-gold-500 text-sm font-medium group-hover:underline flex items-center gap-1">
                Follow on TikTok <ArrowRight size={14} />
              </span>
            </a>

            {/* Instagram */}
            <a
              href="https://instagram.com/tsakani_sessions"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-dark-500 border border-white/10 rounded-2xl p-6 sm:p-8 hover:border-gold-500/30 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-to-br from-purple-600/20 to-orange-500/20 p-2.5 rounded-xl group-hover:from-purple-600/30 group-hover:to-orange-500/30 transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                </div>
                <div>
                  <h4 className="font-bold group-hover:text-gold-500 transition-colors">Instagram</h4>
                  <p className="text-gray-500 text-sm">@tsakani_sessions</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Event photos, stories, Reels, and announcements. The main hub
                for all Tsakani Sessions visual content.
              </p>
              <span className="text-gold-500 text-sm font-medium group-hover:underline flex items-center gap-1">
                Follow on Instagram <ArrowRight size={14} />
              </span>
            </a>
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
