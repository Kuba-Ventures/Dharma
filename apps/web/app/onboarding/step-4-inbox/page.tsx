import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import StepShell from "../components/StepShell";
import InboxLanding from "./InboxLanding";

// Live Google Workspace Marketplace listing for the Dharma Gmail add-on.
const MARKETPLACE_URL =
  "https://workspace.google.com/marketplace/app/dharma/63757021962";

// v2 onboarding step 4 (index 3): the closing screen. The inbox was labeled
// during the personalize step, so the single primary action stamps completion
// and drops the user straight into their now-sorted Gmail. The add-on install
// is offered but never blocks entry.
export default async function StepFourInbox() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, cred] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true },
    }),
    prisma.googleCredential.findUnique({
      where: { userId: session.user.id },
      select: { email: true },
    }),
  ]);

  // Deep-link to the signed-in account's inbox (authuser handles multi-account
  // Gmail). Fresh navigation, so the newly applied labels render on load.
  const gmailUrl = cred?.email
    ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(cred.email)}#inbox`
    : "https://mail.google.com/mail/#inbox";

  const firstName = user?.firstName?.trim() || "";

  return (
    <StepShell
      step={3}
      total={4}
      eyebrow="Welcome to Dharma"
      title={firstName ? `You're all set, ${firstName}` : "You're all set"}
      description="Your inbox is sorted and waiting. Open it to see your labels in action."
    >
      <InboxLanding gmailUrl={gmailUrl} marketplaceUrl={MARKETPLACE_URL} />
    </StepShell>
  );
}
