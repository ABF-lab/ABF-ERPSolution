import { defineMiddleware } from "astro:middleware";

const ADMIN_PATH_RE = /^\/admin(\/|$)/;
const ADMIN_API_RE = /^\/api\/admin(\/|$)/;

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  if (!ADMIN_PATH_RE.test(url.pathname) && !ADMIN_API_RE.test(url.pathname)) {
    return next();
  }

  const expectedUser = process.env.ADMIN_USER || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedPass) {
    return new Response("Admin not configured (ADMIN_PASSWORD env var missing).", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const auth = context.request.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return unauthorized();

  const decoded = atob(auth.slice(6));
  const idx = decoded.indexOf(":");
  if (idx < 0) return unauthorized();
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);

  if (user === expectedUser && timingSafeEqual(pass, expectedPass)) {
    return next();
  }
  return unauthorized();
});

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="ABF Admin", charset="UTF-8"',
      "Content-Type": "text/plain",
    },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
