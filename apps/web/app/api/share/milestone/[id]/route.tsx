import { ImageResponse } from "@vercel/og";
import { type NextRequest } from "next/server";
import {
  applyTemplate,
  getMilestone,
} from "../../../../../lib/milestones";

// 1200×630 PNG share card for a milestone. URL params encode the
// personalization (firstName, city, tier, seconds saved) so the route stays
// stateless and cacheable. Edge runtime keeps cold starts low and bundle size
// small. No Prisma imports — read state from URL only.
export const runtime = "edge";

function formatHours(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const firstName = url.searchParams.get("name") ?? "";
  const city = url.searchParams.get("city") ?? "";
  const tier = url.searchParams.get("tier") ?? "Apprentice";
  const seconds = parseInt(url.searchParams.get("s") ?? "0", 10) || 0;

  const milestone = getMilestone(id);
  const title = milestone
    ? applyTemplate(milestone.title, { firstName, city })
    : "Saving time with Dharma.";
  const description = milestone
    ? applyTemplate(milestone.description, { firstName, city })
    : "AI email that gives you your time back.";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #26215C 0%, #534AB7 55%, #1D9E75 100%)",
          padding: "64px 80px",
          fontFamily: "ui-sans-serif, system-ui",
          color: "#fff",
          position: "relative",
        }}
      >
        {/* Decorative top-right glow */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 400,
            height: 400,
            background: "radial-gradient(circle, rgba(174,169,236,0.45), transparent 70%)",
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: "#AFA9EC",
              borderRadius: 6,
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.01em",
            }}
          >
            Dharma
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "#AFA9EC",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 28,
            }}
          >
            Milestone unlocked
          </div>
          <div
            style={{
              fontSize: 68,
              fontWeight: 600,
              lineHeight: 1.05,
              maxWidth: 980,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 26,
              color: "rgba(255,255,255,0.78)",
              marginTop: 24,
              lineHeight: 1.35,
              maxWidth: 920,
            }}
          >
            {description}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(174,169,236,0.25)",
            paddingTop: 28,
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Dharma. AI email that gives you your time back.
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <div
              style={{
                fontSize: 18,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {formatHours(seconds)} saved
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#CECBF6",
                padding: "6px 14px",
                background: "rgba(174,169,236,0.18)",
                borderRadius: 999,
              }}
            >
              {tier}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
