import { notFound, redirect } from "next/navigation";
import { getGalleryBySlug } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { eventDateShort } from "@/lib/date";
import GalleryClient from "./GalleryClient";

export const revalidate = 30;

export default async function GallerySlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (!user) {
    redirect(`/auth/signin?redirectTo=/gallery/${params.slug}`);
  }

  const data = await getGalleryBySlug(params.slug);
  if (!data) return notFound();

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
      slug={params.slug}
      title={data.gallery.title}
      description={data.gallery.description}
      date={data.event?.date ? eventDateShort(data.event.date) : null}
      photos={photos}
    />
  );
}
