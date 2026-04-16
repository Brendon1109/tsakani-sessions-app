import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match gallery sub-routes (individual galleries require auth)
    "/gallery/:slug+",
    // Match all admin routes
    "/admin/:path*",
  ],
};
