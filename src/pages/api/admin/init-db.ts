import type { APIRoute } from "astro";
import { initSchema } from "../../../lib/db";

export const prerender = false;

/**
 * Idempotent schema setup. Run once during initial setup, then again any time
 * we add a column. Safe to call repeatedly.
 *
 * Behind /admin auth via src/middleware.ts.
 *
 *   visit:  https://activebengaluru.org/api/admin/init-db
 */
export const GET: APIRoute = async () => {
  try {
    await initSchema();
    return new Response(
      JSON.stringify({ ok: true, message: "Schema is up to date." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
