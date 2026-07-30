import { redirect } from "next/navigation";

// The standalone Metrics page was merged into the Dashboard (the two-tier
// metrics strip + the time-saved chart now live there) and dropped from the
// sidebar. Keep this route as a permanent redirect so old bookmarks and deep
// links land on the merged view instead of 404ing.
export default function MetricsPage() {
  redirect("/dashboard");
}
