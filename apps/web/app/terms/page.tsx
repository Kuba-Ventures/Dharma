import Link from "next/link";
import Image from "next/image";

export default function TermsPage() {
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
          <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
          <p className="text-sm text-white/40">Last updated: April 30, 2026</p>
        </div>

        <Section title="Acceptance">
          By installing the Dharma Chrome extension or using the Dharma dashboard, you agree to
          these Terms of Service. If you do not agree, do not use the service.
        </Section>

        <Section title="Description of Service">
          Dharma Automations provides an AI-powered email assistant that integrates with Gmail and
          Google Calendar to help you draft replies, manage labels, and handle scheduling requests.
          The service is provided by Kuba Ventures.
        </Section>

        <Section title="Google Workspace Requirements">
          Dharma requires authorization to access your Gmail and Google Calendar via Google OAuth.
          By granting access you authorize Dharma to read messages, create drafts, and read calendar
          events on your behalf. You can revoke this authorization at any time through your Google
          Account settings.
        </Section>

        <Section title="Acceptable Use">
          You agree not to:
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>Use Dharma to send spam, phishing, or other unsolicited messages</li>
            <li>Attempt to reverse-engineer, scrape, or exploit the service</li>
            <li>Use the service in violation of any applicable law or regulation</li>
            <li>Share your account credentials with others</li>
          </ul>
        </Section>

        <Section title="AI-Generated Content">
          Dharma uses AI to generate email drafts and scheduling suggestions. All AI-generated
          content is a suggestion only; you are solely responsible for reviewing and approving any
          content before it is sent. We do not guarantee the accuracy, completeness, or
          appropriateness of AI-generated output.
        </Section>

        <Section title="Data and Privacy">
          Your use of Dharma is also governed by our{" "}
          <a href="/privacy" className="text-brand-200/80 underline">
            Privacy Policy
          </a>
          , which is incorporated into these Terms by reference.
        </Section>

        <Section title="Availability">
          We aim to keep Dharma available and reliable but do not guarantee uninterrupted access.
          We may modify, suspend, or discontinue the service at any time with reasonable notice.
        </Section>

        <Section title="Disclaimer of Warranties">
          The service is provided &quot;as is&quot; without warranties of any kind, express or
          implied, including but not limited to fitness for a particular purpose or
          non-infringement. Use of AI-generated email drafts is at your own discretion and risk.
        </Section>

        <Section title="Limitation of Liability">
          To the maximum extent permitted by law, Kuba Ventures shall not be liable for any
          indirect, incidental, or consequential damages arising from your use of Dharma, including
          damages resulting from emails sent using AI-generated content.
        </Section>

        <Section title="Termination">
          We reserve the right to suspend or terminate your access if you violate these Terms. You
          may stop using the service at any time by uninstalling the extension and deleting your
          account.
        </Section>

        <Section title="Changes to Terms">
          We may update these Terms from time to time. Continued use of the service after changes
          are posted constitutes acceptance of the updated Terms.
        </Section>

        <Section title="Contact">
          Questions about these Terms? Contact us at{" "}
          <a href="mailto:finley@qsbsrollover.com" className="text-brand-200/80 underline">
            finley@qsbsrollover.com
          </a>
          .
        </Section>

        <div className="pt-4 border-t border-white/10 flex gap-6 text-xs text-white/30">
          <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
          <Link href="/support" className="hover:text-white/60 transition-colors">Support</Link>
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
