import type { Metadata } from "next";
import "./globals.css";
import TokenButton from "@/components/TokenButton";
import AdminNavLink from "@/components/AdminNavLink";
import BotNavLink from "@/components/BotNavLink";

export const metadata: Metadata = {
  title: {
    default: "Sage",
    template: "%s | Sage",
  },
  description: "Telegram RAG assistant powered by LlamaIndex, Gemini, and pgvector.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <div className="logo">
              <span className="logo-icon">◈</span>
              <span className="logo-name">Sage</span>
              <div className="tech-badges">
                <span>LlamaIndex</span>
                <span>Gemini</span>
                <span>pgvector</span>
                <span>Telegram</span>
              </div>
            </div>
            <nav className="site-nav">
              <a href="/">Ask</a>
              <a href="/documents">Documents</a>
              <a href="/chunks">Chunks</a>
              <BotNavLink />
              <AdminNavLink />
              <TokenButton />
            </nav>
          </div>
        </header>
        <div className="site-main">
          {children}
        </div>
        <footer className="site-footer">
          <p>
            Built by <a href="https://github.com/serhatkeskin" target="_blank" rel="noopener noreferrer">Serhat Keskin</a>
            {" · "}
            <a href="https://github.com/serhatkeskin/tg-ai-rag-assistant-bot" target="_blank" rel="noopener noreferrer">GitHub</a>
            {" · "}
            LlamaIndex · Gemini · pgvector · Django · Next.js
          </p>
        </footer>
      </body>
    </html>
  );
}
