// Lightweight ops alerting. Posts a short message to OPS_ALERT_WEBHOOK_URL when
// that env var is set — the body is `{ "text": ... }`, which a Slack (or
// Discord, with ?wait, or any JSON) incoming webhook accepts directly. Always
// mirrors to console.error first, so the signal is never lost even when no
// webhook is configured. Best-effort: this never throws, so a failed alert
// can't break the caller (e.g. a cron run).
export async function sendOpsAlert(text: string): Promise<void> {
  console.error(`[ops-alert] ${text}`);

  const url = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("[ops-alert] webhook post failed:", (err as Error).message);
  }
}
