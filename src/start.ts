import { ADMIN_HOST, PLATFORM_ORIGIN } from "@/lib/operations-routing";
import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (request && new URL(request.url).pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const adminHostMiddleware = createMiddleware().server(async ({ request, next }) => {
 const url = new URL(request.url);
 const documentRequest = request.method === "GET" && request.headers.get("accept")?.includes("text/html");
 if (documentRequest && url.hostname === ADMIN_HOST && url.pathname === "/admin") {
   return Response.redirect(`https://${ADMIN_HOST}/${url.search}`, 302);
 }
 if (documentRequest && url.hostname === ADMIN_HOST && url.pathname !== "/" && url.pathname !== "/admin/community" && !url.pathname.startsWith("/lovable/")) {
   return Response.redirect(PLATFORM_ORIGIN + url.pathname + url.search, 302);
 }
 return next();
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, adminHostMiddleware, csrfMiddleware],
}));
