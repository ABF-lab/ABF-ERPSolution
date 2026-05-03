import type { APIRoute } from "astro";
import { listDonations } from "../../../lib/db";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const donations = await listDonations();
    return new Response(JSON.stringify({ ok: true, donations }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
