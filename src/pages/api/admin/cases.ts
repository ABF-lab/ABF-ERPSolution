import type { APIRoute } from "astro";
import { listCases } from "../../../lib/db";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const cases = await listCases();
    return new Response(
      JSON.stringify({ ok: true, cases }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
