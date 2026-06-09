import type { Metadata } from "next";
import "./globals.css";
import AdminNavLink from "@/components/AdminNavLink";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aven AI Assistant",
  description: "RAG-powered document assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/" className="brand">Aven AI</Link>
          <Link href="/documents">Documents</Link>
          <Link href="/chunks">Chunks</Link>
          <AdminNavLink />
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
