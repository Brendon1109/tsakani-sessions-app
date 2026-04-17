import Link from "next/link";
import Image from "next/image";
import { Camera, Lock, Calendar } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

interface GallerySummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  photo_count: number;
  cover_path: string | null;
  event_title: string | null;
  event_date: string | null;
  is_public: boolean;
}

export default async function GalleryPage() {
  const supabase = createClient();
  let galleries: GallerySummary[] = [];
  const coverUrls: Record<string, string> = {};

  if (supabase) {
    // Single query using gallery_summaries view — no N+1
    const { data } = await supabase
      .from("gallery_summaries")
      .select("*")
      .order("event_date", { ascending: false, nullsFirst: false });

    galleries = (data as GallerySummary[]) || [];

    // Batch-compute public URLs for covers (pure client-side transformation)
    for (const g of galleries) {
      if (g.cover_path) {
        const { data: urlData } = supabase.storage
          .from("gallery-photos")
          .getPublicUrl(g.cover_path);
        if (urlData?.publicUrl) coverUrls[g.id] = urlData.publicUrl;
      }
    }
  }

  const hasGalleries = galleries.some((g) => g.photo_count > 0);

  return (
    <div>
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Event <span className="text-gold-gradient">Gallery</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            Browse photos from our events. Sign in with Google to view full galleries.
          </p>
          <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mt-4">
            <Lock size={14} aria-hidden="true" />
            Google sign-in required to view individual galleries
          </div>
        </div>
      </section>

      <section className="pb-24 px-4">
        <div className="max-w-7xl mx-auto">
          {!hasGalleries ? (
            <div className="max-w-2xl mx-auto bg-dark-500 border border-white/10 rounded-2xl p-12 text-center">
              <div className="bg-gold-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera size={36} className="text-gold-500" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Galleries Coming Soon</h2>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Photos from upcoming events will appear here. Each event gets
                its own gallery accessible via QR code at the venue or from this
                page.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {galleries
                .filter((g) => g.photo_count > 0)
                .map((gallery) => (
                  <Link
                    key={gallery.id}
                    href={`/gallery/${gallery.slug}`}
                    className="group bg-dark-500 border border-white/10 rounded-2xl overflow-hidden hover:border-gold-500/30 transition-all duration-300"
                  >
                    <div className="relative aspect-[4/3] bg-dark-300 flex items-center justify-center overflow-hidden">
                      {coverUrls[gallery.id] ? (
                        <Image
                          src={coverUrls[gallery.id]}
                          alt={gallery.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <Camera size={40} className="text-gray-600" aria-hidden="true" />
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold group-hover:text-gold-500 transition-colors">
                        {gallery.title}
                      </h3>
                      <p className="text-gray-500 text-sm mt-1">
                        {gallery.event_date
                          ? format(new Date(gallery.event_date), "PPP")
                          : "Date TBA"}{" "}
                        &middot; {gallery.photo_count} photos
                      </p>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
