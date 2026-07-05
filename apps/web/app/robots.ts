import type { MetadataRoute } from "next";

// Allow crawling of public marketing/legal pages; keep crawlers out of the
// authenticated app and API surfaces. Points Google at the sitemap so it
// consolidates on the canonical www URLs.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/onboarding/", "/dashboard", "/settings", "/login"],
    },
    sitemap: "https://www.dharmaautomations.com/sitemap.xml",
    host: "https://www.dharmaautomations.com",
  };
}
