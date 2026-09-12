"use client";

import { useState, useEffect } from "react";
import { getToken, getAdminKey } from "@/lib/auth";

export default function BotNavLink() {
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const check = () => setIsAuth(Boolean(getToken() || getAdminKey()));
    check();
    window.addEventListener("storage", check);
    window.addEventListener("admin-key-changed", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("admin-key-changed", check);
    };
  }, []);

  if (!isAuth) return null;

  return <a href="/bot">Telegram Bot</a>;
}
