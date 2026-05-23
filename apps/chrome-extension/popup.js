const tokenInput = document.getElementById("token");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

// Load existing token on open
chrome.storage.local.get("dharmaToken", ({ dharmaToken }) => {
  if (dharmaToken) tokenInput.value = dharmaToken;
});

saveBtn.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus("Paste your token first.", "err");
    return;
  }

  saveBtn.disabled = true;
  setStatus("Saving…", "");

  await chrome.storage.local.set({ dharmaToken: token });

  // Fetch connected email so the button only appears on the right account
  try {
    const res = await fetch("https://dharma-lake.vercel.app/api/user/me", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.email) await chrome.storage.local.set({ dharmaConnectedEmail: data.email });
    }
  } catch (_) {}

  setStatus("Token saved! Try clicking Draft reply in Gmail.", "ok");
  saveBtn.disabled = false;
});

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = "status " + type;
}
