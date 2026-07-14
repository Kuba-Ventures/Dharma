// Single source of truth for "should we persist a ClassifiedThread row?",
// shared by the Gmail webhook and poll classification paths.
//
// A ClassifiedThread row marks a thread as done — future *non-forced* scans
// (the back-scan dedupe) skip any thread that has one. So we may only record a
// row once the outcome is FINAL:
//
//   - a label actually landed in Gmail (appliedLabelCount > 0), or
//   - there was legitimately nothing to apply (intendedLabelCount === 0 — no
//     preset match and Uncategorized disabled, so the thread is meant to stay
//     unlabeled).
//
// We must NOT record when we intended a label but none landed
// (intendedLabelCount > 0 && appliedLabelCount === 0). That happens when the
// Gmail LabelMapping isn't ready yet (provisioning race, or a preset switch
// mid-flight). Recording anyway strands the thread "classified but unlabeled":
// the label never applies, and a non-forced back-scan skips it forever. Leaving
// it unrecorded lets the next poll/webhook reclassify and apply it once the
// mapping exists. (Root cause behind PR #42.)
export function shouldRecordClassifiedThread(args: {
  intendedLabelCount: number;
  appliedLabelCount: number;
}): boolean {
  const { intendedLabelCount, appliedLabelCount } = args;
  return appliedLabelCount > 0 || intendedLabelCount === 0;
}
