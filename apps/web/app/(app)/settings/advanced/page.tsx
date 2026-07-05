import ExtensionTokenCard from "../../../components/settings/ExtensionTokenCard";
import DeleteAccountCard from "../../../components/settings/DeleteAccountCard";
import SettingsBackLink from "../../../components/settings/SettingsBackLink";

export default function AdvancedSettingsPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <SettingsBackLink />
      <header className="mb-2">
        <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Advanced
        </p>
        <h1 className="font-display text-3xl text-white">Power-user options</h1>
        <p className="mt-2 text-sm text-white/60">
          The Chrome extension token and other power-user settings live here.
        </p>
      </header>

      <ExtensionTokenCard />
      <DeleteAccountCard />
    </div>
  );
}
