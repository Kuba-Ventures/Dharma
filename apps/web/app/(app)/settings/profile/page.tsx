import { redirect } from "next/navigation";

// Profile moved to its own top-level /profile route. Bookmarks still work.
export default function SettingsProfileRedirect() {
  redirect("/profile");
}
