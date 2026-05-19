import MetricsCard from "../../components/MetricsCard";

export default function MetricsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Metrics</h1>
        <p className="text-sm text-white/35 mt-0.5">Activity and automation performance</p>
      </div>
      <MetricsCard />
    </div>
  );
}
