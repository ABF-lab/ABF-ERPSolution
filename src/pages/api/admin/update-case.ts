import type { APIRoute } from "astro";
import { updateCase } from "../../../lib/db";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body.caseNumber) {
      return new Response(
        JSON.stringify({ ok: false, error: "caseNumber is required to update a case." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { caseNumber, ...updates } = body;
    await updateCase(caseNumber, updates);
    return new Response(
      JSON.stringify({ ok: true, message: "Case updated successfully." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
