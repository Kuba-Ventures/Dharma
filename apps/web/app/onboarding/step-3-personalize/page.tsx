import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import {
  presetEditorRows,
  isBuiltInPresetKey,
  type EditorRow,
} from "../../../lib/labelPresets";
import { roleToPresetKey } from "../../../lib/rolePresets";
import StepShell from "../components/StepShell";
import PersonalizeForm from "./PersonalizeForm";

// v2 onboarding step 3 (index 2): personalize. Shows the tone summary learned
// from sent mail (sync was kicked at the quiz) and the label list derived from
// the user's role, fully editable via the shared <LabelEditor>. Continuing
// provisions the labels in Gmail and runs the synchronous 25-thread back-scan
// with a progress state, so the inbox is already labeled when the user lands.
export default async function StepThreePersonalize() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, labelPreset] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        toneProfile: true,
        toneSummary: true,
        toneExample: true,
      },
    }),
    prisma.labelPreset.findUnique({ where: { userId: session.user.id } }),
  ]);

  // Seed the editor: a persisted Custom preset's own labels, otherwise the
  // built-in preset (from the stored preset if valid, else derived from role).
  let presetKey: string;
  let customName: string | null = null;
  let initialRows: EditorRow[];

  if (labelPreset?.preset === "Custom" && Array.isArray(labelPreset.customLabels)) {
    presetKey = "Custom";
    customName = labelPreset.customName ?? null;
    initialRows = (labelPreset.customLabels as unknown[])
      .map((l) => {
        const o = l as { shortName?: unknown; colorKey?: unknown };
        return {
          shortName: typeof o.shortName === "string" ? o.shortName : "",
          colorKey: typeof o.colorKey === "string" ? o.colorKey : "#4a86e8",
        };
      })
      .filter((r) => r.shortName);
  } else {
    const builtIn =
      labelPreset && isBuiltInPresetKey(labelPreset.preset)
        ? labelPreset.preset
        : roleToPresetKey(user?.role);
    presetKey = builtIn;
    initialRows = presetEditorRows(builtIn);
  }

  return (
    <StepShell
      step={2}
      total={4}
      eyebrow="Welcome to Dharma"
      title="Your voice and your labels"
      description="We learned your writing style from your sent mail and picked labels for your role. Tweak anything — then we'll sort your inbox."
    >
      <PersonalizeForm
        initialTone={{
          summary: user?.toneSummary ?? user?.toneProfile ?? null,
          example: user?.toneExample ?? null,
        }}
        presetKey={presetKey}
        customName={customName}
        initialRows={initialRows}
      />
    </StepShell>
  );
}
