import type { APIRoute } from "astro";
import { listDonations } from "../../../lib/sheets";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const data = await listDonations();
    return new Response(JSON.stringify(data), {
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
