import Link from "next/link";
import Image from "next/image";
import { Camera, Lock, Calendar } from "lucide-react";
import { getGalleries } from "@/lib/queries";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

export default async function GalleryPage() {
  const galleries = await getGalleries();
  const supabase = createClient();

  // Get cover images for galleries that have photos
  const galleriesWithCovers = await Promise.all(
    galleries.map(async (g) => {
      if (g.photo_count === 0) return { ...g, coverUrl: null };

      if (!supabase) return { ...g, coverUrl: null };

      const { data: firstPhoto } = await supabase
        .from("gallery_photos")
        .select("storage_path")
        .eq("gallery_id", g.id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .single();

      if (!firstPhoto) return { ...g, coverUrl: null };

      const { data: urlData } = supabase.storage
        .from("gallery-photos")
        .getPublicUrl(firstPhoto.storage_path);

      return { ...g, coverUrl: urlData?.publicUrl || null };
    })
  );

  const hasGalleries = galleriesWithCovers.some((g) => g.photo_count > 0);

  return (
    <div>
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Event <span className="text-gold-gradient">Gallery</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            Browse photos from our events. Sign in with Google to view and
            download full galleries.
          </p>
          <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mt-4">
            <Lock size={14} />
            Google sign-in required to view individual galleries
          </div>
        </div>
      </section>

      <section className="pb-24 px-4">
        <div className="max-w-7xl mx-auto">
          {!hasGalleries ? (
            <div className="max-w-2xl mx-auto bg-dark-500 border border-white/10 rounded-2xl p-12 text-center">
              <div className="bg-gold-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera size={36} className="text-gold-500" />
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
                <Calendar size={14} />
                View upcoming events
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {galleriesWithCovers
                .filter((g) => g.photo_count > 0)
                .map((gallery) => (
                  <Link
                    key={gallery.slug}
                    href={`/gallery/${gallery.slug}`}
                    className="group bg-dark-500 border border-white/10 rounded-2xl overflow-hidden hover:border-gold-500/30 transition-all duration-300"
                  >
                    <div className="relative aspect-[4/3] bg-dark-300 flex items-center justify-center overflow-hidden">
                      {gallery.coverUrl ? (
                        <Image
                          src={gallery.coverUrl}
                          alt={gallery.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <Camera size={40} className="text-gray-600" />
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold group-hover:text-gold-500 transition-colors">
                        {gallery.title}
                      </h3>
                      <p className="text-gray-500 text-sm mt-1">
                        {gallery.event?.date
                          ? format(new Date(gallery.event.date), "PPP")
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
