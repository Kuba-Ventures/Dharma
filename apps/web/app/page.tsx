"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

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

const SendIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
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
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
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
            className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2 bg-foreground text-background hover:bg-white px-6 py-3 rounded-xl font-semibold transition-all"
          >
            <span>Join the Waitlist</span>
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
    title: "An email arrives",
    Icon: MailIcon,
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
            Hey! The new designs look great. Are you free sometime this week to chat through the implementation details?
          </p>
        </div>
        <div className="flex justify-start pt-1">
          <button className="flex items-center gap-2 bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-xl text-sm font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            <SparklesIcon className="w-4 h-4" />
            <span>Suggest Times</span>
          </button>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    title: "Check availability",
    Icon: CalendarIcon,
    mockup: (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
          Checking your calendar...
        </p>
        {["Tuesday, May 6 — 2:00 PM", "Wednesday, May 7 — 11:00 AM", "Friday, May 9 — 3:00 PM"].map((slot) => (
          <div key={slot} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <CheckCircleIcon className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm text-foreground">{slot}</span>
            <span className="ml-auto text-xs text-primary font-medium">Available</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    number: "03",
    title: "Draft a reply",
    Icon: PenIcon,
    mockup: (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <SparklesIcon className="w-3.5 h-3.5 text-primary" />
          Drafting reply...
        </p>
        <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-none p-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            I&apos;m free Tuesday at 2pm or Wednesday at 11am — let me know what works best for you.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center shrink-0">
            <ZapIcon className="w-2.5 h-2.5 text-white" />
          </div>
          Drafted by Dharma Automations
        </div>
      </div>
    ),
  },
  {
    number: "04",
    title: "Review & Send",
    description: "One click to review. One click to send. Done in seconds.",
    Icon: SendIcon,
    mockup: (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center shrink-0">
            <ZapIcon className="w-3 h-3 text-white" />
          </div>
          Review &amp; Send
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-none p-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            I&apos;m free Tuesday at 2pm or Wednesday at 11am — let me know what works.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-primary font-medium">
          <CheckCircleIcon className="w-5 h-5 shrink-0" />
          Reply sent — scheduling done.
        </div>
      </div>
    ),
  },
];

function HowItWorksTabs() {
  const [active, setActive] = useState(3);

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
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 mb-8">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground">Private Beta</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 font-display text-gradient leading-[1.1]">
              The fastest way to reply to scheduling emails.
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
              Turn scheduling emails into ready-to-send replies with suggested times — no booking links, no setup headache, no new workflow.
            </p>

            <div className="flex flex-col gap-4 mb-10">
              <WaitlistForm />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {["Free", "Gmail-native", "No links"].map((badge) => (
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

                  <div className="flex justify-start pt-2">
                    <button className="flex items-center gap-2 bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-xl text-sm font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                      <SparklesIcon className="w-4 h-4" />
                      <span>Suggest Times</span>
                    </button>
                  </div>

                  <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-none p-4 relative mt-4">
                    <div className="absolute -top-3 -right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/40">
                      <ZapIcon className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      I&apos;m free Tuesday at 2pm or Wednesday at 11am — let me know what works best for you.
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
      title: "Too much back-and-forth",
      body: "You send times, they pick one, they reschedule, you repeat. It's an endless ping-pong game.",
    },
    {
      title: "Setup takes longer than the meeting",
      body: "Configure rules, connect calendars, send test links. All of that just to book a 15-minute call.",
    },
    {
      title: "Another tool. Another workflow.",
      body: "Most tools require you to change how you work. You shouldn't have to learn a new system to schedule.",
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
            Scheduling tools still make you do the work.
          </h2>
          <p className="text-lg text-muted-foreground">
            The tools designed to save us time have ironically created entirely new chores.
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
              A simpler way to schedule inside your inbox.
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
      title: "Booking Links",
      positive: false,
      points: [
        "Forces your contact to use a form",
        "Feels transactional and cold",
        "Requires both sides to leave email",
        "No context about your preferences",
      ],
    },
    {
      title: "Complex Assistants",
      positive: false,
      points: [
        "Too much to configure",
        "Too much trust to hand over",
        "Emails on your behalf autonomously",
        "Steep learning curve",
      ],
    },
    {
      title: "Dharma Automations",
      positive: true,
      badge: true,
      points: [
        "Inbox-native — no new tools",
        "Assistive, not autonomous",
        "You stay in control always",
        "Free forever during beta",
      ],
    },
  ];

  return (
    <section className="py-20 lg:py-32">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 lg:mb-16 mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display tracking-tight text-gradient mb-4">
            Built for how people actually schedule.
          </h2>
          <p className="text-lg text-muted-foreground">
            We didn&apos;t invent a new way to schedule. We just removed the friction from the way you already do it.
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
    { text: "It's still making me do all the work.", role: "Product Manager" },
    { text: "By the time I configure it, I could've booked the meetings manually.", role: "Startup Founder" },
    { text: "I just want it to suggest times and let me send. That's it.", role: "Sales Director" },
  ];

  return (
    <section className="py-20 lg:py-32 bg-white/[0.02]">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 lg:mb-16 mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display tracking-tight text-gradient mb-4">
            Sound familiar?
          </h2>
          <p className="text-lg text-muted-foreground">
            We talked to hundreds of professionals. The consensus was clear: existing tools are over-engineered.
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
          Be first to try the scheduling assistant that works inside your email.
        </h2>
        <p className="text-lg text-muted-foreground mb-8">
          Skip the links. Skip the setup. Start scheduling naturally.
        </p>
        <WaitlistForm className="flex justify-center" />
        <p className="text-xs text-muted-foreground mt-4">
          Early access reserved for Gmail users. Free forever during beta.
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
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <a href="mailto:finley@qsbsrollover.com" className="hover:text-foreground transition-colors">Contact</a>
          <a href="https://twitter.com" className="hover:text-foreground transition-colors">Twitter</a>
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
