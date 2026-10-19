import adminStyles from "../admin.module.css"

export default function AdminStatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={adminStyles.tile}>
      <div className={adminStyles.tileLabel}>{label}</div>
      <div className={adminStyles.tileValue} title={value}>
        {value}
      </div>
      {note ? <div className={adminStyles.tileNote}>{note}</div> : null}
    </div>
  );
}
