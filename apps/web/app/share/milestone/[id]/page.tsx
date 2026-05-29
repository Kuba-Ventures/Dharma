import Link from "next/link";
import { type Metadata } from "next";
import { applyTemplate, getMilestone } from "../../../../lib/milestones";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    name?: string;
    city?: string;
    tier?: string;
    s?: string;
  }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const milestone = getMilestone(id);

  const title = milestone
    ? applyTemplate(milestone.title, {
        firstName: sp.name ?? null,
        city: sp.city ?? null,
      })
    : "Dharma milestone";
  const description = milestone
    ? applyTemplate(milestone.description, {
        firstName: sp.name ?? null,
        city: sp.city ?? null,
      })
    : "AI email that gives you your time back.";

  const ogParams = new URLSearchParams();
  if (sp.name) ogParams.set("name", sp.name);
  if (sp.city) ogParams.set("city", sp.city);
  if (sp.tier) ogParams.set("tier", sp.tier);
  if (sp.s) ogParams.set("s", sp.s);
  const ogPath = `/api/share/milestone/${id}?${ogParams.toString()}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogPath, width: 1200, height: 630, alt: title }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogPath],
    },
  };
}

export default async function SharePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const milestone = getMilestone(id);

  if (!milestone) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--bg-app)] px-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="font-display text-3xl text-white">Milestone not found</h1>
          <p className="text-white/60">This milestone link may be out of date.</p>
          <Link
            href="/"
            className="inline-block rounded-btn bg-brand-400 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Try Dharma
          </Link>
        </div>
      </main>
    );
  }

  const title = applyTemplate(milestone.title, {
    firstName: sp.name ?? null,
    city: sp.city ?? null,
  });
  const description = applyTemplate(milestone.description, {
    firstName: sp.name ?? null,
    city: sp.city ?? null,
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--bg-app)] px-6 py-12">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div
          className="rounded-hero border border-[color:var(--border-brand)] px-8 py-10"
          style={{ background: milestone.gradient }}
        >
          <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-brand-200">
            Milestone unlocked
          </p>
          <h1 className="font-display text-4xl leading-tight text-white">
            {title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/80">
            {description}
          </p>
          {sp.tier && (
            <p className="mt-6 text-[11px] uppercase tracking-[0.14em] text-brand-200">
              {sp.tier} tier
            </p>
          )}
        </div>
        <Link
          href="/"
          className="inline-block rounded-btn bg-brand-400 px-6 py-3 text-sm font-medium text-white hover:bg-brand-600"
        >
          Get your own time back with Dharma
        </Link>
      </div>
    </main>
  );
}
