import type { NextConfig } from "next";

// Security response headers applied to every route. Closes the common
// CASA / OWASP ASVS findings a DAST scan flags. HSTS is already set by Vercel.
// CSP is shipped in REPORT-ONLY first: the app loads GTM/GA4 + Vercel analytics
// with inline scripts, so an enforcing policy could break the site. Report-only
// surfaces violations (browser console) without blocking, so we can tighten it
// to an enforcing `Content-Security-Policy` once the reports are clean.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // App uses none of these; deny by default (no browser geolocation in-app).
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      // Next.js + GTM/GA4 + Vercel analytics need inline/eval.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://*.google-analytics.com https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://vitals.vercel-insights.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      // Sign-in redirects to Google; allow it as a form target defensively.
      "form-action 'self' https://accounts.google.com",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    // Serve static images directly without going through the optimization
    // pipeline — avoids intermittent failures on mobile / cold starts.
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
