import adminStyles from "../admin.module.css";

export default function AdminConsoleLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className={adminStyles.skeletonBlock} style={{ height: 44, width: 220, marginBottom: 22 }} />
      <div className={adminStyles.tileGrid}>
        {[0, 1, 2, 3].map((tileIndex) => (
          <div key={tileIndex} className={adminStyles.skeletonBlock} style={{ height: 104 }} />
        ))}
      </div>
      <div className={adminStyles.panelRow}>
        <div className={adminStyles.skeletonBlock} style={{ height: 320 }} />
        <div className={adminStyles.skeletonBlock} style={{ height: 320 }} />
      </div>
      <div className={adminStyles.skeletonBlock} style={{ height: 220 }} />
    </div>
  );
}
