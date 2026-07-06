import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
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
          <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
          <p className="text-sm text-white/40">Last updated: June 24, 2026</p>
        </div>

        <Section title="Overview">
          Dharma Automations (&quot;Dharma&quot;, &quot;we&quot;, &quot;us&quot;) provides an
          AI-powered Gmail extension and web dashboard that helps you draft email replies, manage
          labels, and handle scheduling. This policy explains what data we collect, how we use it,
          and your rights.
        </Section>

        <Section title="Data We Collect">
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong className="text-white/80">Gmail content</strong>: message subjects, bodies,
              and sender metadata, accessed solely to generate draft replies and detect scheduling
              requests on your behalf.
            </li>
            <li>
              <strong className="text-white/80">Google Calendar data</strong>: upcoming events and
              availability, used to suggest meeting times, and to create or update calendar events
              when you confirm scheduling actions.
            </li>
            <li>
              <strong className="text-white/80">Account identifiers</strong>: your Google account
              email address, used to authenticate you and associate your preferences.
            </li>
            <li>
              <strong className="text-white/80">Preferences</strong>: tone settings, scheduling
              preferences, and writing-style profiles you configure in the dashboard.
            </li>
          </ul>
        </Section>

        <Section title="How We Use Your Data">
          We use your data exclusively to provide the Dharma service:
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>Generating AI-assisted email drafts using your selected tone and writing style</li>
            <li>Detecting and responding to scheduling requests in your inbox</li>
            <li>Applying Gmail labels and filters you configure</li>
            <li>Storing your preferences so settings persist across sessions</li>
          </ul>
          We do not sell, rent, or share your personal data with third parties for advertising or
          marketing purposes.
        </Section>

        <Section title="Third-Party Services">
          Dharma uses the following third-party services to operate:
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>
              <strong className="text-white/80">Anthropic (Claude API)</strong>: email content is
              sent to Anthropic&apos;s API solely to generate draft replies on your behalf. This data
              is processed transiently and is <strong className="text-white/80">not used by
              Anthropic to train or improve their models</strong>, consistent with Anthropic&apos;s
              commercial API terms. We do not permit any third party to use your Google user data for
              advertising or to train generalized AI/ML models.
            </li>
            <li>
              <strong className="text-white/80">Google APIs</strong>: we access Gmail and Google
              Calendar through official Google APIs under your explicit OAuth authorization.
            </li>
            <li>
              <strong className="text-white/80">Vercel</strong>: our infrastructure provider for
              hosting and serverless functions.
            </li>
          </ul>
        </Section>

        <Section title="Data Retention">
          We do not persistently store the content of your emails. Email content is processed
          transiently to generate responses and is not written to our databases. Your preferences and
          account information are retained until you delete your account.
        </Section>

        <Section title="Google API Scopes">
          Dharma requests the following Google OAuth scopes:
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>
              <strong className="text-white/80">gmail.modify</strong> &mdash; read your Gmail
              messages and metadata, and apply labels or change message state (such as marking a
              message read) when you configure it
            </li>
            <li>
              <strong className="text-white/80">gmail.compose</strong> &mdash; create draft email
              replies on your behalf
            </li>
            <li>
              <strong className="text-white/80">calendar.readonly</strong> &mdash; read your Google
              Calendar events to suggest meeting times
            </li>
            <li>
              <strong className="text-white/80">calendar.events</strong> &mdash; create or update
              calendar events when you confirm a scheduling action
            </li>
          </ul>
          You can revoke access at any time via your{" "}
          <a
            href="https://myaccount.google.com/permissions"
            className="text-brand-200/80 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Account permissions page
          </a>
          .
        </Section>

        <Section title="Limited Use of Google User Data">
          Dharma&apos;s use and transfer of information received from Google APIs adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-brand-200/80 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements. Specifically:
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>
              We only use Google user data to provide and improve the user-facing features described
              in this policy.
            </li>
            <li>
              We do not transfer Google user data to third parties except as necessary to provide or
              improve these features, to comply with applicable law, or as part of a merger or
              acquisition with prior user notice.
            </li>
            <li>
              We do not use Google user data for serving advertising, including personalized or
              interest-based ads.
            </li>
            <li>
              We do not allow humans to read your Google user data unless you give specific consent,
              it is necessary for security or to comply with applicable law, or the data has been
              aggregated and anonymized.
            </li>
            <li>
              We do not use your Google user data to develop, train, or improve generalized or
              non-personalized AI or machine-learning models.
            </li>
          </ul>
        </Section>

        <Section title="Security">
          All data is transmitted over HTTPS. We use industry-standard security practices to protect
          your information. OAuth tokens are stored securely and never exposed client-side.
        </Section>

        <Section title="Your Rights">
          You may request deletion of your account and associated data at any time by contacting us.
          Upon request we will delete your stored preferences and account record within 30 days.
        </Section>

        <Section title="Contact">
          For privacy questions or data deletion requests, contact us at{" "}
          <a href="mailto:finley@qsbsrollover.com" className="text-brand-200/80 underline">
            finley@qsbsrollover.com
          </a>
          .
        </Section>

        <div className="pt-4 border-t border-white/10 flex gap-6 text-xs text-white/30">
          <Link href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
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
