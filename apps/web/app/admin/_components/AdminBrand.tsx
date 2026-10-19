import adminStyles from "../admin.module.css";

export default function AdminBrand() {
  return (
    <div className={adminStyles.brand}>
      <img className={adminStyles.brandMark} src="/logo.png" alt="Dharma" width={30} height={30} />
      <div>
        <div className={adminStyles.brandEyebrow}>DHARMA</div>
        <div className={adminStyles.brandName}>Admin</div>
      </div>
    </div>
  );
}
