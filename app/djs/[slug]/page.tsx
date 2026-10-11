import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getDjBySlug } from "@/lib/queries";
import {
  djImage,
  djShareImage,
  publicDjLinks,
  youtubeVideoId,
  type DjLinkKey,
} from "@/lib/djs";
import DjPhoto from "@/components/DjPhoto";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd";
import {
  InstagramIcon,
  SoundCloudIcon,
  TikTokIcon,
  YouTubeIcon,
} from "@/components/SocialIcons";

const ICONS: Record<DjLinkKey, typeof YouTubeIcon> = {
  youtube_url: YouTubeIcon,
  tiktok_url: TikTokIcon,
  instagram_url: InstagramIcon,
  soundcloud_url: SoundCloudIcon,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dj = await getDjBySlug(slug);
  if (!dj) {
    return {
      title: "DJ not found",
      robots: { index: false, follow: false },
    };
  }

  const genres = dj.genres.length ? `${dj.genres.join(", ")}. ` : "";
  const description =
    dj.description?.replace(/\s+/g, " ").slice(0, 160) ||
    `${genres}${dj.name} plays Tsakani Sessions in Cape Town. Book them for your event.`;
  // Next replaces openGraph and twitter whole per page, so the layout's share
  // image has to be restated for a DJ with no photo and no video.
  const image = djShareImage(dj) ?? "/og-image.jpg";

  return {
    title: dj.name,
    description,
    alternates: { canonical: `/djs/${dj.slug}` },
    openGraph: {
      title: `${dj.name} | Tsakani Sessions`,
      description,
      url: `/djs/${dj.slug}`,
      type: "profile",
      images: [{ url: image, alt: dj.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${dj.name} | Tsakani Sessions`,
      description,
      images: [image],
    },
  };
}

export default async function DjPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dj = await getDjBySlug(slug);
  if (!dj) notFound();

  const videoId = youtubeVideoId(dj.youtube_url);
  const socials = publicDjLinks(dj);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "DJs", path: "/djs" },
          { name: dj.name, path: `/djs/${dj.slug}` },
        ]}
      />

      <article className="max-w-5xl mx-auto px-4 pt-10 sm:pt-16 pb-24">
        <Link
          href="/djs"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-gold-500 text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          All DJs
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-10 items-start">
          <div className="md:col-span-2 relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-dark-300">
            <DjPhoto
              image={djImage(dj)}
              name={dj.name}
              sizes="(min-width: 768px) 40vw, 100vw"
              priority
              variant="hero"
            />
          </div>

          <div className="md:col-span-3">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4 break-words">
              {dj.name}
            </h1>

            {dj.genres.length > 0 && (
              <ul className="flex flex-wrap gap-2 mb-6">
                {dj.genres.map((genre) => (
                  <li
                    key={genre}
                    className="text-gold-500 bg-gold-500/10 border border-gold-500/20 text-xs font-semibold px-3 py-1 rounded-full"
                  >
                    {genre}
                  </li>
                ))}
              </ul>
            )}

            {dj.description && (
              <p className="text-gray-300 leading-relaxed whitespace-pre-line mb-6">
                {dj.description}
              </p>
            )}

            {socials.length > 0 && (
              // Each link pads its 24px icon out to a 44px tap target, and the
              // row is pulled left by the padding so the first icon still lines
              // up with the text above it.
              <div className="flex items-center gap-1 -ml-2.5 mb-8">
                {socials.map(({ key, href, label }) => {
                  const Icon = ICONS[key];
                  return (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${dj.name} on ${label}`}
                      className="p-2.5 text-gray-400 hover:text-gold-500 transition-colors"
                    >
                      <Icon size={24} />
                    </a>
                  );
                })}
              </div>
            )}

            <Link
              href={`/services?dj=${encodeURIComponent(dj.slug)}`}
              data-track="book_dj_click"
              data-track-props={JSON.stringify({ dj: dj.slug, location: "dj-page" })}
              className="bg-gold-gradient text-black font-semibold px-8 py-3.5 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity w-full sm:w-auto"
            >
              <MessageCircle size={18} />
              Book this DJ
            </Link>
          </div>
        </div>

        {videoId && (
          <section className="mt-12 sm:mt-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">
              Watch the <span className="text-gold-gradient">Session</span>
            </h2>
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-dark-300">
              <YouTubeEmbed videoId={videoId} title={`${dj.name} on Tsakani Sessions`} />
            </div>
          </section>
        )}
      </article>
    </>
  );
}
