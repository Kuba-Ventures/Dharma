import { NextResponse } from "next/server";
import { searchCities } from "../../../../lib/cities";

// GET /api/geo/cities?q=palo → { matches: City[] }
// Read-only; no auth needed. The list is bundled at build time so this is
// effectively a constant-time JSON lookup.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  return NextResponse.json({ matches: searchCities(q, 10) });
}
