// Centralized Anthropic endpoint resolver. When AI_GATEWAY_API_KEY is set we
// route through Vercel's AI Gateway (observability, model failover, cost
// caps); otherwise fall back to api.anthropic.com directly. Keeps every
// fetch call site uniform — they just import ANTHROPIC_URL.
//
// Per CLAUDE.md guidance: "Use AI Gateway for model routing, set
// AI_GATEWAY_API_KEY, using a model string."

const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/messages";
const DIRECT_URL = "https://api.anthropic.com/v1/messages";

export const ANTHROPIC_URL =
  process.env.AI_GATEWAY_API_KEY ? GATEWAY_URL : DIRECT_URL;

export function anthropicHeaders(apiKey: string): Record<string, string> {
  const gateway = !!process.env.AI_GATEWAY_API_KEY;
  return {
    "x-api-key": gateway ? process.env.AI_GATEWAY_API_KEY! : apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
    ...(gateway ? { "x-vercel-ai-gateway-provider": "anthropic" } : {}),
  };
}
