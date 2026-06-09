"use client";

import { useState, useEffect } from "react";
import { getAdminKey } from "@/lib/auth";

// Shows an "Admin" nav link only when an admin key is stored (entered via the
// token modal). Client-only because it reads localStorage.
export default function AdminNavLink() {
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    setHasKey(!!getAdminKey());
    const sync = () => setHasKey(!!getAdminKey());
    window.addEventListener("storage", sync);
    window.addEventListener("admin-key-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("admin-key-changed", sync);
    };
  }, []);

  if (!hasKey) return null;
  return <a href="/secret-admin">Admin</a>;
}
