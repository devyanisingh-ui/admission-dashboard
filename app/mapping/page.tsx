"use client";

import clsx from "clsx";
import { AlertTriangle, Check, Clock, Link2, Search, SearchX, Sparkles, Undo2, UserX, X, Zap } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { SnapshotCard } from "@/components/dashboard-widgets";
import { Drawer } from "@/components/drawer";
import { LocationPicker, useCurrentLocation } from "@/components/location-picker";
import { Badge, Button, Card, Guard, Note, PageHeader, Pii, SourceTag, Table, Tabs, Td } from "@/components/ui";
import { useApp } from "@/lib/context";
import { AUDIT_LOG, crmCandidatesFor, crmSearchPool, mappingQueue, type CrmLead, type MappingItem, type MatchField } from "@/lib/data";
import { roleLabel } from "@/lib/roles";

export default function MappingPage() {
  return (
    <Guard perm="view.mapping">
      <MappingWrapper />
    </Guard>
  );
}

function MappingWrapper() {
  const loc = useCurrentLocation();
  // Re-mount queue state when the location changes.
  return <MappingQueue key={loc.id} />;
}

const PROGRESS_SEGMENTS = [
  { key: "auto", label: "Auto-linked", color: "bg-emerald-500" },
  { key: "confirmed", label: "Confirmed suggestion", color: "bg-brand-500" },
  { key: "manual", label: "Linked manually", color: "bg-violet-500" },
  { key: "direct", label: "Direct (no lead)", color: "bg-slate-400" },
  { key: "suggested", label: "Awaiting confirmation", color: "bg-amber-300" },
  { key: "unmatched", label: "Unmatched", color: "bg-rose-400" },
] as const;

type Tab = "suggested" | "unmatched" | "linked" | "audit";
interface AuditEntry { at: string; who: string; role: string; action: string; target: string; change: string }

function now() {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function MappingQueue() {
  const loc = useCurrentLocation();
  const { can, userName, role } = useApp();
  const [items, setItems] = useState<MappingItem[]>(() => mappingQueue(loc.id));
  const [tab, setTab] = useState<Tab>("suggested");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [linking, setLinking] = useState<MappingItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canAct = can("mapping.act");
  const canOverride = can("mapping.override");

  const by = (s: MappingItem["state"][]) => items.filter((i) => s.includes(i.state));
  // Work queues: oldest first, so items breaching the 48-hour target are at the top.
  const oldestFirst = (a: MappingItem, b: MappingItem) => b.fabs.hoursSinceEntry - a.fabs.hoursSinceEntry;
  const suggested = by(["suggested"]).sort(oldestFirst);
  const unmatched = by(["unmatched"]).sort(oldestFirst);
  const linked = by(["linked", "direct"]);
  const overdue = [...suggested, ...unmatched].filter((i) => i.fabs.hoursSinceEntry > 48).length;

  const log = (action: string, item: MappingItem, change: string) => {
    setAudit((a) => [{ at: `Today, ${now()}`, who: userName, role: roleLabel(role), action, target: item.fabs.admNo, change }, ...a]);
    setToast(`${action}: ${item.fabs.admNo}`);
    setTimeout(() => setToast(null), 2500);
  };
  const update = (id: string, patch: Partial<MappingItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const confirm = (i: MappingItem) => {
    update(i.id, { state: "linked", method: "confirmed", linkedBy: userName, linkedAt: "Today" });
    log("Mapping confirmed", i, `Suggested → Linked to ${i.candidate?.leadId} (confirmed)`);
  };
  const reject = (i: MappingItem) => {
    update(i.id, { state: "unmatched", candidate: undefined, matched: undefined, score: undefined });
    log("Suggestion rejected", i, `${i.candidate?.leadId} rejected → Unmatched`);
  };
  const markDirect = (i: MappingItem) => {
    update(i.id, { state: "direct", method: "direct", candidate: undefined, linkedBy: userName, linkedAt: "Today" });
    log("Direct admission marked", i, "Unmatched → Direct admission – no CRM lead");
  };
  const manualLink = (i: MappingItem, lead: CrmLead) => {
    const prev = i.candidate?.leadId;
    update(i.id, { state: "linked", method: "manual", candidate: lead, linkedBy: userName, linkedAt: "Today", matched: undefined, score: undefined });
    log(prev && i.state !== "unmatched" ? "Mapping overridden" : "Manual link", i, `${prev ?? "—"} → ${lead.leadId}`);
    setLinking(null);
  };
  const undo = (i: MappingItem) => {
    update(i.id, { state: "unmatched", candidate: undefined, method: undefined, linkedBy: undefined, linkedAt: undefined });
    log("Mapping undone", i, `${i.method === "direct" ? "Direct admission" : i.candidate?.leadId} → Unmatched`);
  };

  const autoRate = Math.round((linked.filter((l) => l.method === "auto").length / Math.max(1, items.length)) * 100);
  const progress = (() => {
    const counts = {
      auto: linked.filter((l) => l.method === "auto").length,
      confirmed: linked.filter((l) => l.method === "confirmed").length,
      manual: linked.filter((l) => l.method === "manual").length,
      direct: linked.filter((l) => l.method === "direct").length,
      suggested: suggested.length,
      unmatched: unmatched.length,
    };
    const done = counts.auto + counts.confirmed + counts.manual + counts.direct;
    return { counts, done, pct: (done / Math.max(1, items.length)) * 100 };
  })();

  return (
    <>
      <PageHeader
        title="Admission Mapping"
        subtitle={
          <>
            <b className="font-semibold text-slate-700">{loc.name}</b> · link every FABS admission to its LeadSquared lead · mappings live only in the
            dashboard, nothing is written back to LeadSquared or FABS
          </>
        }
        actions={<LocationPicker />}
      />

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(15.5rem,1fr))]">
        <SnapshotCard theme="violet" icon={Sparkles} label="Suggested matches" value={suggested.length} change={null} sub="Confirm or reject in one click" />
        <SnapshotCard theme="orange" icon={SearchX} label="Unmatched" value={unmatched.length} change={null} sub="Find the lead or mark Direct" />
        <SnapshotCard theme={overdue ? "rose" : "green"} icon={Clock} label="Over 48 hours" value={overdue} change={null} sub={overdue ? "Past the 48-hour target — alert raised" : "Everything within 48 hours"} />
        <SnapshotCard theme="green" icon={Link2} label="Linked / direct" value={linked.length} change={null} sub={`${progress.done} of ${items.length} admissions done`} />
        <SnapshotCard theme="blue" icon={Zap} label="Auto-link rate" value={`${autoRate}%`} change={null} sub="Exact match on mobile, name, DOB, school" />
      </div>

      {/* How far mapping has got, and how each link was made */}
      <section className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-brand-900">
            Mapping progress <span className="ml-1 text-lg tabular">{progress.pct.toFixed(0)}%</span>
          </span>
          <span className="text-xs text-slate-500">{progress.done} of {items.length} FABS admissions linked or marked direct · {items.length - progress.done} still to map</span>
        </div>
        <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-100">
          {PROGRESS_SEGMENTS.map((s) => {
            const n = progress.counts[s.key];
            return n ? <div key={s.key} className={s.color} style={{ width: `${(n / Math.max(1, items.length)) * 100}%` }} title={`${s.label}: ${n}`} /> : null;
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
          {PROGRESS_SEGMENTS.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={clsx("h-2 w-3 rounded-sm", s.color)} />
              {s.label} <b className="tabular text-slate-900">{progress.counts[s.key]}</b>
            </span>
          ))}
        </div>
      </section>

      {!canAct && (
        <div className="mt-3">
          <Note>You have view-only access to the Mapping Queue{canOverride ? " (you can undo / override existing mappings)" : ""}.</Note>
        </div>
      )}

      <div className="mt-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "suggested", label: <>Suggested <Count n={suggested.length} /></> },
            { id: "unmatched", label: <>Unmatched <Count n={unmatched.length} /></> },
            { id: "linked", label: <>Linked <Count n={linked.length} tone="slate" /></> },
            { id: "audit", label: "Audit trail" },
          ]}
        />

        {tab === "suggested" && (
          <div className="grid items-start gap-3 min-[1500px]:grid-cols-2">
            {suggested.length === 0 && <Card className="min-[1500px]:col-span-2"><p className="py-6 text-center text-sm text-slate-500">All suggestions reviewed. 🎉</p></Card>}
            {suggested.map((i) => (
              <SuggestionCard key={i.id} item={i} canAct={canAct} onConfirm={() => confirm(i)} onReject={() => reject(i)} />
            ))}
          </div>
        )}

        {tab === "unmatched" && (
          <Card bodyClass="p-0">
            <Table head={["FABS admission no.", "Child", "Parent", "Mobile", "DOB", "Grade / programme", "Fee paid", "Age", ""]}>
              {unmatched.map((i) => (
                <tr key={i.id}>
                  <Td className="font-mono text-xs">{i.fabs.admNo}</Td>
                  <Td className="font-medium">{i.fabs.child}</Td>
                  <Td>{i.fabs.parent}</Td>
                  <Td><Pii value={i.fabs.mobile} /></Td>
                  <Td><Pii value={i.fabs.dob} /></Td>
                  <Td>{i.fabs.unit}</Td>
                  <Td>{i.fabs.feePaidOn}</Td>
                  <Td><AgeBadge h={i.fabs.hoursSinceEntry} /></Td>
                  <Td>
                    {canAct && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="primary" onClick={() => setLinking(i)}><Search size={13} /> Find CRM lead</Button>
                        <Button size="sm" onClick={() => markDirect(i)} title="Mark Direct admission – no CRM lead"><UserX size={13} /> Direct</Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            {unmatched.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No unmatched admissions.</p>}
          </Card>
        )}

        {tab === "linked" && (
          <Card bodyClass="p-0">
            <Table head={["FABS admission no.", "Child", "Grade / programme", "CRM lead", "SaaS form", "Counsellor", "Method", "By", "When", ""]}>
              {linked.map((i) => (
                <tr key={i.id}>
                  <Td className="font-mono text-xs">{i.fabs.admNo}</Td>
                  <Td className="font-medium">{i.fabs.child}</Td>
                  <Td>{i.fabs.unit}</Td>
                  <Td className="font-mono text-xs">{i.candidate?.leadId ?? "—"}</Td>
                  <Td className="font-mono text-xs">{i.candidate?.saasFormId ?? "—"}</Td>
                  <Td>{i.candidate?.counsellor ?? "—"}</Td>
                  <Td><MethodBadge m={i.method} /></Td>
                  <Td>{i.linkedBy}</Td>
                  <Td>{i.linkedAt}</Td>
                  <Td>
                    {canOverride && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setLinking(i)} title="Override: link to a different CRM lead"><Link2 size={13} /> Override</Button>
                        <Button size="sm" variant="ghost" onClick={() => undo(i)}><Undo2 size={13} /> Undo</Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        )}

        {tab === "audit" && (
          <Card bodyClass="p-0" title="Mapping audit trail" subtitle="Every link logs who, when and method">
            <Table head={["When", "Who", "Role", "Action", "FABS record", "Change"]}>
              {[...audit, ...AUDIT_LOG.filter((a) => a.action.toLowerCase().includes("mapping") || a.action.includes("Direct"))].map((a, idx) => (
                <tr key={idx} className={idx < audit.length ? "bg-brand-50/50" : ""}>
                  <Td>{a.at}</Td>
                  <Td className="font-medium">{a.who}</Td>
                  <Td>{a.role}</Td>
                  <Td>{a.action}</Td>
                  <Td className="font-mono text-xs">{a.target}</Td>
                  <Td>{a.change}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        )}
      </div>

      <div className="mt-4">
        <Note tone="phase2">
          Backfilled (2025–26) unmatched records are not mapped manually: they count in admissions and strength but are excluded from conversion %.
        </Note>
      </div>

      {linking && <LinkDrawer key={linking.id} item={linking} locId={loc.id} onClose={() => setLinking(null)} onLink={(lead) => manualLink(linking, lead)} />}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          <Check size={15} className="text-emerald-400" /> {toast} · audit-logged
        </div>
      )}
    </>
  );
}

function Count({ n, tone = "amber" }: { n: number; tone?: "amber" | "slate" }) {
  return <span className={clsx("ml-1 rounded-full px-1.5 text-[11px]", tone === "amber" && n ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")}>{n}</span>;
}

function AgeBadge({ h }: { h: number }) {
  const label = h < 24 ? `${h}h` : `${Math.floor(h / 24)}d ${h % 24}h`;
  return (
    <Badge tone={h > 48 ? "red" : h > 24 ? "amber" : "slate"}>
      <Clock size={11} /> {label}
    </Badge>
  );
}

function MethodBadge({ m }: { m?: MappingItem["method"] }) {
  if (m === "auto") return <Badge tone="green">Auto-link</Badge>;
  if (m === "confirmed") return <Badge tone="blue">Confirmed</Badge>;
  if (m === "manual") return <Badge tone="violet">Manual</Badge>;
  if (m === "direct") return <Badge tone="slate">Direct – no CRM lead</Badge>;
  return null;
}


const FIELDS: { key: MatchField; label: string; pii?: boolean }[] = [
  { key: "child", label: "Child name" },
  { key: "mobile", label: "Mobile", pii: true },
  { key: "dob", label: "Date of birth", pii: true },
  { key: "grade", label: "Grade / programme" },
  { key: "location", label: "Location" },
];

function SuggestionCard({ item, canAct, onConfirm, onReject }: { item: MappingItem; canAct: boolean; onConfirm: () => void; onReject: () => void }) {
  const loc = useCurrentLocation();
  const c = item.candidate!;
  const label = (f: (typeof FIELDS)[number]) => (f.key === "grade" ? (loc.vertical === "Schools" ? "Grade" : "Programme") : f.label);
  const differs = FIELDS.filter((f) => !item.matched?.includes(f.key)).map(label);
  const val = (src: "fabs" | "crm", f: MatchField): ReactNode => {
    if (f === "grade") return src === "fabs" ? item.fabs.unit : c.unit;
    // Systems use different location codes; show the resolved School Master name with the raw code.
    if (f === "location")
      return (
        <>
          {loc.short} <span className="font-mono text-[11px] text-slate-400">{src === "fabs" ? loc.codes.fabs : loc.codes.crm}</span>
        </>
      );
    const v = src === "fabs" ? item.fabs[f] : c[f];
    return FIELDS.find((x) => x.key === f)?.pii ? <Pii value={v} /> : v;
  };

  return (
    <article className={clsx("overflow-hidden rounded-xl border bg-white", item.fabs.hoursSinceEntry > 48 ? "border-rose-200" : "border-slate-200")}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pt-3">
        <h3 className="text-sm font-semibold text-slate-900">{item.fabs.child}</h3>
        <Badge tone="blue">Match {item.score}%</Badge>
        <AgeBadge h={item.fabs.hoursSinceEntry} />
        <span className="text-xs text-slate-500">Fee paid {item.fabs.feePaidOn}</span>
      </header>
      <p className="px-4 pb-2 pt-0.5 text-xs text-slate-500">
        {differs.length ? (
          <>
            <span className="font-medium text-amber-700">{differs.join(", ")}</span> {differs.length > 1 ? "differ" : "differs"} — check before confirming
          </>
        ) : (
          "All fields match"
        )}
      </p>

      <div className="overflow-x-auto scroll-thin">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[132px]" />
            <col />
            <col />
            <col className="w-8" />
          </colgroup>
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-1.5 font-medium" />
              <th className="px-2 py-1.5 font-medium">
                <SourceTag system="FABS" /> <span className="ml-1 font-mono normal-case">{item.fabs.admNo}</span>
              </th>
              <th className="px-2 py-1.5 font-medium">
                <SourceTag system="LeadSquared" /> <span className="ml-1 font-mono normal-case">{c.leadId}</span>
              </th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {FIELDS.map((f) => {
              const ok = item.matched?.includes(f.key);
              return (
                <tr key={f.key} className={clsx(!ok && "bg-amber-50")}>
                  <td className="whitespace-nowrap px-4 py-1.5 text-xs text-slate-500">{label(f)}</td>
                  <td className="truncate px-2 py-1.5 tabular">{val("fabs", f.key)}</td>
                  <td className={clsx("truncate px-2 py-1.5 tabular", !ok && "font-semibold text-amber-800")}>{val("crm", f.key)}</td>
                  <td className="pr-3 text-right">
                    {ok ? (
                      <Check size={15} className="ml-auto text-emerald-600" aria-label="Matches" />
                    ) : (
                      <AlertTriangle size={15} className="ml-auto text-amber-600" aria-label="Differs" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5">
        <span className="min-w-0 flex-1 text-xs text-slate-500">
          CRM status <b className="font-medium text-slate-700">{c.status}</b> · owner {c.counsellor} · {c.source}
          {c.saasFormId && <> · SaaS {c.saasFormId}</>}
        </span>
        {canAct && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="danger" onClick={onReject}><X size={13} /> Not a match</Button>
            <Button size="sm" variant="primary" onClick={onConfirm}><Check size={13} /> Confirm match</Button>
          </div>
        )}
      </footer>
    </article>
  );
}

/** Scores a CRM lead against a FABS admission; returns the score and which fields agree. */
function scoreLead(fabs: MappingItem["fabs"], lead: CrmLead) {
  const reasons: string[] = [];
  let score = 0;
  const [ff, ...fs] = fabs.child.toLowerCase().split(" ");
  const [lf, ...ls] = lead.child.toLowerCase().split(" ");
  if (lead.mobile === fabs.mobile) { score += 35; reasons.push("Mobile"); }
  if (lead.dob === fabs.dob) { score += 25; reasons.push("DOB"); }
  if (fs.join(" ") === ls.join(" ") && (ff.startsWith(lf.slice(0, 3)) || lf.startsWith(ff.slice(0, 3)))) { score += 20; reasons.push("Name"); }
  else if (fs.join(" ") === ls.join(" ")) { score += 8; reasons.push("Surname"); }
  if (lead.parent.toLowerCase() === fabs.parent.toLowerCase()) { score += 12; reasons.push("Parent"); }
  if (lead.unit === fabs.unit) { score += 8; reasons.push("Grade"); }
  return { score, reasons };
}

function LinkDrawer({ item, locId, onClose, onLink }: { item: MappingItem | null; locId: string; onClose: () => void; onLink: (l: CrmLead) => void }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const pool = useMemo(
    () => (item ? [...crmCandidatesFor(locId, item.fabs), ...crmSearchPool(locId)] : []),
    [locId, item?.id],
  );
  if (!item) return null;
  const isOverride = item.state !== "unmatched";

  const s = q.trim().toLowerCase();
  const ranked = pool
    .map((l) => ({ lead: l, ...scoreLead(item.fabs, l) }))
    .filter(({ lead, score }) =>
      s ? [lead.child, lead.parent, lead.mobile, lead.leadId].some((x) => x.toLowerCase().includes(s)) : score >= 20,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);
  const pickedLead = ranked.find((r) => r.lead.leadId === picked)?.lead;

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-[640px]"
      title={isOverride ? "Change linked CRM lead" : "Link to a CRM lead"}
      subtitle={<>FABS <span className="font-mono">{item.fabs.admNo}</span> · fee paid {item.fabs.feePaidOn}</>}
      footer={
        <>
          <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
            {pickedLead ? <>Link to <b className="text-slate-800">{pickedLead.leadId}</b> · {pickedLead.child}</> : "Select a CRM lead to link"}
          </span>
          <Button size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" disabled={!pickedLead} onClick={() => pickedLead && onLink(pickedLead)}>
            <Link2 size={13} /> Link lead
          </Button>
        </>
      }
    >
      {/* The FABS record being linked */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
        <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600">
          <SourceTag system="FABS" /> Admission to link
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          <Field k="Child" v={item.fabs.child} />
          <Field k="Parent" v={item.fabs.parent} />
          <Field k="Grade" v={item.fabs.unit} />
          <Field k="Mobile" v={<Pii value={item.fabs.mobile} />} />
          <Field k="DOB" v={<Pii value={item.fabs.dob} />} />
        </dl>
      </div>

      <label className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
        <Search size={15} className="text-slate-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPicked(null); }}
          placeholder="Search CRM by child / parent name, mobile or lead ID"
          className="w-full text-sm outline-none"
        />
      </label>
      <p className="mb-2 mt-3 text-xs font-medium text-slate-500">
        {s ? `${ranked.length} result${ranked.length === 1 ? "" : "s"} for “${q}”` : "Likely matches, best first"}
      </p>

      <ul className="space-y-1.5" role="listbox" aria-label="CRM leads">
        {ranked.map(({ lead, score, reasons }) => {
          const sel = picked === lead.leadId;
          return (
            <li key={lead.leadId}>
              <button
                role="option"
                aria-selected={sel}
                onClick={() => setPicked(lead.leadId)}
                onDoubleClick={() => onLink(lead)}
                className={clsx(
                  "w-full rounded-lg border px-3 py-2 text-left transition",
                  sel ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{lead.child}</span>
                  <span className="font-mono text-[11px] text-slate-400">{lead.leadId}</span>
                  <span className="ml-auto text-[11px] text-slate-500">{lead.status}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <span>Parent {lead.parent}</span>
                  <span>{lead.unit}</span>
                  <span className="tabular"><Pii value={lead.mobile} /></span>
                  <span>Owner {lead.counsellor}</span>
                </div>
                {reasons.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {reasons.map((r) => (
                      <span key={r} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">✓ {r}</span>
                    ))}
                    <span className="ml-auto text-[10px] text-slate-400">score {score}</span>
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {!ranked.length && (
        <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
          {s ? <>No CRM leads match “{q}”.</> : "No likely matches. Search by name, mobile or lead ID."}
          {!isOverride && <span className="mt-1 block text-xs">If the family never enquired, close this and use <b>Direct</b> instead.</span>}
        </p>
      )}
    </Drawer>
  );
}

const Field = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[11px] text-slate-500">{k}</dt>
    <dd className="truncate font-medium text-slate-800">{v}</dd>
  </div>
);
