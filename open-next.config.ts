import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache, tag cache or revalidation queue, on purpose.
//
// Every public page reads Supabase through the server client, which reads
// cookies, so Next renders those pages per request on Vercel today and the
// old `revalidate` exports never took effect (Next 14's prerender manifest
// and Next 16's route table agree). With nothing to revalidate, an R2 cache
// would add a bucket, a deploy time upload and a queue for no gain. The
// handful of static pages (faq, terms, the admin shells) simply render on
// request, and the one fetch that relied on Next's data cache, the YouTube
// feed on the home page, keeps its own hour long copy in lib/youtube.ts.
//
// The defaults are silent no-ops. If a page ever needs ISR, add the R2 cache
// then, see docs/CLOUDFLARE-MOVE.md.
export default defineCloudflareConfig();
