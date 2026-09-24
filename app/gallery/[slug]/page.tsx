import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, ArrowLeft } from "lucide-react";
import { getGalleryBySlug } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { eventDateShort } from "@/lib/date";
import GalleryClient from "./GalleryClient";

function ComingSoon({ slug }: { slug: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full bg-dark-500 border border-white/10 rounded-2xl p-8 sm:p-10 text-center">
        <div className="bg-gold-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Camera size={36} className="text-gold-500" aria-hidden="true" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-3">
          Gallery <span className="text-gold-gradient">Coming Soon</span>
        </h1>
        <p className="text-gray-400 leading-relaxed mb-6">
          Photos from this event aren&apos;t up yet. We&apos;re still curating
          them &mdash; check back soon, or browse other galleries while you
          wait.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/gallery"
            className="bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            Browse other galleries
          </Link>
          <Link
            href="/events"
            className="border border-gold-500/40 text-gold-500 font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:bg-gold-500/10 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to events
          </Link>
        </div>
        <p className="text-xs text-gray-600 mt-6 italic">
          Looking for &ldquo;{slug}&rdquo;
        </p>
      </div>
    </div>
  );
}

export default async function GallerySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getGalleryBySlug(slug);
  if (!data) return <ComingSoon slug={slug} />;

  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (!user) {
    redirect(`/auth/signin?redirectTo=/gallery/${slug}`);
  }

  if (supabase) {
    await supabase.from("gallery_views").insert({
      gallery_id: data.gallery.id,
      user_id: user.id,
    });
  }

  const photos = (data.photos as unknown as { url: string; caption: string | null }[]).map(
    (p) => ({ url: p.url, caption: p.caption || undefined })
  );

  return (
    <GalleryClient
      slug={slug}
      title={data.gallery.title}
      description={data.gallery.description}
      date={data.event?.date ? eventDateShort(data.event.date) : null}
      photos={photos}
    />
  );
}
