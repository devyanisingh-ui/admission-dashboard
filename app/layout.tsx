import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/context";
import { Shell } from "@/components/shell";

export const metadata: Metadata = {
  title: "Apeejay Admissions Dashboard",
  description: "Phase 1 — end-to-end admissions, strength and withdrawals from SaaS, CRM and FABS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions (e.g. Scribe, Grammarly) add attributes to <html>/<body> before React hydrates.
    // This only ignores those two tags' own attributes; mismatches anywhere inside are still reported.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
