import { NextResponse } from "next/server";
import { appendRow } from "../../../../lib/adminSheet";

// POST { email, sourcePage? } → 200 { ok: true }
// Adds a row to the Waitlist tab. No auth — this is the public waitlist
// signup endpoint hit from the landing page. Rate limiting and de-dup are
// follow-ups; for now we trust the form. Returns ok even if the sheet write
// fails so the UI can show success (the user already typed their email; no
// reason to make them feel bad about an internal hiccup). Failures log
// server-side and we can backfill from the admin's email if needed.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    sourcePage?: string;
  };

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") ?? "";
  // The homepage lives at "/"; label it "Landing page" for readability. Any
  // other entry point keeps its real path (e.g. "/pricing") so the column
  // still distinguishes future signup sources.
  const rawSource = body.sourcePage?.trim() || "/";
  const sourcePage = rawSource === "/" ? "Landing page" : rawSource;
  const signedUpAt = new Date().toISOString();

  await appendRow("Waitlist", [
    email,
    sourcePage,
    signedUpAt,
    userAgent,
    "not yet", // converted status — admin flips to "yes"/"denied" in the sheet
  ]);

  return NextResponse.json({ ok: true });
}
