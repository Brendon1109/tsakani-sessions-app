import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Camera, Calendar, ExternalLink, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { eventDateShort } from "@/lib/date";

const PUBLIC_PREVIEW_COUNT = 4;

export const metadata: Metadata = {
  title: "Gallery — Event Photos & Highlights",
  description:
    "Photo galleries from Tsakani Sessions events across Cape Town. Browse highlights, behind-the-scenes shots, and the energy of every night.",
  alternates: { canonical: "/gallery" },
  openGraph: {
    title: "Tsakani Sessions Gallery — Event Photos & Highlights",
    description:
      "Event photos and highlights from Tsakani Sessions nights across Cape Town.",
    url: "/gallery",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tsakani Sessions Gallery — Event Photos & Highlights",
    description:
      "Event photos and highlights from Tsakani Sessions nights across Cape Town.",
  },
};

interface PhotoRow {
  id: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
}

interface GalleryRow {
  id: string;
  title: string;
  slug: string;
  drive_url?: string | null;
  event: { date: string } | null;
  photos: PhotoRow[];
}

const SELECT_WITH_DRIVE =
  "id, title, slug, drive_url, event:events(date), photos:gallery_photos(id, storage_path, caption, sort_order)";
const SELECT_WITHOUT_DRIVE =
  "id, title, slug, event:events(date), photos:gallery_photos(id, storage_path, caption, sort_order)";

export default async function GalleryPage() {
  const supabase = await createClient();
  const sections: Array<{
    id: string;
    title: string;
    slug: string;
    drive_url: string | null;
    eventDate: string | null;
    totalPhotos: number;
    previewPhotos: Array<{ id: string; url: string; caption: string | null }>;
  }> = [];

  if (supabase) {
    const primary = await supabase
      .from("galleries")
      .select(SELECT_WITH_DRIVE)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    const rawData = primary.error
      ? (
          await supabase
            .from("galleries")
            .select(SELECT_WITHOUT_DRIVE)
            .eq("is_public", true)
            .order("created_at", { ascending: false })
        ).data
      : primary.data;

    const rows = (rawData as unknown as GalleryRow[] | null) || [];
    for (const g of rows) {
      const sorted = [...(g.photos || [])].sort((a, b) => a.sort_order - b.sort_order);
      const allPhotos = sorted
        .map((p) => {
          const { data: urlData } = supabase.storage
            .from("gallery-photos")
            .getPublicUrl(p.storage_path);
          return urlData?.publicUrl
            ? { id: p.id, url: urlData.publicUrl, caption: p.caption }
            : null;
        })
        .filter((x): x is { id: string; url: string; caption: string | null } => x !== null);
      if (allPhotos.length === 0) continue;
      sections.push({
        id: g.id,
        title: g.title,
        slug: g.slug,
        drive_url: g.drive_url || null,
        eventDate: g.event?.date || null,
        totalPhotos: allPhotos.length,
        previewPhotos: allPhotos.slice(0, PUBLIC_PREVIEW_COUNT),
      });
    }
  }

  const hasContent = sections.length > 0;

  return (
    <div>
      <section className="py-16 sm:py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Event <span className="text-gold-gradient">Gallery</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            A taste of every night. Sign in to view the full album, or grab
            everything from Google Drive.
          </p>
        </div>
      </section>

      <section className="pb-24 px-4">
        <div className="max-w-7xl mx-auto">
          {!hasContent ? (
            <div className="max-w-2xl mx-auto bg-dark-500 border border-white/10 rounded-2xl p-12 text-center">
              <div className="bg-gold-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera size={36} className="text-gold-500" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Galleries Coming Soon</h2>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Photos from upcoming events will appear here. Full albums will
                be on Google Drive for download.
              </p>
              <Link
                href="/events"
                className="text-gold-500 hover:text-gold-400 text-sm font-medium transition-colors inline-flex items-center gap-1"
              >
                <Calendar size={14} aria-hidden="true" />
                View upcoming events
              </Link>
            </div>
          ) : (
            <div className="space-y-16">
              {sections.map((section) => {
                const hidden = Math.max(0, section.totalPhotos - section.previewPhotos.length);
                return (
                  <div key={section.id}>
                    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 pb-4 border-b border-white/10">
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-bold">
                          <span className="text-gold-gradient">{section.title}</span>
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">
                          {section.eventDate ? eventDateShort(section.eventDate) : null}
                          {section.eventDate && " · "}
                          {section.totalPhotos} photo
                          {section.totalPhotos === 1 ? "" : "s"}
                        </p>
                      </div>
                      {section.drive_url && (
                        <a
                          href={section.drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border border-gold-500/40 text-gold-500 font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:bg-gold-500/10 transition-colors whitespace-nowrap"
                        >
                          Full album on Drive
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </header>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                      {section.previewPhotos.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-square overflow-hidden rounded-lg bg-dark-300"
                        >
                          <Image
                            src={photo.url}
                            alt={photo.caption || section.title}
                            fill
                            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        </a>
                      ))}
                    </div>

                    {hidden > 0 && (
                      <Link
                        href={`/auth/signin?redirectTo=/gallery/${section.slug}`}
                        className="mt-6 block bg-dark-500 border border-gold-500/30 hover:border-gold-500/60 rounded-2xl p-6 sm:p-8 text-center transition-colors"
                      >
                        <div className="bg-gold-500/10 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Lock size={20} className="text-gold-500" aria-hidden="true" />
                        </div>
                        <p className="font-bold text-lg mb-1">
                          {hidden} more photo{hidden === 1 ? "" : "s"} inside
                        </p>
                        <p className="text-gray-400 text-sm mb-4">
                          Sign in with Google to find yours and view the full album.
                        </p>
                        <span className="bg-gold-gradient text-black font-semibold px-6 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                          Sign in to view all {section.totalPhotos}
                        </span>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
