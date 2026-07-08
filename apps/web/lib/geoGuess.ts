// Best-guess home city from Vercel's edge geo headers, for prefilling the
// onboarding city picker.
//
// Vercel Functions receive request geo as headers:
//   x-vercel-ip-city            e.g. "San%20Francisco" (URL-encoded)
//   x-vercel-ip-country-region  e.g. "CA"  (ISO subdivision code == US state)
//
// We resolve those against the bundled city dataset and return a match ONLY
// when it snaps to a real City record (with lat/lng/timezone). A near-miss
// returns null so the caller leaves the field empty for the user to type — we
// never write a coordless city, because homeCityLat/homeCityLng/timezone seed
// the milestone library and timezone scheduling, and a null-coord write would
// silently break both.
//
// Browser geolocation is intentionally NOT used (next.config.ts denies the
// geolocation Permissions-Policy). This header read is the only geo source.

import { findCityByName, type City } from "./cities";

/** Minimal shape satisfied by the Web `Headers` object and Next's headers(). */
export interface HeaderSource {
  get(name: string): string | null;
}

export const GEO_CITY_HEADER = "x-vercel-ip-city";
export const GEO_REGION_HEADER = "x-vercel-ip-country-region";

/**
 * Resolve a full City record from Vercel geo headers, or null when the headers
 * are absent/empty or don't match a known city. Never throws.
 */
export function guessCityFromHeaders(headers: HeaderSource): City | null {
  const rawCity = headers.get(GEO_CITY_HEADER);
  if (!rawCity) return null;

  let city: string;
  try {
    city = decodeURIComponent(rawCity).trim();
  } catch {
    // Malformed percent-encoding — treat the raw value as-is rather than throw.
    city = rawCity.trim();
  }
  if (!city) return null;

  const region = headers.get(GEO_REGION_HEADER)?.trim() || undefined;

  // Full-match-only: findCityByName returns undefined unless name (and region,
  // when provided) match a City record exactly.
  return findCityByName(city, region) ?? null;
}
