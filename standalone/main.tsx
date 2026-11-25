/**
 * Entry point of the single-file build (npm run build:html).
 * Mirrors app/layout.tsx — AppProvider + Shell around the current page — and picks the page
 * from the hash route instead of Next.js's file-based router. Every page is the real app page.
 */
import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import { AppProvider } from "@/lib/context";
import { Shell } from "@/components/shell";
import { usePathname } from "./next-navigation";
import Link from "./next-link";

import DashboardPage from "@/app/page";
import AdminPage from "@/app/admin/page";
import AlertsPage from "@/app/alerts/page";
import BudgetPage from "@/app/budget/page";
import DrilldownPage from "@/app/drilldown/page";
import GradesPage from "@/app/grades/page";
import MastersPage from "@/app/masters/page";
import PlanningPage from "@/app/planning/page";
import ReportsPage from "@/app/reports/page";
import SocialPage from "@/app/social/page";
import StrengthPage from "@/app/strength/page";
import SystemsPage from "@/app/systems/page";

/** Keep in step with the folders under app/ (check-routes in vite.config.ts fails the build if one is missing). */
export const ROUTES: Record<string, ComponentType> = {
  "/": DashboardPage,
  "/admin": AdminPage,
  "/alerts": AlertsPage,
  "/budget": BudgetPage,
  "/drilldown": DrilldownPage,
  "/grades": GradesPage,
  "/masters": MastersPage,
  "/planning": PlanningPage,
  "/reports": ReportsPage,
  "/social": SocialPage,
  "/strength": StrengthPage,
  "/systems": SystemsPage,
};

function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
      <h2 className="font-semibold text-slate-800">Page not found</h2>
      <p className="mt-1 text-sm text-slate-500">This link points to a page the dashboard doesn&apos;t have.</p>
      <Link href="/" className="mt-4 inline-flex rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Go to the Dashboard</Link>
    </div>
  );
}

function App() {
  const pathname = usePathname();
  const Page = ROUTES[pathname] ?? NotFound;
  return (
    <AppProvider>
      {/* key: a fresh page on every route change, as with Next.js navigation */}
      <Shell><Page key={pathname} /></Shell>
    </AppProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
