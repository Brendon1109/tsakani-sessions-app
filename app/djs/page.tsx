import type { Metadata } from "next";
import Link from "next/link";
import { Headphones, MessageCircle } from "lucide-react";
import { getDjs } from "@/lib/queries";
import { djImage } from "@/lib/djs";
import DjPhoto from "@/components/DjPhoto";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd";

export const metadata: Metadata = {
  title: "DJs",
  description:
    "Meet the Tsakani Sessions DJs. Deep house, amapiano, gqom and more, live across Cape Town. Book your DJ.",
  alternates: { canonical: "/djs" },
  openGraph: {
    title: "Tsakani Sessions DJs",
    description: "Meet the DJs behind the sound. Book yours.",
    url: "/djs",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tsakani Sessions DJs",
    description: "Meet the DJs behind the sound. Book yours.",
  },
};

export default async function DjsPage() {
  const djs = await getDjs();

  return (
    <div>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "DJs", path: "/djs" },
        ]}
      />

      <section className="py-16 sm:py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            The <span className="text-gold-gradient">DJs</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            The sound behind every session. Pick yours.
          </p>
        </div>
      </section>

      <section className="pb-24 px-4">
        <div className="max-w-7xl mx-auto">
          {djs.length === 0 ? (
            <div className="max-w-2xl mx-auto bg-dark-500 border border-white/10 rounded-2xl p-12 text-center">
              <div className="bg-gold-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Headphones size={36} className="text-gold-500" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold mb-3">The lineup drops soon</h2>
              <p className="text-gray-400 mb-6">Want a DJ now? Tell us about your event.</p>
              <Link
                href="/services"
                className="bg-gold-gradient text-black font-semibold px-6 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <MessageCircle size={16} aria-hidden="true" />
                Book a DJ
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
              {djs.map((dj, index) => (
                <li key={dj.id}>
                  <Link
                    href={`/djs/${dj.slug}`}
                    className="group block h-full bg-dark-500 border border-white/10 rounded-2xl overflow-hidden hover:border-gold-500/40 transition-all duration-300"
                  >
                    <div className="relative aspect-square bg-dark-300 overflow-hidden">
                      <DjPhoto
                        image={djImage(dj)}
                        name={dj.name}
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                        priority={index < 4}
                      />
                    </div>
                    <div className="p-3 sm:p-4">
                      <h2 className="font-bold text-sm sm:text-lg leading-tight break-words group-hover:text-gold-500 transition-colors">
                        {dj.name}
                      </h2>
                      {dj.genres.length > 0 && (
                        <p className="text-gray-400 text-xs sm:text-sm mt-1 line-clamp-2">
                          {dj.genres.join(" · ")}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
