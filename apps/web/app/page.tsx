"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { sendGTMEvent } from "@next/third-parties/google";

// ─── Icons ───────────────────────────────────────────────────────────────────

const CheckIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const ArrowRightIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);

const SparklesIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
    <path d="M20 2v4" /><path d="M22 4h-4" /><circle cx="4" cy="20" r="2" />
  </svg>
);

const MailIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
    <rect x="2" y="4" width="20" height="16" rx="2" />
  </svg>
);

const CheckCircleIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
  </svg>
);

const MessageSquareIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </svg>
);

const CalendarIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const PenIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
  </svg>
);

const TagIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
    <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
  </svg>
);

const FlagIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" x2="4" y1="22" y2="15" />
  </svg>
);

const ZapIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
  </svg>
);

const XIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);

const AvatarPlaceholder = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <rect width="40" height="40" fill="rgba(255,255,255,0.08)" />
    <circle cx="20" cy="16" r="7" fill="rgba(255,255,255,0.25)" />
    <ellipse cx="20" cy="36" rx="13" ry="10" fill="rgba(255,255,255,0.25)" />
  </svg>
);

// ─── Waitlist Form ────────────────────────────────────────────────────────────

function WaitlistForm({ className = "" }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          sourcePage: typeof window !== "undefined" ? window.location.pathname : "/",
        }),
      });
      if (res.ok) {
        // GA4 key event — pushed to the dataLayer only on a confirmed signup,
        // so the conversion count reflects real signups, not button clicks.
        sendGTMEvent({
          event: "waitlist_signup",
          source_page: typeof window !== "undefined" ? window.location.pathname : "/",
        });
      }
    } catch {
      // Best-effort. We still show success below; signup is captured in the
      // request log even if the sheet append fails.
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className={`flex items-center gap-3 text-primary font-medium ${className}`}>
        <CheckCircleIcon className="w-5 h-5 shrink-0" />
        <span>You&apos;re on the list! We&apos;ll be in touch.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="relative group w-full max-w-md">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-0 group-hover:opacity-20 group-focus-within:opacity-30 transition duration-500" />
        <div className="relative flex flex-col sm:flex-row items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-2xl focus-within:border-primary/50 transition-colors">
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="w-full bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none"
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2 bg-foreground text-background hover:bg-white px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-60"
          >
            <span>{submitting ? "Joining…" : "Join the Waitlist"}</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── How It Works Tabs ────────────────────────────────────────────────────────

type Step = {
  number: string;
  title: string;
  description?: string;
  Icon: React.FC<{ className?: string }>;
  mockup: React.ReactNode;
};

const STEPS: Step[] = [
  {
    number: "01",
    title: "Draft replies in your voice",
    description: "Dharma generates a personalized style from your sent messages, including your sign-offs, your phrasing, the way you actually write. Switch between My Tone, Concise, or Legal per reply. Edit anything before it goes out.",
    Icon: PenIcon,
    mockup: (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground shrink-0">
            <MailIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Sarah Jenkins</p>
            <p className="text-xs text-muted-foreground">Product Sync</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-none p-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            Hey! The new designs look great. Mind sharing your feedback by EOD Thursday?
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/20 text-primary border border-primary/30 shadow-[0_0_12px_rgba(99,102,241,0.3)]">My Tone</span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-muted-foreground border border-white/[0.06]">Concise</span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-muted-foreground border border-white/[0.06]">Legal</span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-muted-foreground border border-white/[0.06]">Scheduling</span>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-none p-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            Thanks, Sarah, I&apos;ll have feedback by EOD Thursday. Let me know if you&apos;d like to pre-read any of it.
          </p>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    title: "Scheduling, handled",
    description: "Dharma reads the thread, checks your calendar, and drafts a reply with two or three open times. You review, you send. No links, no forms.",
    Icon: CalendarIcon,
    mockup: (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
          Checking your calendar...
        </p>
        {["Tuesday, May 6 at 2:00 PM", "Wednesday, May 7 at 11:00 AM", "Friday, May 9 at 3:00 PM"].map((slot) => (
          <div key={slot} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <CheckCircleIcon className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm text-foreground">{slot}</span>
            <span className="ml-auto text-xs text-primary font-medium">Open</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    number: "03",
    title: "Auto-tag what matters",
    description: "VC outreach, PE diligence, client comms, legal, internal: Dharma labels incoming threads live, with presets built for finance workflows or custom labels you define.",
    Icon: TagIcon,
    mockup: (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
          Labeling threads...
        </p>
        {[
          { name: "Mara Chen", subject: "Re: Series A update", label: "VC", labelClass: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
          { name: "Marcus Lee", subject: "Diligence pack: Project Acorn", label: "PE", labelClass: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
          { name: "Olsen & Co.", subject: "MSA markup attached", label: "Legal", labelClass: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
        ].map((row) => (
          <div key={row.subject} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
              <p className="text-xs text-muted-foreground truncate">{row.subject}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${row.labelClass}`}>{row.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    number: "04",
    title: "Priority you can see",
    description: "High / Med / Low surfaces what actually needs a reply today. Track response rates by vertical so you know which threads are landing.",
    Icon: FlagIcon,
    mockup: (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
          Sorting by priority...
        </p>
        {[
          { name: "Term sheet: RoundCo", subject: "Reply needed today", priority: "High", dotClass: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" },
          { name: "Vendor Q3 review", subject: "Wants 30 min this week", priority: "Med", dotClass: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" },
          { name: "Newsletter digest", subject: "FYI only", priority: "Low", dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" },
        ].map((row) => (
          <div key={row.name} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <span className={`w-2 h-2 rounded-full shrink-0 ${row.dotClass}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
              <p className="text-xs text-muted-foreground truncate">{row.subject}</p>
            </div>
            <span className="text-xs text-muted-foreground font-medium shrink-0">{row.priority}</span>
          </div>
        ))}
      </div>
    ),
  },
];

function HowItWorksTabs() {
  const [active, setActive] = useState(0);

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start mt-12">
      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <button
            key={step.number}
            onClick={() => setActive(i)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all ${
              active === i
                ? "bg-white/10 border border-white/20"
                : "bg-white/[0.02] border border-white/[0.06] hover:bg-white/5"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              active === i ? "bg-primary text-white" : "bg-white/5 text-muted-foreground"
            }`}>
              <step.Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">{step.number}</span>
                <span className={`text-sm font-medium ${active === i ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.title}
                </span>
              </div>
              {active === i && step.description && (
                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
              )}
            </div>
            {active === i && <CheckIcon className="w-4 h-4 text-primary shrink-0" />}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-[2rem] blur-xl opacity-20 animate-pulse-slow" />
        <div className="relative glass-panel rounded-[2rem] p-6 sm:p-8 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          {STEPS[active].mockup}
        </div>
      </div>
    </div>
  );
}

// ─── Page Sections ────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Dharma Automations" width={32} height={32} className="object-contain" />
          <span className="font-display font-bold text-xl tracking-tight text-foreground">Dharma Automations</span>
        </div>
        <Link
          href="/login?callbackUrl=/dashboard"
          className="text-sm font-medium bg-white/10 hover:bg-white/20 text-foreground px-4 py-2 rounded-lg transition-colors border border-white/5"
        >
          Log In
        </Link>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="w-full h-full object-cover" src="/images/hero-mesh.png" />
      </div>

      <div className="container relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left */}
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 font-display text-gradient leading-[1.15] pb-2">
              Your inbox, on autopilot, without giving up the wheel.
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
              Dharma drafts replies in your voice, sorts what matters, and turns scheduling threads into ready-to-send responses. All inside Gmail. No new app. No setup marathon.
            </p>

            <div className="flex flex-col gap-4 mb-10">
              <WaitlistForm />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {["Free during beta", "Gmail-native", "You stay in control"].map((badge) => (
                  <span key={badge} className="flex items-center gap-1">
                    <CheckIcon className="w-4 h-4 text-primary" />
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right — chat mockup */}
          <div className="lg:pl-10">
            <div className="relative w-full max-w-md mx-auto z-10">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-[2rem] blur-xl opacity-30 animate-pulse-slow" />
              <div className="relative glass-panel rounded-[2rem] p-6 sm:p-8 overflow-hidden animate-float">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground shrink-0">
                    <MailIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Sarah Jenkins</h4>
                    <p className="text-xs text-muted-foreground">Product Sync</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-none p-4">
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      Hey! The new designs look great. Are you free sometime this week to chat through the implementation details?
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-muted-foreground border border-white/[0.06]">My Tone</span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-muted-foreground border border-white/[0.06]">Concise</span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-muted-foreground border border-white/[0.06]">Legal</span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/20 text-primary border border-primary/30 shadow-[0_0_12px_rgba(99,102,241,0.3)]">Scheduling</span>
                  </div>

                  <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-none p-4 relative mt-4">
                    <div className="absolute -top-3 -right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/40">
                      <ZapIcon className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      I&apos;m free Tuesday at 2pm or Wednesday at 11am. Let me know what works best for you.
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                      <span className="text-xs text-muted-foreground">Drafted by Dharma Automations</span>
                      <button className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                        Insert
                        <CheckIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const problems = [
    {
      title: "Generic AI replies",
      body: "People can spot an AI draft a mile away. Stiff openers, weird sign-offs, none of your voice.",
    },
    {
      title: "Setup that never ends",
      body: "Configure rules, train models, connect calendars. By the time it's ready, you've already replied.",
    },
    {
      title: "Tools that don't talk to each other",
      body: "A scheduler here, a CRM tag there, a drafting tool somewhere else. Your inbox becomes a tab graveyard.",
    },
  ];

  return (
    <section className="py-20 lg:py-32">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 mb-6">
            <span className="text-xs font-medium text-muted-foreground">The Problem</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display tracking-tight text-gradient mb-4">
            Email tools either do too little, or too much.
          </h2>
          <p className="text-lg text-muted-foreground">
            Booking links push the work onto your contacts. Autonomous AI agents send things you&apos;d never send. Neither feels like you.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {problems.map((p) => (
            <div key={p.title} className="glass-panel p-8 rounded-3xl">
              <XIcon className="w-8 h-8 text-muted-foreground/40 mb-6" />
              <h3 className="text-lg font-semibold font-display text-foreground mb-3">{p.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="py-20 lg:py-32 bg-white/[0.02]">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 mb-6">
              <span className="text-xs font-medium text-muted-foreground">How it works</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display tracking-tight text-gradient">
              Four features. One inbox. Zero new workflows.
            </h2>
          </div>
        </div>
        <HowItWorksTabs />
      </div>
    </section>
  );
}

function ComparisonSection() {
  const columns = [
    {
      title: "Booking Links & Schedulers",
      positive: false,
      points: [
        "Forces contacts onto a form",
        "Only solves scheduling",
        "Cold and transactional",
        "No help with the other 90% of your inbox",
      ],
    },
    {
      title: "Autonomous AI Assistants",
      positive: false,
      points: [
        "Sends emails on your behalf",
        "Steep setup, steep trust",
        "Generic voice, obvious AI tone",
        "You lose control of what goes out",
      ],
    },
    {
      title: "Dharma Automations",
      positive: true,
      badge: true,
      points: [
        "Drafts, tags, schedules: all in Gmail",
        "Writes in your voice, not a template",
        "You approve every reply before it sends",
        "Built for VC, PE, legal, and client workflows",
        "Free forever during beta",
      ],
    },
  ];

  return (
    <section className="py-20 lg:py-32">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 lg:mb-16 mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display tracking-tight text-gradient mb-4">
            Built for how people actually email.
          </h2>
          <p className="text-lg text-muted-foreground">
            We didn&apos;t reinvent email. We took the parts that already work and made them faster.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {columns.map((col) => (
            <div
              key={col.title}
              className={`rounded-3xl p-8 ${
                col.positive
                  ? "bg-primary/10 border border-primary/30"
                  : "glass-panel"
              }`}
            >
              <div className="flex items-center gap-2 mb-6">
                <h4 className={`text-lg font-semibold font-display ${col.positive ? "text-foreground" : "text-muted-foreground"}`}>
                  {col.title}
                </h4>
                {col.badge && (
                  <span className="flex items-center gap-1 text-xs bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-medium">
                    <SparklesIcon className="w-3 h-3" />
                    Recommended
                  </span>
                )}
              </div>
              <ul className="space-y-3">
                {col.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm">
                    {col.positive ? (
                      <CheckIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <XIcon className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                    )}
                    <span className={col.positive ? "text-foreground/90" : "text-muted-foreground"}>
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const quotes = [
    { text: "My AI replies all sound like a LinkedIn post. I end up rewriting them anyway.", role: "VC Associate" },
    { text: "I spend more time tagging deals in my inbox than closing them.", role: "PE Analyst" },
    { text: "I just want it to draft the reply, suggest the times, and let me hit send.", role: "Founder" },
  ];

  return (
    <section className="py-20 lg:py-32 bg-white/[0.02]">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 lg:mb-16 mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display tracking-tight text-gradient mb-4">
            Sound familiar?
          </h2>
          <p className="text-lg text-muted-foreground">
            We talked to hundreds of professionals across VC, PE, legal, and operations. The pattern was the same.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {quotes.map((q) => (
            <div key={q.role} className="glass-panel p-8 rounded-3xl flex flex-col">
              <MessageSquareIcon className="w-8 h-8 text-primary/40 mb-6 shrink-0" />
              <p className="text-lg font-medium leading-relaxed mb-8 flex-1">&ldquo;{q.text}&rdquo;</p>
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 overflow-hidden shrink-0">
                  <AvatarPlaceholder />
                </div>
                <span className="text-sm text-muted-foreground">{q.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 lg:py-32">
      <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display tracking-tight text-gradient mb-4">
          The email assistant that finally sounds like you.
        </h2>
        <p className="text-lg text-muted-foreground mb-8">
          Draft, schedule, tag, prioritize: all inside Gmail. Skip the links, skip the setup, skip the rewrite.
        </p>
        <WaitlistForm className="flex justify-center" />
        <p className="text-xs text-muted-foreground mt-4">
          Early access for Gmail users. Free forever during beta.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Dharma Automations" width={24} height={24} className="object-contain" />
          <span className="text-sm font-semibold text-foreground">Dharma Automations</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
          <a href="mailto:finley@qsbsrollover.com" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <ComparisonSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
