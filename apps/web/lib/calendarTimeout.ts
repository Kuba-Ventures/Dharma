// Hard timeout wrapper for Google Calendar API calls.
//
// googleapis/gaxios defaults to an effectively-infinite retry budget
// (totalTimeout / maxRetryDelay = MAX_SAFE_INTEGER), so a Google-side stall can
// back off forever. In a request handler that means the whole request hangs
// until the browser gives up ("loaded and timed out") with no server-side
// trace. This wrapper caps each call: it passes an AbortSignal so the
// underlying request is cancelled, and also races a timer so we give up
// promptly even if the abort isn't honored mid-backoff.

export const CALENDAR_CALL_TIMEOUT_MS = 8000;

export async function withCalendarTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  label: string,
  ms: number = CALENDAR_CALL_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
