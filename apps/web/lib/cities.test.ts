import { describe, it, expect } from "vitest";
import { CITIES, searchCities, findCityByName } from "./cities";

describe("CITIES data", () => {
  it("has well-formed entries (name, state, coords, IANA timezone)", () => {
    expect(CITIES.length).toBeGreaterThan(0);
    for (const c of CITIES) {
      expect(c.name).toBeTruthy();
      expect(c.state).toMatch(/^[A-Z]{2}$/);
      expect(Number.isFinite(c.lat)).toBe(true);
      expect(Number.isFinite(c.lng)).toBe(true);
      expect(c.timezone).toContain("/");
    }
  });
});

describe("searchCities", () => {
  it("returns the leading curated cities for an empty query", () => {
    const res = searchCities("");
    expect(res.length).toBe(8);
    expect(res[0]).toEqual(CITIES[0]);
  });

  it("honors the limit argument", () => {
    expect(searchCities("", 3)).toHaveLength(3);
  });

  it("matches on city name, case-insensitively", () => {
    const res = searchCities("boston");
    expect(res.some((c) => c.name === "Boston" && c.state === "MA")).toBe(true);
  });

  it("matches a bare state query against state or name substring", () => {
    const res = searchCities("ny");
    expect(res.length).toBeGreaterThan(0);
    // The predicate is an OR: state equals the query, or the name contains it.
    expect(res.every((c) => c.state === "NY" || c.name.toLowerCase().includes("ny"))).toBe(true);
    // And a NY-state city is actually surfaced.
    expect(res.some((c) => c.state === "NY")).toBe(true);
  });

  it("returns nothing for a nonsense query", () => {
    expect(searchCities("zzzzzznotacity")).toEqual([]);
  });
});

describe("findCityByName", () => {
  it("finds a known city by exact name", () => {
    const c = findCityByName("New York");
    expect(c?.state).toBe("NY");
  });

  it("is case-insensitive and can disambiguate by state", () => {
    expect(findCityByName("new york", "ny")).toBeDefined();
  });

  it("returns undefined when the state does not match", () => {
    expect(findCityByName("New York", "CA")).toBeUndefined();
  });

  it("returns undefined for an unknown city", () => {
    expect(findCityByName("Nowhere City")).toBeUndefined();
  });
});
