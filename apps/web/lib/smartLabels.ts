import { prisma } from "./prisma";

// Smart Labeling is a best-effort enrichment layer on top of rule/AI/preset
// labeling — it must never be able to abort core tagging. If any of its DB
// calls fail (e.g. the LearnedLabel table is missing because a schema change
// wasn't pushed to the database), we log and degrade to "no learned labels"
// rather than throwing, so the caller still applies the labels it computed.
function logSmartLabelFailure(op: string, err: unknown): void {
  console.warn(`[smartLabels] ${op} failed (degrading to no-op):`, err);
}

// Smart Labeling (issue #120): learn how the user labels mail and re-apply it.
//
// When the user manually applies a label to an email, we remember the
// sender→label association and auto-apply it to future mail from that sender.
// Associations are stored at two granularities (see the LearnedLabel model):
//   - "address": exact sender, applied immediately on the next matching mail.
//   - "domain":  whole domain, applied only after it crosses the promotion
//     threshold, so one stray label doesn't tag an entire domain.

// A domain-level association must be seen this many times before it starts
// auto-applying. Exact-address associations apply immediately (from 1).
export const DOMAIN_PROMOTION_THRESHOLD = 2;

export interface ParsedSender {
  address: string | null; // lowercased full address, e.g. "jim@yahoo.com"
  domain: string | null; // lowercased domain, e.g. "yahoo.com"
}

// Extract the address + domain from a raw From header. Handles
// "Display Name <addr@dom>", a bare "addr@dom", "mailto:" prefixes, and a
// "Name addr@dom" form with no angle brackets. Returns nulls when no usable
// address is present (learning/resolution then no-ops).
export function parseSender(from: string): ParsedSender {
  const empty: ParsedSender = { address: null, domain: null };
  if (!from) return empty;

  let raw: string;
  const angle = from.match(/<([^>]+)>/);
  if (angle) {
    raw = angle[1];
  } else {
    // No brackets: pick the whitespace-delimited token that looks like an address.
    raw = from.split(/\s+/).find((t) => t.includes("@")) ?? from;
  }

  raw = raw.trim().toLowerCase().replace(/^mailto:/, "");
  if (/\s/.test(raw)) return empty; // still has whitespace → not a clean address

  const at = raw.lastIndexOf("@");
  if (at <= 0 || at === raw.length - 1) return empty; // no local part or no domain
  const domain = raw.slice(at + 1);
  if (!domain.includes(".")) return empty; // reject bare/malformed domains

  return { address: raw, domain };
}

const domainKey = (domain: string) => `@${domain}`;

// Record that the user applied `labelName` to mail from `from`. Upserts the
// exact-address association and bumps the domain-level counter. Idempotent per
// call in the sense that repeats just increment sampleCount. Safe to call with
// a messy From header — no-ops when no address can be parsed.
export async function learnLabel(params: {
  userId: string;
  from: string;
  labelName: string;
  gmailLabelId?: string | null;
}): Promise<void> {
  const { userId, from, labelName, gmailLabelId } = params;
  const { address, domain } = parseSender(from);
  if (!address) return;

  const keys: Array<{ senderKey: string; matchType: "address" | "domain" }> = [
    { senderKey: address, matchType: "address" },
  ];
  if (domain) keys.push({ senderKey: domainKey(domain), matchType: "domain" });

  try {
    for (const { senderKey, matchType } of keys) {
      await prisma.learnedLabel.upsert({
        where: { userId_senderKey_labelName: { userId, senderKey, labelName } },
        create: {
          userId,
          senderKey,
          matchType,
          labelName,
          gmailLabelId: gmailLabelId ?? null,
          sampleCount: 1,
        },
        update: {
          sampleCount: { increment: 1 },
          // Refresh the stored Gmail label id if we now have one.
          ...(gmailLabelId ? { gmailLabelId } : {}),
        },
      });
    }
  } catch (err) {
    logSmartLabelFailure("learnLabel", err);
  }
}

export interface ResolvedLabel {
  labelName: string;
  gmailLabelId: string | null;
}

// Labels to auto-apply to a new message from `from`: every exact-address
// association plus any domain association that has crossed the promotion
// threshold. Deduped by labelName (address wins its gmailLabelId).
export async function resolveLearnedLabels(
  userId: string,
  from: string
): Promise<ResolvedLabel[]> {
  const { address, domain } = parseSender(from);
  if (!address) return [];

  const senderKeys = [address];
  if (domain) senderKeys.push(domainKey(domain));

  try {
    const rows = await prisma.learnedLabel.findMany({
      where: { userId, senderKey: { in: senderKeys } },
    });

    // Address matches first so they win the gmailLabelId on dedup.
    rows.sort((a, b) => (a.matchType === "address" ? -1 : 1) - (b.matchType === "address" ? -1 : 1));

    const byName = new Map<string, ResolvedLabel>();
    for (const r of rows) {
      if (r.matchType === "domain" && r.sampleCount < DOMAIN_PROMOTION_THRESHOLD) continue;
      if (!byName.has(r.labelName)) {
        byName.set(r.labelName, { labelName: r.labelName, gmailLabelId: r.gmailLabelId });
      }
    }
    return [...byName.values()];
  } catch (err) {
    // Degrade to no learned labels so rule/AI/preset labeling still applies.
    logSmartLabelFailure("resolveLearnedLabels", err);
    return [];
  }
}

// The user removed `labelName` from mail from `from`: forget the association so
// we stop auto-applying it. Removes the address row outright and decrements the
// domain row (deleting it once it drops to zero). This is the corrective path
// for both a change of mind and a wrong auto-label.
export async function unlearnLabel(params: {
  userId: string;
  from: string;
  labelName: string;
}): Promise<void> {
  const { userId, from, labelName } = params;
  const { address, domain } = parseSender(from);
  if (!address) return;

  try {
    await prisma.learnedLabel.deleteMany({
      where: { userId, senderKey: address, labelName },
    });

    if (domain) {
      const key = domainKey(domain);
      const row = await prisma.learnedLabel.findUnique({
        where: { userId_senderKey_labelName: { userId, senderKey: key, labelName } },
      });
      if (row) {
        if (row.sampleCount <= 1) {
          await prisma.learnedLabel.delete({ where: { id: row.id } });
        } else {
          await prisma.learnedLabel.update({
            where: { id: row.id },
            data: { sampleCount: { decrement: 1 } },
          });
        }
      }
    }
  } catch (err) {
    logSmartLabelFailure("unlearnLabel", err);
  }
}

// Gmail assigns user-created labels ids like "Label_123"; system labels are
// uppercase words (INBOX, IMPORTANT, STARRED, CATEGORY_*, …). We only ever
// learn user-created labels, so starring/archiving/importance never trains the
// model. Dharma's own labels (created via the API) are user labels too, so they
// qualify.
export function isUserLabelId(labelId: string): boolean {
  return labelId.startsWith("Label_");
}
