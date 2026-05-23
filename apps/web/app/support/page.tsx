import Link from "next/link";
import Image from "next/image";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0e] px-6 py-16">
      <div className="max-w-2xl mx-auto space-y-10">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/" className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm">
            <Image src="/logo.png" alt="Dharma" width={20} height={20} className="object-contain" />
            Dharma Automations
          </Link>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Support</h1>
          <p className="text-sm text-white/40">We&apos;re here to help.</p>
        </div>

        <Section title="Getting Started">
          <ol className="list-decimal list-inside space-y-3">
            <li>
              <strong className="text-white/80">Create your account</strong> : visit{" "}
              <a href="https://dharma-lake.vercel.app" className="text-[#c8f5a0]/80 underline">
                dharma-lake.vercel.app
              </a>{" "}
              and sign in with your Google account.
            </li>
            <li>
              <strong className="text-white/80">Install Dharma in Gmail</strong> : open the{" "}
              <a
                href="https://workspace.google.com/marketplace/app/dharma/63757021962"
                className="text-[#c8f5a0]/80 underline"
              >
                Google Workspace Marketplace listing
              </a>{" "}
              and click Install. Approve the requested Google permissions when prompted.
            </li>
            <li>
              <strong className="text-white/80">Reload Gmail</strong> : refresh{" "}
              <a href="https://mail.google.com" className="text-[#c8f5a0]/80 underline">
                mail.google.com
              </a>{" "}
              so the add-on appears in the right sidebar.
            </li>
            <li>
              <strong className="text-white/80">Draft your first reply</strong> : open any email
              thread, click the Dharma icon in the Gmail right sidebar, then pick a tone (My Tone,
              Concise, Formal/Legal, or Scheduling).
            </li>
            <li>
              <strong className="text-white/80">Set your preferences</strong> : visit your{" "}
              <a href="https://dharma-lake.vercel.app" className="text-[#c8f5a0]/80 underline">
                dashboard
              </a>{" "}
              to choose tone, enable scheduling, and set up industry-preset labels.
            </li>
          </ol>
        </Section>

        <Section title="Frequently Asked Questions">
          <div className="space-y-6">
            <FAQ
              q="How does Dharma generate replies?"
              a="Dharma reads the email thread and uses Claude (by Anthropic) to draft a reply in your selected tone. The draft is placed in Gmail's compose box for you to review before sending. Nothing is sent automatically."
            />
            <FAQ
              q="How does the scheduling reply work?"
              a="When you pick the Scheduling tone, Dharma pulls free/busy data from your connected calendars (Google, Microsoft, or Apple) and drafts a reply that confirms or proposes real time slots. You connect calendars from your dashboard."
            />
            <FAQ
              q="Is my email data stored?"
              a="Email content is processed transiently to generate a draft and is never written to our databases. We never train AI models on your data. See our Privacy Policy for full details."
            />
            <FAQ
              q="Which Google permissions does Dharma need?"
              a="Dharma requests read access to Gmail and Google Calendar, and the ability to create drafts. It does not send emails autonomously. You can revoke access any time at myaccount.google.com under Security > Third-party apps with account access."
            />
            <FAQ
              q="Why isn't the Dharma icon appearing in my Gmail sidebar?"
              a="Reload Gmail (Cmd+R or Ctrl+R). If the icon still doesn't appear, go to the Workspace Marketplace listing and confirm the add-on shows as Installed. If you're on Workspace, ask your admin to confirm individual installs are allowed for this app."
            />
            <FAQ
              q="How do I change the tone of my drafts?"
              a="Open your dashboard, toggle Tone on, and select My Tone (learned from your sent mail) or one of the presets. Changes apply to all future drafts."
            />
            <FAQ
              q="Can I uninstall Dharma?"
              a="Yes. From the Workspace Marketplace listing click Uninstall, or go to myaccount.google.com > Security > Third-party apps and remove Dharma. Your account and data on our end can be deleted by emailing us."
            />
            <FAQ
              q="How do I delete my account?"
              a="Email us at finley@qsbsrollover.com and we'll delete your account and all associated data within 30 days."
            />
          </div>
        </Section>

        <Section title="Contact Us">
          For anything not covered above, reach out directly:
          <div className="mt-4 space-y-2">
            <p>
              <strong className="text-white/80">Email:</strong>{" "}
              <a href="mailto:finley@qsbsrollover.com" className="text-[#c8f5a0]/80 underline">
                finley@qsbsrollover.com
              </a>
            </p>
            <p className="text-white/40 text-xs">We typically respond within one business day.</p>
          </div>
        </Section>

        <div className="pt-4 border-t border-white/10 flex gap-6 text-xs text-white/30">
          <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="text-sm text-white/50 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="space-y-1">
      <p className="text-white/70 font-medium">{q}</p>
      <p>{a}</p>
    </div>
  );
}
