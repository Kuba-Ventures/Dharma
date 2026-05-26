"use client";

import { useState, useEffect, useRef } from "react";

// ── Industry presets ───────────────────────────────────────────────────────

type IndustryKey = "pe" | "vc" | "rfa";

interface PresetLabel {
  name: string;
  description: string;
  color: string;
  colorKey: string;
}

const INDUSTRY_PRESETS: Record<IndustryKey, { label: string; presets: PresetLabel[] }> = {
  pe: {
    label: "Private Equity",
    presets: [
      { name: "Keep Warm",                 description: "Relationship to maintain, not ready yet",         color: "#f5e6a0", colorKey: "yellow" },
      { name: "Interested: Info Received", description: "Target has shown interest and sent materials",    color: "#a0c8f5", colorKey: "blue"   },
      { name: "LOI Issued",                description: "Letter of Intent sent to target",                 color: "#c8a0f5", colorKey: "purple" },
      { name: "Client Intro",              description: "Introduction made to a client or LP",             color: "#a0f5c8", colorKey: "teal"   },
      { name: "Due Diligence",             description: "Active diligence process underway",               color: "#f5c8a0", colorKey: "orange" },
      { name: "Closing",                   description: "Deal nearing final close",                        color: "#a0f5c8", colorKey: "teal"   },
      { name: "Portfolio Company",         description: "Existing portfolio company communication",        color: "#a0c8f5", colorKey: "blue"   },
      { name: "LP Update",                 description: "Limited partner updates and reporting",           color: "#c0c0c0", colorKey: "gray"   },
    ],
  },
  vc: {
    label: "Venture Capital",
    presets: [
      { name: "Approached",                description: "Initial outreach made to founder or company",     color: "#a0c8f5", colorKey: "blue"   },
      { name: "Letter Sent",               description: "Formal interest letter or memo delivered",        color: "#c8a0f5", colorKey: "purple" },
      { name: "Target Profiles Secured",   description: "Company profile or deck received for review",    color: "#a0f5c8", colorKey: "teal"   },
      { name: "Term Sheet",                description: "Term sheet issued or under negotiation",          color: "#f5c8a0", colorKey: "orange" },
      { name: "Portfolio Update",          description: "Updates from existing portfolio companies",       color: "#a0c8f5", colorKey: "blue"   },
      { name: "Deal Flow",                 description: "Inbound deal flow and sourcing threads",          color: "#f5e6a0", colorKey: "yellow" },
      { name: "Pass",                      description: "Reviewed and decided not to pursue",              color: "#c0c0c0", colorKey: "gray"   },
      { name: "LP Communication",          description: "Investor relations and LP correspondence",        color: "#f5a0a0", colorKey: "red"    },
    ],
  },
  rfa: {
    label: "RFA",
    presets: [
      { name: "Client Inquiry",            description: "Direct question or request from a client",        color: "#a0c8f5", colorKey: "blue"   },
      { name: "Research Request",          description: "Request for analysis or research report",         color: "#c8a0f5", colorKey: "purple" },
      { name: "Compliance",               description: "Regulatory or compliance-related correspondence",  color: "#f5a0a0", colorKey: "red"    },
      { name: "Report Delivered",          description: "Research or analysis report sent to client",      color: "#a0f5c8", colorKey: "teal"   },
      { name: "Follow-up Required",        description: "Action item or follow-up pending",                color: "#f5e6a0", colorKey: "yellow" },
      { name: "Meeting Scheduled",         description: "Call or meeting confirmed with a client",         color: "#a0c8f5", colorKey: "blue"   },
      { name: "Prospect",                  description: "Potential new client or engagement",              color: "#c8a0f5", colorKey: "purple" },
    ],
  },
};

const COLOR_OPTIONS = [
  { key: "blue",   hex: "#a0c8f5" },
  { key: "purple", hex: "#c8a0f5" },
  { key: "teal",   hex: "#a0f5c8" },
  { key: "yellow", hex: "#f5e6a0" },
  { key: "orange", hex: "#f5c8a0" },
  { key: "red",    hex: "#f5a0a0" },
  { key: "gray",   hex: "#c0c0c0" },
];

// ── Types ──────────────────────────────────────────────────────────────────

interface LabelRule {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface LabelRecord {
  id: string;
  name: string;
  description: string;
  color: string;
  enabled: boolean;
  gmailLabelId: string | null;
  rules: LabelRule[];
}

// DisplayItem: a preset enriched with DB data if the label already exists
interface DisplayItem {
  dbId: string | null; // null = not yet in DB (preview only)
  name: string;
  description: string;
  color: string;
  rules: LabelRule[];
}

// ── Main component ─────────────────────────────────────────────────────────

export default function LabelsPanel() {
  const [industry, setIndustry] = useState<IndustryKey | "">("");
  const [labels, setLabels] = useState<LabelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ scanned: number; labeled: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [removedPresets, setRemovedPresets] = useState<Set<string>>(new Set());
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColorKey, setNewColorKey] = useState("purple");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dharma_industry") as IndustryKey | null;
    if (saved && saved in INDUSTRY_PRESETS) setIndustry(saved);
  }, []);

  useEffect(() => {
    fetch("/api/labels")
      .then((r) => r.json())
      .then((data: LabelRecord[]) => { setLabels(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleIndustryChange(key: IndustryKey | "") {
    setIndustry(key);
    setScanResult(null);
    setExpandedId(null);
    setRemovedPresets(new Set());
    if (key) localStorage.setItem("dharma_industry", key);
    else localStorage.removeItem("dharma_industry");
  }

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  // What to display: industry presets (minus removed) + any custom DB labels not in presets.
  // Switching industries or removing a preset updates instantly without touching the DB.
  const presetNames = industry
    ? new Set(INDUSTRY_PRESETS[industry].presets.map((p) => p.name.toLowerCase()))
    : new Set<string>();

  const displayItems: DisplayItem[] = industry
    ? [
        ...INDUSTRY_PRESETS[industry].presets
          .filter((p) => !removedPresets.has(p.name))
          .map((preset) => {
            const existing = labels.find((l) => l.name.toLowerCase() === preset.name.toLowerCase());
            return { dbId: existing?.id ?? null, name: preset.name, description: preset.description, color: preset.color, rules: existing?.rules ?? [] };
          }),
        // Custom labels the user added that aren't part of the industry preset
        ...labels
          .filter((l) => !presetNames.has(l.name.toLowerCase()))
          .map((l) => ({ dbId: l.id, name: l.name, description: l.description, color: l.color, rules: l.rules })),
      ]
    : labels.map((l) => ({ dbId: l.id, name: l.name, description: l.description, color: l.color, rules: l.rules }));

  async function applyAll() {
    if (!industry) return;
    setApplying(true);
    setExpandedId(null);

    // Delete all existing DB labels (removes from Gmail too via the API)
    await Promise.all(labels.map((l) => fetch(`/api/labels/${l.id}`, { method: "DELETE" })));
    setLabels([]);

    // Create exactly what's in the current display list
    const created: LabelRecord[] = [];
    for (const item of displayItems) {
      const preset = INDUSTRY_PRESETS[industry].presets.find((p) => p.name === item.name);
      const colorKey = preset?.colorKey ?? "gray";
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name, description: item.description, color: item.color, colorKey }),
      });
      if (res.ok) {
        const label: LabelRecord = await res.json();
        created.push({ ...label, rules: [] });
      }
    }
    setLabels(created);
    setRemovedPresets(new Set());

    await fetch("/api/labels/setup-gmail", { method: "POST" });
    setApplying(false);
  }

  function handleDeleteItem(item: DisplayItem) {
    if (item.dbId) {
      // Exists in DB — delete from server and Gmail
      setLabels((prev) => prev.filter((l) => l.id !== item.dbId));
      if (expandedId === item.name) setExpandedId(null);
      fetch(`/api/labels/${item.dbId}`, { method: "DELETE" });
    } else {
      // Preview only — just remove from the display list
      setRemovedPresets((prev) => new Set([...prev, item.name]));
      if (expandedId === item.name) setExpandedId(null);
    }
  }

  async function deleteLabel(id: string) {
    setLabels((prev) => prev.filter((l) => l.id !== id));
    if (expandedId === id) setExpandedId(null);
    await fetch(`/api/labels/${id}`, { method: "DELETE" });
  }

  async function addKeyword(labelId: string, keyword: string) {
    const res = await fetch(`/api/labels/${labelId}/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "body", operator: "contains", value: keyword }),
    });
    if (res.ok) {
      const rule: LabelRule = await res.json();
      setLabels((prev) => prev.map((l) => l.id === labelId ? { ...l, rules: [...l.rules, rule] } : l));
    }
  }

  async function deleteKeyword(labelId: string, ruleId: string) {
    await fetch(`/api/labels/${labelId}/rules/${ruleId}`, { method: "DELETE" });
    setLabels((prev) => prev.map((l) =>
      l.id === labelId ? { ...l, rules: l.rules.filter((r) => r.id !== ruleId) } : l
    ));
  }

  async function handleCreateLabel() {
    if (!newName.trim()) return;
    setCreating(true);
    const color = COLOR_OPTIONS.find((c) => c.key === newColorKey)?.hex ?? "#c8a0f5";
    const res = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color, colorKey: newColorKey, description: "" }),
    });
    if (res.ok) {
      const label: LabelRecord = await res.json();
      setLabels((prev) => [...prev, { ...label, rules: label.rules ?? [] }]);
      setNewName("");
      setNewColorKey("purple");
      setShowNewForm(false);
    }
    setCreating(false);
  }


  async function scanInbox() {
    setScanning(true);
    setScanResult(null);
    try {
      await fetch("/api/labels/seed-rules", { method: "POST" });
      await fetch("/api/labels/setup-gmail", { method: "POST" });
      const refreshed = await fetch("/api/labels").then((r) => r.json()) as LabelRecord[];
      setLabels(refreshed);
      const res = await fetch("/api/labels/scan-inbox", { method: "POST" });
      const data = await res.json() as { scanned: number; labeled: number };
      setScanResult(data);
    } catch {
      setScanResult(null);
    }
    setScanning(false);
  }

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 flex flex-col gap-3 h-full">

      {/* Row 1: industry dropdown + scan inbox */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-white/40 shrink-0">Industry</label>
        <select
          value={industry}
          onChange={(e) => handleIndustryChange(e.target.value as IndustryKey | "")}
          style={{ colorScheme: "dark" }}
          className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-white/25 cursor-pointer"
        >
          <option value="">Select industry…</option>
          {(Object.entries(INDUSTRY_PRESETS) as [IndustryKey, { label: string }][]).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <button
          onClick={scanInbox}
          disabled={scanning}
          className="text-xs bg-white/[0.07] hover:bg-white/[0.12] text-white/60 hover:text-white/80 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0"
        >
          {scanning ? (
            <>
              <span className="inline-block w-2.5 h-2.5 border border-white/30 border-t-white/70 rounded-full animate-spin" />
              Scanning…
            </>
          ) : "Scan inbox"}
        </button>
      </div>

      {scanResult && (
        <p className="text-xs text-brand-400 bg-brand-400/10 border border-brand-400/20 rounded-xl px-4 py-2 text-center">
          Scanned {scanResult.scanned} emails, labeled {scanResult.labeled}
        </p>
      )}

      {/* Label list */}
      <div className="flex-1">
        {loading ? (
          <p className="text-xs text-white/25 py-2">Loading…</p>
        ) : displayItems.length === 0 ? (
          <p className="text-xs text-white/25 py-2">Select an industry above to get started</p>
        ) : (
          <div className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.05]">
            {displayItems.map((item) => (
              <LabelRow
                key={item.name}
                item={item}
                expanded={expandedId === item.name}
                onExpand={() => toggleExpanded(item.name)}
                onDelete={() => handleDeleteItem(item)}
                onAddKeyword={item.dbId ? (kw) => addKeyword(item.dbId!, kw) : null}
                onDeleteKeyword={item.dbId ? (ruleId) => deleteKeyword(item.dbId!, ruleId) : null}
              />
            ))}
          </div>
        )}
      </div>

      {/* New label form / button */}
      {showNewForm ? (
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3.5 py-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 shrink-0">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setNewColorKey(c.key)}
                  className={`w-3.5 h-3.5 rounded-full transition-transform ${newColorKey === c.key ? "scale-125 ring-1 ring-white/40" : "opacity-60"}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <input
              autoFocus
              placeholder="Label name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-white/25"
            />
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={handleCreateLabel}
              disabled={creating || !newName.trim()}
              className="text-xs px-3 py-1.5 rounded-lg bg-white text-[#1a1a1a] font-medium hover:bg-white/90 transition-colors disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewName(""); }}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="text-xs text-white/25 hover:text-white/50 transition-colors text-left"
        >
          + Add label
        </button>
      )}

      {/* Apply labels — bottom of card */}
      <div className="border-t border-white/[0.06] pt-3">
        <button
          onClick={applyAll}
          disabled={applying || !industry}
          className="w-full py-2.5 text-xs font-medium rounded-xl bg-brand-400/15 border border-brand-400/30 text-brand-400 hover:bg-brand-400/22 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {applying
            ? "Applying labels…"
            : industry
              ? `Apply ${INDUSTRY_PRESETS[industry].label} labels to Gmail`
              : "Select an industry to apply labels"}
        </button>
      </div>

    </div>
  );
}

// ── Label row ──────────────────────────────────────────────────────────────

function LabelRow({
  item, expanded, onExpand, onDelete, onAddKeyword, onDeleteKeyword,
}: {
  item: DisplayItem;
  expanded: boolean;
  onExpand: () => void;
  onDelete: () => void;
  onAddKeyword: ((kw: string) => Promise<void>) | null;
  onDeleteKeyword: ((ruleId: string) => void) | null;
}) {
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPreview = !item.dbId;

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  useEffect(() => {
    if (!expanded) { setShowInput(false); setInput(""); }
  }, [expanded]);

  async function submit() {
    if (!input.trim() || !onAddKeyword) return;
    setAdding(true);
    await onAddKeyword(input.trim());
    setInput("");
    setAdding(false);
    setShowInput(false);
  }

  return (
    <div className="bg-white/[0.02]">
      {/* Row header */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
        <button className="flex-1 text-left min-w-0" onClick={onExpand}>
          <span className="text-xs font-medium text-white/75">#{item.name}</span>
        </button>
        {item.rules.length > 0 && !expanded && (
          <span className="text-[10px] text-white/20 shrink-0">{item.rules.length} kw</span>
        )}
        <button onClick={onExpand} className="text-white/20 hover:text-white/50 transition-colors shrink-0 px-0.5">
          <ChevronIcon expanded={expanded} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-white/15 hover:text-red-400/60 transition-colors text-sm leading-none shrink-0 pl-1"
        >
          ×
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-3.5 pb-3 space-y-2.5 border-t border-white/[0.04]">
          {item.description && (
            <p className="text-[10px] text-white/30 pt-2">{item.description}</p>
          )}
          <div>
            <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2">
              Keywords: matching emails get this label
            </p>
            {isPreview ? (
              <p className="text-[10px] text-white/20">
                Apply labels below to activate keyword sorting for this label
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 items-center">
                {item.rules.map((rule) => (
                  <span
                    key={rule.id}
                    className="inline-flex items-center gap-1 text-[11px] bg-white/[0.06] border border-white/[0.08] rounded-full pl-2.5 pr-1.5 py-0.5 text-white/60"
                  >
                    {rule.value}
                    <button
                      onClick={() => onDeleteKeyword?.(rule.id)}
                      className="text-white/25 hover:text-white/60 transition-colors leading-none ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {showInput ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submit();
                        if (e.key === "Escape") { setShowInput(false); setInput(""); }
                      }}
                      placeholder="keyword…"
                      className="text-[11px] bg-white/[0.06] border border-brand-400/30 rounded-full px-2.5 py-0.5 text-white/70 placeholder-white/25 focus:outline-none w-28"
                    />
                    <button onClick={submit} disabled={adding || !input.trim()} className="text-[11px] text-brand-400/70 hover:text-brand-400 transition-colors disabled:opacity-40">
                      {adding ? "…" : "Add"}
                    </button>
                    <button onClick={() => { setShowInput(false); setInput(""); }} className="text-[11px] text-white/25 hover:text-white/50 transition-colors">✕</button>
                  </span>
                ) : (
                  <button onClick={() => setShowInput(true)} className="text-[10px] text-white/25 hover:text-white/55 border border-dashed border-white/[0.1] hover:border-white/[0.2] rounded-full px-2.5 py-0.5 transition-colors">
                    + keyword
                  </button>
                )}
                {item.rules.length === 0 && !showInput && (
                  <p className="text-[10px] text-white/20 w-full mt-0.5">No keywords yet. Add some to auto-sort matching emails.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chevron ────────────────────────────────────────────────────────────────

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      className={`transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
    >
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
