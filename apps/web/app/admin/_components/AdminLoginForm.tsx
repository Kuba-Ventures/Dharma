"use client";

import { useState } from "react";
import adminStyles from "../admin.module.css";

export default function AdminLoginForm({ nextPath }: { nextPath: string }) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  return (
    <form action="/api/admin/login" method="post" onSubmit={() => setIsSigningIn(true)} className={adminStyles.loginCard}>
      <input type="hidden" name="next" value={nextPath} />
      <label className={adminStyles.loginLabel}>
        Email
        <input className={adminStyles.loginInput} type="email" name="email" autoComplete="email" required />
      </label>
      <label className={adminStyles.loginLabel}>
        Admin password
        <input className={adminStyles.loginInput} type="password" name="password" autoComplete="current-password" required />
      </label>
      <button className={adminStyles.loginButton} type="submit" disabled={isSigningIn}>
        {isSigningIn ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
