import Link from "next/link";
import { Camera, Lock, Calendar } from "lucide-react";

// Placeholder data — will be replaced with Supabase queries in production
const galleries = [
  {
    slug: "sunset-cruise-2026",
    title: "Sunset Boat Cruise 2026",
    date: "Coming Soon",
    photoCount: 0,
    coverImage: null,
  },
];

export default function GalleryPage() {
  const hasGalleries = galleries.some((g) => g.photoCount > 0);

  return (
    <div>
      {/* Header */}
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

      {/* Gallery Grid */}
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
              {galleries
                .filter((g) => g.photoCount > 0)
                .map((gallery) => (
                  <Link
                    key={gallery.slug}
                    href={`/gallery/${gallery.slug}`}
                    className="group bg-dark-500 border border-white/10 rounded-2xl overflow-hidden hover:border-gold-500/30 transition-all duration-300"
                  >
                    <div className="aspect-[4/3] bg-dark-300 flex items-center justify-center">
                      {gallery.coverImage ? (
                        <img
                          src={gallery.coverImage}
                          alt={gallery.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                        {gallery.date} &middot; {gallery.photoCount} photos
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
