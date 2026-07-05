import type { MetadataRoute } from "next";

// Public, indexable pages only, all on the canonical www host. App routes
// (dashboard, onboarding, settings, share/*) are auth-gated or noindex and are
// intentionally excluded. `metadataBase` in app/layout.tsx supplies the origin.
const PUBLIC_PATHS = ["/", "/privacy", "/terms", "/support"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.dharmaautomations.com";
  return PUBLIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
