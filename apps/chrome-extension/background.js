chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "draft") return;

  console.log("[Dharma] drafting thread:", msg.threadId);

  fetch("https://www.dharmaautomations.com/api/emails/thread-draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${msg.token}`,
    },
    // Omit `tone` when the surface didn't pick one. Backend then reads the
    // user's saved tone preference so the inline button + compose FAB respect
    // whatever they set in the dashboard / sidebar ("My Tone", etc.).
    body: JSON.stringify({ threadId: msg.threadId, tone: msg.tone, draftText: msg.draftText ?? null }),
  })
    .then(async (r) => {
      const text = await r.text();
      console.log("[Dharma] API response:", r.status, text.slice(0, 300));
      try {
        sendResponse(JSON.parse(text));
      } catch {
        sendResponse({ error: `HTTP ${r.status}: ${text.slice(0, 200)}` });
      }
    })
    .catch((err) => {
      console.error("[Dharma] fetch error:", err.message);
      sendResponse({ error: err.message });
    });

  return true;
});
