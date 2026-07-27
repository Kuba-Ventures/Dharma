import { redirect } from "next/navigation";

// Profile was merged into the combined "Profile & settings" page at /settings.
// Kept as a redirect so existing links and bookmarks still work.
export default function ProfileRedirect() {
  redirect("/settings");
}
