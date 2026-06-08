(function () {
  "use strict";

  // ── Account guard ─────────────────────────────────────────────────────────
  // Only inject on the Gmail account connected to Dharma
  let dharmaEnabled = true;

  (async function checkAccount() {
    const { dharmaConnectedEmail } = await chrome.storage.local.get("dharmaConnectedEmail");
    if (!dharmaConnectedEmail) return;
    for (let i = 0; i < 30; i++) {
      const el = document.querySelector('[aria-label*="Google Account"]');
      if (el) {
        const match = (el.getAttribute("aria-label") || "").match(/\(([^)]+@[^)]+)\)/);
        if (match) {
          dharmaEnabled = match[1].toLowerCase() === dharmaConnectedEmail.toLowerCase();
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  })();

  // ── Thread ID from URL ────────────────────────────────────────────────────
  function getThreadId() {
    const hexMatch = document.body.innerHTML.match(/\b([0-9a-f]{16})\b/);
    if (hexMatch) return hexMatch[1];
    const parts = location.hash.replace("#", "").split("/");
    const id = parts[parts.length - 1];
    return id && id.length >= 10 ? id : null;
  }

  // ── Scheduling ────────────────────────────────────────────────────────────
  let scanTimer = null;
  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 400);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("hashchange", () => {
    document.querySelectorAll(".dharma-btn, .dharma-compose-btn").forEach((b) => b.remove());
    document.querySelectorAll("[data-dharma-injected]").forEach((el) => delete el.dataset.dharmaInjected);
    setTimeout(scan, 800);
  });

  [600, 1500, 3000, 5000].forEach((ms) => setTimeout(scan, ms));

  // ── Main scan ─────────────────────────────────────────────────────────────
  function scan() {
    injectBottomButton();
  }

  // ── 1. Bottom "Draft reply" button beside Reply / Forward ─────────────────
  function findReplyBar() {
    const fwd =
      document.querySelector('[data-tooltip="Forward"]') ||
      document.querySelector('[aria-label="Forward"]') ||
      document.querySelector('[data-tooltip*="Forward"]') ||
      document.querySelector('[aria-label*="Forward"]');
    if (fwd?.parentElement && !fwd.parentElement.querySelector(".dharma-btn"))
      return fwd.parentElement;

    for (const el of document.querySelectorAll("div, td, tr")) {
      if (el.querySelector(".dharma-btn")) continue;
      if (el.children.length < 2 || el.children.length > 12) continue;
      const texts = [...el.children].map((c) => (c.innerText || c.textContent || "").trim());
      if (texts.some((t) => t === "Reply" || t.endsWith("Reply")) &&
          texts.some((t) => t === "Forward" || t.endsWith("Forward")))
        return el;
    }
    return null;
  }

  function injectBottomButton() {
    if (!dharmaEnabled) return;
    const threadId = getThreadId();
    if (!threadId) return;
    const bar = findReplyBar();
    if (!bar || bar.querySelector(".dharma-btn")) return;
    bar.appendChild(makeBottomButton(threadId));
  }

  function makeBottomButton(threadId) {
    const btn = document.createElement("button");
    btn.className = "dharma-btn";
    btn.title = "Draft reply with Dharma";
    Object.assign(btn.style, {
      display: "inline-flex", alignItems: "center", gap: "6px",
      marginLeft: "8px", padding: "6px 14px", borderRadius: "20px",
      border: "1px solid #7c3aed", background: "#7c3aed", color: "white",
      cursor: "pointer", fontSize: "14px", fontFamily: "Google Sans, Roboto, sans-serif",
      fontWeight: "500", lineHeight: "20px", verticalAlign: "middle", flexShrink: "0",
    });
    const img = document.createElement("img");
    img.src = "data:image/png;base64,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";
    img.style.cssText = "width:17px;height:17px;object-fit:contain;flex-shrink:0;background:white;border-radius:3px;padding:1px;margin-right:-2px;";
    const label = document.createElement("span");
    label.textContent = "Draft reply";
    btn.appendChild(img);
    btn.appendChild(label);
    btn.addEventListener("mouseenter", () => { if (!btn.disabled) btn.style.background = "#6d28d9"; });
    btn.addEventListener("mouseleave", () => { if (!btn.disabled) btn.style.background = "#7c3aed"; });
    btn.addEventListener("click", () => handleBottomClick(btn, label, threadId));
    return btn;
  }

  async function handleBottomClick(btn, label, threadId) {
    const { dharmaToken } = await chrome.storage.local.get("dharmaToken");
    if (!dharmaToken) { showNoToken(btn, label); return; }

    btn.disabled = true;
    btn.style.cursor = "default";
    label.textContent = "Thinking…";
    btn.style.background = "#5b21b6";

    // Start generating immediately — Claude takes ~2s
    const responsePromise = chrome.runtime.sendMessage({
      type: "draft", threadId, token: dharmaToken,
    }).catch(() => null);

    // While Claude runs, prompt user to open the reply box themselves
    // (Gmail blocks synthetic clicks via isTrusted check)
    setTimeout(() => {
      if (btn.disabled) {
        label.textContent = "↓ Click Reply";
        btn.style.background = "#7c3aed";
        btn.style.cursor = "default";
      }
    }, 700);

    // Wait for both: API response AND the compose box to appear (user clicks Reply)
    const [response, box] = await Promise.all([
      responsePromise,
      waitForComposeBox(25000),
    ]);

    if (response?.ok && response.text && box) {
      injectTextIntoBox(box, response.text);
      label.textContent = "Done ✓";
      btn.style.background = "#059669";
      btn.disabled = false;
      btn.style.cursor = "pointer";
      setTimeout(() => { label.textContent = "Draft reply"; btn.style.background = "#7c3aed"; }, 2500);
    } else {
      label.textContent = "Failed. Try again.";
      btn.style.background = "#dc2626";
      btn.disabled = false;
      btn.style.cursor = "pointer";
      setTimeout(() => { label.textContent = "Draft reply"; btn.style.background = "#7c3aed"; }, 3000);
    }
  }

  // ── 2. Dharma icon button inside open compose toolbars ────────────────────
  const processedBoxes = new WeakSet();

  function injectComposeButtons() {
    const threadId = getThreadId();
    if (!threadId) return;

    // Find visible contenteditable compose boxes
    document.querySelectorAll('div[contenteditable="true"]').forEach((box) => {
      if (box.offsetParent === null) return;
      if (processedBoxes.has(box)) return;

      // Walk up to find a container that also has a Send button
      let el = box.parentElement;
      let depth = 0;
      while (el && depth < 12) {
        const sendBtn = [...el.querySelectorAll('[role="button"], button')]
          .find((b) => (b.innerText || b.textContent || "").trim() === "Send");
        if (sendBtn) {
          // The toolbar row is sendBtn's parent
          const toolbar = sendBtn.parentElement;
          if (toolbar && !toolbar.dataset.dharmaInjected) {
            toolbar.dataset.dharmaInjected = "1";
            processedBoxes.add(box);
            toolbar.appendChild(makeComposeButton(threadId, box));
          }
          break;
        }
        el = el.parentElement;
        depth++;
      }
    });
  }

  function makeComposeButton(threadId, composeBox) {
    const btn = document.createElement("button");
    btn.className = "dharma-compose-btn";
    btn.title = "Draft reply with Dharma";
    Object.assign(btn.style, {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: "28px", height: "28px", borderRadius: "50%",
      border: "none", background: "transparent",
      cursor: "pointer", flexShrink: "0", marginLeft: "2px",
      transition: "background 0.15s",
    });
    const img = document.createElement("img");
    img.src = "data:image/png;base64,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";
    img.style.cssText = "width:20px;height:20px;object-fit:contain;";
    btn.appendChild(img);
    btn.addEventListener("mouseenter", () => { btn.style.background = "rgba(124,58,237,0.12)"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "transparent"; });
    btn.addEventListener("click", () => handleComposeClick(btn, img, threadId, composeBox));
    return btn;
  }

  async function handleComposeClick(btn, img, threadId, composeBox) {
    const { dharmaToken } = await chrome.storage.local.get("dharmaToken");
    if (!dharmaToken) { alert("Paste your Dharma token via the extension popup first."); return; }

    const existingText = (composeBox.innerText || "").trim();
    const isPolish = existingText.length > 0;

    btn.disabled = true;
    img.style.opacity = "0.4";
    btn.style.animation = "none";
    btn.title = isPolish ? "Polishing…" : "Thinking…";

    // Spin the logo while waiting
    img.style.transition = "transform 1s linear";
    const spin = setInterval(() => { img.style.transform = `rotate(${Date.now() / 5 % 360}deg)`; }, 50);

    const response = await chrome.runtime.sendMessage({
      type: "draft", threadId, token: dharmaToken,
      draftText: isPolish ? existingText : null,
    }).catch(() => null);

    clearInterval(spin);
    img.style.transform = "";
    btn.disabled = false;
    img.style.opacity = "1";
    btn.title = "Draft reply with Dharma";

    if (response?.ok && response.text) {
      injectTextIntoBox(composeBox, response.text);
    } else {
      btn.title = "Failed. Try again.";
      img.style.filter = "hue-rotate(180deg)";
      setTimeout(() => { img.style.filter = ""; btn.title = "Draft reply with Dharma"; }, 3000);
    }
  }

  // ── Shared helpers ────────────────────────────────────────────────────────
  function injectTextIntoBox(box, text) {
    box.click();
    box.focus();
    // Select everything and replace with generated text
    document.execCommand("selectAll", false, undefined);
    document.execCommand("insertText", false, text);
    // Fire input event so Gmail registers the change
    box.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }

  function openReplyBoxIfNeeded() {
    if (findComposeBox()) return;
    // Find the bar by text content (bottom buttons have no data-tooltip/aria-label)
    // Look for a container whose direct children include both a "forward" and a "reply" label
    let replyEl = null;
    for (const el of document.querySelectorAll("div, td")) {
      if (el.children.length < 2 || el.children.length > 15) continue;
      const kids = [...el.children];
      const texts = kids.map((c) => (c.innerText || c.textContent || "").trim().toLowerCase());
      if (texts.some((t) => t.includes("forward")) && texts.some((t) => t.includes("reply"))) {
        replyEl = kids.find((c) => {
          const t = (c.innerText || c.textContent || "").trim().toLowerCase();
          return t.includes("reply") && !t.includes("all");
        });
        if (replyEl) break;
      }
    }
    if (replyEl) replyEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  function findComposeBox() {
    const selectors = [
      'div[aria-label="Message Body"]',
      'div[g_editable="true"]',
      'div.Am.Al.editable',
      'div[contenteditable="true"].editable',
      'div[role="textbox"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }
    // Broadest fallback: any visible contenteditable inside a compose-like wrapper
    const all = [...document.querySelectorAll('div[contenteditable="true"]')];
    return (
      all.find((el) => el.offsetParent !== null && el.closest("form") !== null) ||
      all.find((el) => el.offsetParent !== null && el.closest(".M9, .nH, .aHU") !== null) ||
      all.find((el) => el.offsetParent !== null) ||
      null
    );
  }

  async function waitForComposeBox(ms = 2500) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const box = findComposeBox();
      if (box) return box;
      await new Promise((r) => setTimeout(r, 120));
    }
    return null;
  }

  function showNoToken(btn, label) {
    label.textContent = "Connect Dharma first →";
    btn.style.background = "#92400e";
    setTimeout(() => { label.textContent = "Draft reply"; btn.style.background = "#7c3aed"; }, 3000);
  }
})();
