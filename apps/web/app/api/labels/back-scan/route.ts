export const maxDuration = 60;

import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { makeAuthForUser, applyGmailLabels } from "../../../../lib/gmail";
import { google } from "googleapis";
import { classifyForPreset } from "../../../../lib/classify";
import {
  HIGH_PRIORITY_NAME,
  isBuiltInPresetKey,
  isPresetKey,
  resolvePresetSpec,
} from "../../../../lib/labelPresets";

const MAX_THREADS = 30;
const CONCURRENCY = 5;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [presetRow, cred] = await Promise.all([
    prisma.labelPreset.findUnique({ where: { userId } }),
    prisma.googleCredential.findUnique({ where: { userId } }),
  ]);

  if (!cred) {
    return NextResponse.json({ error: "Google not connected" }, { status: 400 });
  }
  if (!presetRow?.enabled || !isPresetKey(presetRow.preset)) {
    return NextResponse.json({ error: "No active preset" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Classifier unavailable" }, { status: 503 });
  }

  const maybeSpec = resolvePresetSpec({
    preset: presetRow.preset,
    customName: presetRow.customName,
    customLabels: presetRow.customLabels,
  });
  if (!maybeSpec || maybeSpec.labels.length === 0) {
    return NextResponse.json({ error: "Preset has no labels" }, { status: 400 });
  }
  const spec = maybeSpec;
  const preset = presetRow.preset;

  const labelNames = spec.labels
    .map((l) => l.shortName)
    .filter((n) => n !== "High-Priority");

  // Load LabelMappings into a map so we can resolve short names → Gmail ids.
  const mappings = await prisma.labelMapping.findMany({ where: { userId } });
  const mappingByName = new Map(mappings.map((m) => [m.labelName, m.gmailLabelId]));

  // Pull recent inbox threads — by thread we'd need history, so use messages.list
  // and dedupe by threadId since classification is thread-scoped.
  const { auth: oauthClient } = await makeAuthForUser(userId);
  const gmail = google.gmail({ version: "v1", auth: oauthClient });
  const listRes = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults: MAX_THREADS * 2,
  });
  const messages = listRes.data.messages ?? [];

  // Resolve unique threads, skipping any already classified.
  const seenThreads = new Set<string>();
  const candidates: Array<{ messageId: string; threadId: string }> = [];
  for (const m of messages) {
    if (!m.id || !m.threadId) continue;
    if (seenThreads.has(m.threadId)) continue;
    seenThreads.add(m.threadId);
    candidates.push({ messageId: m.id, threadId: m.threadId });
    if (candidates.length >= MAX_THREADS) break;
  }

  const existing = await prisma.classifiedThread.findMany({
    where: { userId, threadId: { in: candidates.map((c) => c.threadId) } },
    select: { threadId: true },
  });
  const alreadySet = new Set(existing.map((e) => e.threadId));
  const toClassify = candidates.filter((c) => !alreadySet.has(c.threadId));

  let scanned = 0;
  let tagged = 0;
  let skipped = alreadySet.size;
  const errors: string[] = [];

  async function processOne(c: { messageId: string; threadId: string }) {
    scanned++;
    try {
      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id: c.messageId,
        format: "full",
      });
      const msg = msgRes.data;
      const headers = msg.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const subject = getHeader("Subject");
      const from = getHeader("From");
      const snippet = msg.snippet ?? "";
      const body = extractBody(msg.payload) || snippet;

      const result = await classifyForPreset({
        displayName: spec.displayName,
        labelNames,
        subject,
        from,
        snippet,
        body,
        userId,
      });

      const matched = result.label ? spec.labels.find((l) => l.shortName === result.label) : null;
      const namesToApply: string[] = [];
      if (matched) namesToApply.push(matched.name);
      if (result.priority > 0.75 && isBuiltInPresetKey(preset)) {
        namesToApply.push(HIGH_PRIORITY_NAME);
      }

      if (namesToApply.length > 0) {
        const gmailIds = namesToApply
          .map((n) => mappingByName.get(n))
          .filter((id): id is string => Boolean(id));
        if (gmailIds.length > 0) {
          await applyGmailLabels(userId, c.messageId, gmailIds);
          tagged++;
        }
      }

      await prisma.classifiedThread.upsert({
        where: { userId_threadId: { userId, threadId: c.threadId } },
        create: { userId, threadId: c.threadId },
        update: {},
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      console.error(`[back-scan] thread ${c.threadId} failed:`, msg);
    }
  }

  // Process in small batches to stay well under Vercel's 60s function limit
  // without saturating Anthropic.
  for (let i = 0; i < toClassify.length; i += CONCURRENCY) {
    await Promise.all(toClassify.slice(i, i + CONCURRENCY).map(processOne));
  }

  return NextResponse.json({
    scanned,
    tagged,
    skipped,
    errors: errors.slice(0, 5),
    total: candidates.length,
  });
}

function extractBody(payload: unknown): string {
  const p = payload as { mimeType?: string; body?: { data?: string }; parts?: unknown[] } | undefined;
  if (!p) return "";
  if (p.mimeType === "text/plain" && p.body?.data) {
    return Buffer.from(p.body.data, "base64").toString("utf-8");
  }
  if (p.parts) {
    for (const part of p.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}
