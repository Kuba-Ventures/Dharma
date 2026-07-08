import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { guessCityFromHeaders } from "../../../lib/geoGuess";
import StepShell from "../components/StepShell";
import QuizForm from "./QuizForm";

// v2 onboarding step 2 (index 1): the quiz. One page, one required question
// (role) — name is prefilled from OAuth, city is a best-guess from the request
// geo headers, both editable. Submitting persists name/role/city via
// /api/onboarding/advance (which derives the label preset from role) and kicks
// tone sampling so it's ready by the personalize step.
export default async function StepTwoQuiz() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, name: true, homeCity: true, role: true },
  });

  // Prefill the city: a previously-saved homeCity wins; otherwise a best-guess
  // from Vercel's geo headers (full-match-only — null when we can't resolve a
  // real city, so we never suggest a coordless one).
  let initialCity: { query: string; name: string; state: string } | null = null;
  if (user?.homeCity) {
    const [name, state] = user.homeCity.split(",").map((s) => s.trim());
    if (name) initialCity = { query: user.homeCity, name, state: state ?? "" };
  } else {
    const guessed = guessCityFromHeaders(await headers());
    if (guessed) {
      initialCity = {
        query: `${guessed.name}, ${guessed.state}`,
        name: guessed.name,
        state: guessed.state,
      };
    }
  }

  const initialName =
    user?.firstName?.trim() || user?.name?.trim().split(/\s+/)[0] || "";

  return (
    <StepShell
      step={1}
      total={4}
      eyebrow="Welcome to Dharma"
      title="Tell us who you are"
      description="This is all we need to sort your inbox and match your voice. Everything here is editable later in Settings."
    >
      <QuizForm
        initialName={initialName}
        initialRole={user?.role ?? null}
        initialCity={initialCity}
      />
    </StepShell>
  );
}
