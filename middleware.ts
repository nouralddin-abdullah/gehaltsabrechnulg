import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Skip Next internals and static files (incl. /templates/*.html).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:html|png|jpg|jpeg|svg|ico|json)$).*)",
  ],
};
