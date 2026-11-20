/**
 * Download Centre report definitions. Each report builds its own rows from the
 * current filters (cycle + locations) so every export contains what its title says.
 */
import {
  AUDIT_LOG, counsellorPerf, kpis, locationById, locationTotals, locationUnits, mappingQueue, pct, strengthMovement,
  withdrawalRecords, withdrawalsByReason, type Cycle,
} from "./data";
import { outreachByActivity, partnerMonthly, partnersFor, socialByPlatform, socialCampaigns, socialMonthly } from "./marketing";

export type Row = Record<string, string | number>;
export type ReportStatus = "ok" | "partial" | "phase2";

export interface ReportDef {
  id: string;
  name: string;
  desc: string;
  group: "Admissions" | "Strength & withdrawals" | "Marketing & outreach" | "People & process";
  sources: string[];
  status: ReportStatus;
  note?: string;
  build?: (ids: string[], cycle: Cycle) => Row[];
}

const p1 = (n: number) => Number(n.toFixed(1));
const unitRows = (ids: string[], cycle: Cycle) =>
  ids.flatMap((id) => locationUnits(id, cycle).map((u) => ({ loc: locationById(id), u })));

export const REPORT_DEFS: ReportDef[] = [
  {
    id: "mis", name: "Admissions MIS", group: "Admissions", sources: ["LeadSquared", "SaaS", "FABS"], status: "ok",
    desc: "Leads → applications → offers → confirmed → enrolled, by location and grade/programme",
    build: (ids, cycle) =>
      unitRows(ids, cycle).map(({ loc, u }) => ({
        Location: loc.name, Vertical: loc.vertical, "Grade / programme": u.unit, Leads: u.leads, Applications: u.registered,
        Offers: u.offers, "CRM confirmed": u.crmConfirmed, "FABS enrolled": u.enrolled,
      })),
  },
  {
    id: "vacancy", name: "Grade-wise Vacancy", group: "Admissions", sources: ["FABS"], status: "ok",
    desc: "Seats for new admission, net admissions and vacancies per grade/programme",
    build: (ids, cycle) =>
      unitRows(ids, cycle).map(({ loc, u }) => {
        const net = u.enrolled - u.withdrawnNew;
        return { Location: loc.name, "Grade / programme": u.unit, Seats: u.seats, "Net admissions": net, Vacancy: Math.max(0, u.seats - net), "Seat fill %": p1(pct(net, u.seats)) };
      }),
  },
  {
    id: "targets", name: "Grade-wise Admissions (target vs actual)", group: "Admissions", sources: ["FABS"], status: "ok",
    desc: "FABS-enrolled against dashboard targets, with gap and achievement %",
    build: (ids, cycle) =>
      unitRows(ids, cycle).map(({ loc, u }) => ({
        Location: loc.name, "Grade / programme": u.unit, Target: u.target, "FABS enrolled": u.enrolled, Gap: u.enrolled - u.target, "Achievement %": p1(pct(u.enrolled, u.target)),
      })),
  },
  {
    id: "funnel", name: "Funnel & Conversion", group: "Admissions", sources: ["LeadSquared", "SaaS", "FABS"], status: "ok",
    desc: "Stage counts, conversion %, Pending Fee and Unmapped, per location",
    build: (ids, cycle) =>
      ids.map((id) => {
        const t = locationTotals(id, cycle);
        const k = kpis(t);
        return {
          Location: locationById(id).name, Enquiries: t.leads, Contacted: t.contacted, Registered: t.registered, Offers: t.offers,
          "CRM confirmed": t.crmConfirmed, "FABS enrolled": t.enrolled, "Lead→App %": p1(k.leadToApp), "App→Adm %": p1(k.appToAdm),
          "Overall conv. %": p1(k.overall), "Pending fee": k.pending, "Pending fee >15d": t.pendingFee[2], Unmapped: t.unmapped,
        };
      }),
  },
  {
    id: "withdrawals", name: "Withdrawals", group: "Strength & withdrawals", sources: ["FABS"], status: "ok",
    desc: "Withdrawals by location and reason, split new-admission vs existing student",
    build: (ids, cycle) =>
      ids.flatMap((id) =>
        withdrawalsByReason([id], cycle)
          .filter((r) => r.newAdmission + r.existing)
          .map((r) => ({ Location: locationById(id).name, Reason: r.reason, "New admission": r.newAdmission, "Existing student": r.existing, Total: r.newAdmission + r.existing })),
      ),
  },
  {
    id: "strength", name: "Current Strength & Movement", group: "Strength & withdrawals", sources: ["FABS"], status: "ok",
    desc: "Monthly opening + enrolments − withdrawals = closing, with last year",
    build: (ids, cycle) =>
      strengthMovement(ids, cycle).map((m) => ({
        Month: m.month, Opening: m.opening, "New enrolments": m.enrolments, "Withdrawn – new": m.withdrawnNew, "Withdrawn – existing": m.withdrawnExisting,
        Closing: m.closing, "Closing last year": m.closingLY,
      })),
  },
  {
    id: "withdrawal-list", name: "Withdrawal register", group: "Strength & withdrawals", sources: ["FABS"], status: "partial",
    note: "Refund status awaits a FABS field (open item #7)",
    desc: "Student-level list of recent withdrawals with date, reason and type",
    build: (ids) => withdrawalRecords(ids).map((r) => ({ "Admission no.": r.admNo, Student: r.child, Location: r.location, "Grade / programme": r.unit, Date: r.date, Reason: r.reason, Type: r.type })),
  },
  {
    id: "counsellor", name: "Counsellor Productivity", group: "People & process", sources: ["LeadSquared", "FABS"], status: "partial",
    note: "Follow-up metrics need CRM activity history (open item #6)",
    desc: "Leads owned, offers, confirmations and matched enrolments per counsellor",
    build: (ids, cycle) =>
      ids.flatMap((id) =>
        counsellorPerf(id, cycle).map((c) => ({
          Location: locationById(id).name, Counsellor: c.name, "Leads owned": c.leads, Offers: c.offers, "CRM confirmed": c.confirmed, Enrolled: c.enrolled, "Conversion %": p1(c.conv),
        })),
      ),
  },
  {
    id: "ews", name: "EWS/DG Compliance", group: "People & process", sources: ["FABS"], status: "partial",
    note: "Depends on the FABS admission-category field (open item #7)",
    desc: "Reserved vs filled EWS/DG seats per entry grade",
    build: (ids, cycle) =>
      unitRows(ids, cycle)
        .filter(({ u }) => u.ewsSeats)
        .map(({ loc, u }) => ({ Location: loc.name, Grade: u.unit, Reserved: u.ewsSeats, Filled: u.ewsFilled, "Fill %": p1(pct(u.ewsFilled, u.ewsSeats)) })),
  },
  {
    id: "mapping-audit", name: "Admission Mapping Audit", group: "People & process", sources: ["Dashboard"], status: "ok",
    desc: "Every CRM ↔ FABS link with who, when and method",
    build: (ids) => [
      ...ids.flatMap((id) =>
        mappingQueue(id)
          .filter((m) => m.state === "linked" || m.state === "direct")
          .map((m) => ({ Location: locationById(id).name, "FABS admission no.": m.fabs.admNo, "CRM lead": m.candidate?.leadId ?? "—", Method: m.method ?? "", By: m.linkedBy ?? "", When: m.linkedAt ?? "" })),
      ),
      ...AUDIT_LOG.filter((a) => /mapping|direct/i.test(a.action)).map((a) => ({ Location: a.location, "FABS admission no.": a.target, "CRM lead": a.change, Method: a.action, By: a.who, When: a.at })),
    ],
  },
  {
    id: "budget", name: "Budget & Outreach", group: "Marketing & outreach", sources: ["Dashboard", "LeadSquared", "FABS"], status: "ok",
    desc: "Allocation, actual spend and activities (entered) with outcomes (leads, admissions, cost per lead / admission)",
    build: (ids, cycle) =>
      ids.flatMap((id) =>
        outreachByActivity([id], cycle).map((a) => ({
          Location: locationById(id).name, Activity: a.type, "Allocated (₹)": a.allocated, "Spent (₹)": a.spent, Activities: a.activities,
          Leads: a.leads, Admissions: a.admissions, "Cost per lead (₹)": Math.round(a.cpl), "Cost per admission (₹)": Math.round(a.cpa),
        })),
      ),
  },
  {
    id: "social", name: "Social Media", group: "Marketing & outreach", sources: ["Dashboard", "LeadSquared"], status: "ok",
    desc: "Reach, impressions, interactions and prospects by platform and campaign (entered)",
    build: (ids, cycle) => [
      ...socialByPlatform(ids, cycle).map((p) => ({
        Section: "Platform", Platform: p.platform, Campaign: "", School: "All", Month: "", Reach: p.reach, Impressions: p.impressions, Interactions: p.interactions,
        "Engagement %": p1(p.engagement), Prospects: p.prospects,
      })),
      ...socialCampaigns(ids, cycle).map((c) => ({
        Section: "Campaign", Platform: c.platform, Campaign: c.name, School: locationById(c.locationId).short, Month: c.month, Reach: c.reach, Impressions: "", Interactions: c.clicks,
        "Engagement %": "", Prospects: c.leads,
      })),
      ...socialMonthly(ids, cycle).map((m) => ({
        Section: "Month", Platform: "All", Campaign: "", School: "All", Month: m.month, Reach: m.reach, Impressions: "", Interactions: "", "Engagement %": "", Prospects: m.prospects,
      })),
    ],
  },
  {
    id: "partners", name: "Partners", group: "Marketing & outreach", sources: ["Dashboard", "LeadSquared", "FABS"], status: "ok",
    desc: "Connected partners (preschools, crèches, corporates, RWAs) with leads shared and conversion (entered)",
    build: (ids, cycle) => {
      const ps = partnersFor(ids, cycle);
      return [
        ...ps.map((p) => ({
          Partner: p.name, Type: p.type, Location: locationById(p.locationId).short, Since: p.since, Month: "Cycle total",
          "Leads shared": p.leadsShared, Admissions: p.admissions, "Conversion %": p1(p.conversion), Status: p.active ? "Active" : "Inactive",
        })),
        ...partnerMonthly(ps).map((m) => ({
          Partner: "All partners", Type: "All", Location: "All", Since: "", Month: m.month,
          "Leads shared": m.Preschool + m.Crèche + m.Corporate + m.RWA, Admissions: m.admissions, "Conversion %": "", Status: "",
        })),
      ];
    },
  },
];
