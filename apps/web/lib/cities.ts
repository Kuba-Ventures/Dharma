// Top US metros for home-city autocomplete during onboarding. Each entry
// carries lat/lng and an IANA timezone so we can seed milestones tied to the
// city. Curated by population; v2 should ingest the SimpleMaps CC-BY dataset
// for full coverage. Adding rows here is safe — no schema change required.

export type City = {
  name: string;
  state: string;
  lat: number;
  lng: number;
  timezone: string;
};

export const CITIES: City[] = [
  { name: "New York", state: "NY", lat: 40.7128, lng: -74.006, timezone: "America/New_York" },
  { name: "Brooklyn", state: "NY", lat: 40.6782, lng: -73.9442, timezone: "America/New_York" },
  { name: "Jersey City", state: "NJ", lat: 40.7178, lng: -74.0431, timezone: "America/New_York" },
  { name: "Newark", state: "NJ", lat: 40.7357, lng: -74.1724, timezone: "America/New_York" },
  { name: "Boston", state: "MA", lat: 42.3601, lng: -71.0589, timezone: "America/New_York" },
  { name: "Cambridge", state: "MA", lat: 42.3736, lng: -71.1097, timezone: "America/New_York" },
  { name: "Washington", state: "DC", lat: 38.9072, lng: -77.0369, timezone: "America/New_York" },
  { name: "Arlington", state: "VA", lat: 38.8816, lng: -77.0910, timezone: "America/New_York" },
  { name: "Philadelphia", state: "PA", lat: 39.9526, lng: -75.1652, timezone: "America/New_York" },
  { name: "Pittsburgh", state: "PA", lat: 40.4406, lng: -79.9959, timezone: "America/New_York" },
  { name: "Baltimore", state: "MD", lat: 39.2904, lng: -76.6122, timezone: "America/New_York" },
  { name: "Charlotte", state: "NC", lat: 35.2271, lng: -80.8431, timezone: "America/New_York" },
  { name: "Raleigh", state: "NC", lat: 35.7796, lng: -78.6382, timezone: "America/New_York" },
  { name: "Atlanta", state: "GA", lat: 33.7490, lng: -84.3880, timezone: "America/New_York" },
  { name: "Miami", state: "FL", lat: 25.7617, lng: -80.1918, timezone: "America/New_York" },
  { name: "Orlando", state: "FL", lat: 28.5383, lng: -81.3792, timezone: "America/New_York" },
  { name: "Tampa", state: "FL", lat: 27.9506, lng: -82.4572, timezone: "America/New_York" },
  { name: "Nashville", state: "TN", lat: 36.1627, lng: -86.7816, timezone: "America/Chicago" },
  { name: "Memphis", state: "TN", lat: 35.1495, lng: -90.0490, timezone: "America/Chicago" },
  { name: "New Orleans", state: "LA", lat: 29.9511, lng: -90.0715, timezone: "America/Chicago" },
  { name: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298, timezone: "America/Chicago" },
  { name: "Detroit", state: "MI", lat: 42.3314, lng: -83.0458, timezone: "America/Detroit" },
  { name: "Cleveland", state: "OH", lat: 41.4993, lng: -81.6944, timezone: "America/New_York" },
  { name: "Columbus", state: "OH", lat: 39.9612, lng: -82.9988, timezone: "America/New_York" },
  { name: "Cincinnati", state: "OH", lat: 39.1031, lng: -84.5120, timezone: "America/New_York" },
  { name: "Indianapolis", state: "IN", lat: 39.7684, lng: -86.1581, timezone: "America/Indiana/Indianapolis" },
  { name: "Milwaukee", state: "WI", lat: 43.0389, lng: -87.9065, timezone: "America/Chicago" },
  { name: "Minneapolis", state: "MN", lat: 44.9778, lng: -93.2650, timezone: "America/Chicago" },
  { name: "Saint Paul", state: "MN", lat: 44.9537, lng: -93.0900, timezone: "America/Chicago" },
  { name: "Saint Louis", state: "MO", lat: 38.6270, lng: -90.1994, timezone: "America/Chicago" },
  { name: "Kansas City", state: "MO", lat: 39.0997, lng: -94.5786, timezone: "America/Chicago" },
  { name: "Houston", state: "TX", lat: 29.7604, lng: -95.3698, timezone: "America/Chicago" },
  { name: "Dallas", state: "TX", lat: 32.7767, lng: -96.7970, timezone: "America/Chicago" },
  { name: "Austin", state: "TX", lat: 30.2672, lng: -97.7431, timezone: "America/Chicago" },
  { name: "San Antonio", state: "TX", lat: 29.4241, lng: -98.4936, timezone: "America/Chicago" },
  { name: "Fort Worth", state: "TX", lat: 32.7555, lng: -97.3308, timezone: "America/Chicago" },
  { name: "Oklahoma City", state: "OK", lat: 35.4676, lng: -97.5164, timezone: "America/Chicago" },
  { name: "Denver", state: "CO", lat: 39.7392, lng: -104.9903, timezone: "America/Denver" },
  { name: "Boulder", state: "CO", lat: 40.0150, lng: -105.2705, timezone: "America/Denver" },
  { name: "Salt Lake City", state: "UT", lat: 40.7608, lng: -111.8910, timezone: "America/Denver" },
  { name: "Phoenix", state: "AZ", lat: 33.4484, lng: -112.0740, timezone: "America/Phoenix" },
  { name: "Tucson", state: "AZ", lat: 32.2226, lng: -110.9747, timezone: "America/Phoenix" },
  { name: "Albuquerque", state: "NM", lat: 35.0844, lng: -106.6504, timezone: "America/Denver" },
  { name: "Las Vegas", state: "NV", lat: 36.1699, lng: -115.1398, timezone: "America/Los_Angeles" },
  { name: "Los Angeles", state: "CA", lat: 34.0522, lng: -118.2437, timezone: "America/Los_Angeles" },
  { name: "Long Beach", state: "CA", lat: 33.7701, lng: -118.1937, timezone: "America/Los_Angeles" },
  { name: "Santa Monica", state: "CA", lat: 34.0195, lng: -118.4912, timezone: "America/Los_Angeles" },
  { name: "Pasadena", state: "CA", lat: 34.1478, lng: -118.1445, timezone: "America/Los_Angeles" },
  { name: "San Diego", state: "CA", lat: 32.7157, lng: -117.1611, timezone: "America/Los_Angeles" },
  { name: "San Francisco", state: "CA", lat: 37.7749, lng: -122.4194, timezone: "America/Los_Angeles" },
  { name: "Oakland", state: "CA", lat: 37.8044, lng: -122.2712, timezone: "America/Los_Angeles" },
  { name: "Berkeley", state: "CA", lat: 37.8715, lng: -122.2730, timezone: "America/Los_Angeles" },
  { name: "Palo Alto", state: "CA", lat: 37.4419, lng: -122.1430, timezone: "America/Los_Angeles" },
  { name: "Mountain View", state: "CA", lat: 37.3861, lng: -122.0839, timezone: "America/Los_Angeles" },
  { name: "San Jose", state: "CA", lat: 37.3382, lng: -121.8863, timezone: "America/Los_Angeles" },
  { name: "Sacramento", state: "CA", lat: 38.5816, lng: -121.4944, timezone: "America/Los_Angeles" },
  { name: "Portland", state: "OR", lat: 45.5152, lng: -122.6784, timezone: "America/Los_Angeles" },
  { name: "Seattle", state: "WA", lat: 47.6062, lng: -122.3321, timezone: "America/Los_Angeles" },
  { name: "Bellevue", state: "WA", lat: 47.6101, lng: -122.2015, timezone: "America/Los_Angeles" },
  { name: "Anchorage", state: "AK", lat: 61.2181, lng: -149.9003, timezone: "America/Anchorage" },
  { name: "Honolulu", state: "HI", lat: 21.3099, lng: -157.8581, timezone: "Pacific/Honolulu" },
];

import { EXTENDED_CITIES } from "./citiesExtended";

// Combined dataset for search and findByName: featured CITIES first (top 60
// metros, surfaces in empty-query defaults), then ~180 extended entries
// covering state capitals + secondary metros + college towns.
const ALL_CITIES = [...CITIES, ...EXTENDED_CITIES];

export function searchCities(query: string, limit = 8): City[] {
  const q = query.trim().toLowerCase();
  if (!q) return CITIES.slice(0, limit);
  return ALL_CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      `${c.name.toLowerCase()}, ${c.state.toLowerCase()}` === q ||
      c.state.toLowerCase() === q,
  ).slice(0, limit);
}

export function findCityByName(name: string, state?: string): City | undefined {
  const lower = name.toLowerCase();
  return ALL_CITIES.find(
    (c) =>
      c.name.toLowerCase() === lower &&
      (!state || c.state.toLowerCase() === state.toLowerCase()),
  );
}
