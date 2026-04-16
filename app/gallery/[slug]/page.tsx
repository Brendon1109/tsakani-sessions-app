import { notFound } from "next/navigation";
import { getGalleryBySlug } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import GalleryClient from "./GalleryClient";

export const revalidate = 30;

export default async function GallerySlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await getGalleryBySlug(params.slug);
  if (!data) return notFound();

  // Track view for lead capture
  const supabase = createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("gallery_views").insert({
        gallery_id: data.gallery.id,
        user_id: user.id,
      });
    }
  }

  const photos = (data.photos as unknown as { url: string; caption: string | null }[]).map(
    (p) => ({ url: p.url, caption: p.caption || undefined })
  );

  return (
    <GalleryClient
      slug={params.slug}
      title={data.gallery.title}
      description={data.gallery.description}
      date={data.event?.date ? format(new Date(data.event.date), "PPP") : null}
      photos={photos}
    />
  );
}
