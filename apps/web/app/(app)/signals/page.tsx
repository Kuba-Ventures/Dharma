import { redirect } from "next/navigation";

// Signals moved into the Configuration page as its own tab. Kept as a redirect
// so existing links and bookmarks still work.
export default function SignalsRedirect() {
  redirect("/configuration?section=signals");
}
