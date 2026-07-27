import { redirect } from "next/navigation";

// Profile lives on the combined "Profile & settings" page at /settings now.
// Kept as a redirect so older bookmarks still work.
export default function SettingsProfileRedirect() {
  redirect("/settings");
}
