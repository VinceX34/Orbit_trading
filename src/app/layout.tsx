import type { Metadata } from "next";
import { IBM_Plex_Mono, Outfit } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Orbit",
  description: "Het bureau voor tien spotbanen op Kraken, bestuurd vanuit n8n.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
          <header className="flex items-end justify-between gap-6 border-b border-[var(--line)] pb-5">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ice">Kraken spot · tien banen</p>
              <div className="orbit-mark mt-2">
                <span className="orbit-ring" aria-hidden="true" />
                <Link href="/" className="font-display text-4xl tracking-tight">
                  Orbit
                </Link>
              </div>
            </div>
            <nav className="flex gap-5 font-mono text-xs uppercase tracking-[0.18em] text-paper-dim">
              <Link href="/" className="hover:text-paper">
                Bureau
              </Link>
              <Link href="/logboek" className="hover:text-paper">
                Logboek
              </Link>
            </nav>
          </header>
          <main className="flex-1 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
