import { ANTHROPIC_URL, anthropicHeaders } from "../anthropicEndpoint";

export type AiServiceName = "claude";

export const allAiServiceNames: AiServiceName[] = ["claude"];

export type AiServiceStatus = "working" | "down" | "unknown";

export type AiServiceFailureKind =
  | "out_of_credits"
  | "out_of_quota"
  | "key_rejected"
  | "key_not_allowed"
  | "rate_limited"
  | "provider_outage"
  | "unreachable"
  | "unexpected_response"
  | "not_configured"
  | "cannot_check";

export type AiServiceCheckResult = {
  service: AiServiceName;
  status: AiServiceStatus;
  failureKind: AiServiceFailureKind | null;
  failureDetail: string | null;
  latencyMilliseconds: number | null;
};

const checkTimeoutMilliseconds = 15_000;
export const claudeProbeModel = "claude-haiku-5-5";

type AnthropicErrorBody = { error?: { type?: string; message?: string } };

export function classifyAnthropicFailure(
  httpStatus: number,
  errorBody: AnthropicErrorBody | null,
): AiServiceFailureKind {
  const errorType = errorBody?.error?.type ?? "";
  const errorMessage = (errorBody?.error?.message ?? "").toLowerCase();
  if (errorMessage.includes("credit balance") || httpStatus === 402) return "out_of_credits";
  if (httpStatus === 401 || errorType === "authentication_error") return "key_rejected";
  if (httpStatus === 403 || errorType === "permission_error") return "key_not_allowed";
  if (httpStatus === 429 || errorType === "rate_limit_error") return "rate_limited";
  if (httpStatus >= 500 || errorType === "overloaded_error" || errorType === "api_error") return "provider_outage";
  return "unexpected_response";
}

function failureDetailFrom(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : "request failed";
}

async function parseJsonOrNull<BodyType>(response: Response): Promise<BodyType | null> {
  try {
    return (await response.json()) as BodyType;
  } catch {
    return null;
  }
}

export async function checkClaude(): Promise<AiServiceCheckResult> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return {
      service: "claude",
      status: "unknown",
      failureKind: "not_configured",
      failureDetail: "ANTHROPIC_API_KEY is not set",
      latencyMilliseconds: null,
    };
  }
  const checkStartedAt = Date.now();
  try {
    const anthropicResponse = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: anthropicHeaders(anthropicApiKey),
      body: JSON.stringify({
        model: claudeProbeModel,
        max_tokens: 1,
        messages: [{ role: "user", content: "ok" }],
      }),
      signal: AbortSignal.timeout(checkTimeoutMilliseconds),
    });
    const latencyMilliseconds = Date.now() - checkStartedAt;
    if (anthropicResponse.ok) {
      return { service: "claude", status: "working", failureKind: null, failureDetail: null, latencyMilliseconds };
    }
    const errorBody = await parseJsonOrNull<AnthropicErrorBody>(anthropicResponse);
    return {
      service: "claude",
      status: "down",
      failureKind: classifyAnthropicFailure(anthropicResponse.status, errorBody),
      failureDetail: `${anthropicResponse.status}: ${(errorBody?.error?.message ?? "no message").slice(0, 200)}`,
      latencyMilliseconds,
    };
  } catch (error) {
    return {
      service: "claude",
      status: "down",
      failureKind: "unreachable",
      failureDetail: failureDetailFrom(error),
      latencyMilliseconds: Date.now() - checkStartedAt,
    };
  }
}

export async function checkAllAiServices(): Promise<AiServiceCheckResult[]> {
  return Promise.all([checkClaude()]);
}
