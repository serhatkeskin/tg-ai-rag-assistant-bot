"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminKey } from "@/lib/auth";

export default function AdminNavLink() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!!getAdminKey());
  }, []);

  if (!show) return null;
  return <Link href="/secret-admin">Admin</Link>;
}
