import { formatCount } from "@/lib/admin/adminFormatting";
import adminStyles from "../admin.module.css";

export type AdminFunnelStep = { label: string; count: number | null };

export default function AdminFunnel({ steps }: { steps: AdminFunnelStep[] }) {
  const largestCount = Math.max(1, ...steps.map((step) => step.count ?? 0));
  return (
    <div>
      {steps.map((step, stepIndex) => {
        const previousCount = stepIndex > 0 ? steps[stepIndex - 1].count : null;
        const shareOfPreviousStep =
          step.count != null && previousCount ? Math.round((step.count / previousCount) * 100) : null;
        return (
          <div key={step.label} className={adminStyles.funnelStep}>
            <div>{step.label}</div>
            <div className={adminStyles.funnelBarTrack}>
              <div className={adminStyles.funnelBar} style={{ width: `${((step.count ?? 0) / largestCount) * 100}%` }} />
            </div>
            <div className={adminStyles.funnelValue}>{formatCount(step.count)}</div>
            {stepIndex > 0 && shareOfPreviousStep != null && shareOfPreviousStep <= 100 ? (
              <div className={adminStyles.funnelShare}>{shareOfPreviousStep}% of previous step</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
