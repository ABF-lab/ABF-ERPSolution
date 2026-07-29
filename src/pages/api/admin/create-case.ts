import type { APIRoute } from "astro";
import { insertCase } from "../../../lib/db";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body.patientName || !body.chiefComplaint) {
      return new Response(
        JSON.stringify({ ok: false, error: "Patient Name and Chief Complaint are required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const caseNumber = await insertCase(body);
    return new Response(
      JSON.stringify({ ok: true, caseNumber }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
