import { describe, it, expect } from "vitest";
import {
  guessCityFromHeaders,
  GEO_CITY_HEADER,
  GEO_REGION_HEADER,
  type HeaderSource,
} from "./geoGuess";

/** Build a HeaderSource from a plain map (case-insensitive like real Headers). */
function h(map: Record<string, string | undefined>): HeaderSource {
  const lower = new Map(
    Object.entries(map)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k.toLowerCase(), v as string]),
  );
  return { get: (name) => lower.get(name.toLowerCase()) ?? null };
}

describe("guessCityFromHeaders", () => {
  it("matches a plain city + region to a full City record with coords + tz", () => {
    const city = guessCityFromHeaders(
      h({ [GEO_CITY_HEADER]: "Charlotte", [GEO_REGION_HEADER]: "NC" }),
    );
    expect(city).not.toBeNull();
    expect(city).toMatchObject({
      name: "Charlotte",
      state: "NC",
      timezone: "America/New_York",
    });
    expect(typeof city!.lat).toBe("number");
    expect(typeof city!.lng).toBe("number");
  });

  it("decodes URL-encoded multi-word city names", () => {
    const city = guessCityFromHeaders(
      h({ [GEO_CITY_HEADER]: "San%20Francisco", [GEO_REGION_HEADER]: "CA" }),
    );
    expect(city).toMatchObject({ name: "San Francisco", state: "CA" });
  });

  it("returns null when the city header is missing", () => {
    expect(guessCityFromHeaders(h({ [GEO_REGION_HEADER]: "CA" }))).toBeNull();
  });

  it("returns null when the city header is empty", () => {
    expect(
      guessCityFromHeaders(h({ [GEO_CITY_HEADER]: "", [GEO_REGION_HEADER]: "CA" })),
    ).toBeNull();
  });

  it("returns null for an unknown city (no coordless fallback)", () => {
    expect(
      guessCityFromHeaders(
        h({ [GEO_CITY_HEADER]: "Nowheresville", [GEO_REGION_HEADER]: "XX" }),
      ),
    ).toBeNull();
  });

  it("returns null when city matches but region contradicts it", () => {
    // Charlotte exists in NC; a Charlotte/CA claim should not match.
    expect(
      guessCityFromHeaders(
        h({ [GEO_CITY_HEADER]: "Charlotte", [GEO_REGION_HEADER]: "CA" }),
      ),
    ).toBeNull();
  });

  it("still matches by name when region header is absent", () => {
    const city = guessCityFromHeaders(h({ [GEO_CITY_HEADER]: "Seattle" }));
    expect(city).toMatchObject({ name: "Seattle", state: "WA" });
  });

  it("never throws on malformed percent-encoding", () => {
    expect(() =>
      guessCityFromHeaders(h({ [GEO_CITY_HEADER]: "%E0%A4%A" })),
    ).not.toThrow();
    expect(guessCityFromHeaders(h({ [GEO_CITY_HEADER]: "%E0%A4%A" }))).toBeNull();
  });
});
