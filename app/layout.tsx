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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
