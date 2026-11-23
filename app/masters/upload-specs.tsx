/**
 * Bulk upload rules for the Masters: locations, lead sources, withdrawal reasons and outreach activities.
 * Each row is checked like the matching Add form; rows that pass are created in one audit-logged change.
 * Records that already exist are never changed — rows for them are skipped.
 */
import type { UploadCheck, UploadSpec } from "@/components/bulk-upload";
import { norm, readChoice } from "@/lib/csv";
import { SOURCE_GROUPS, type Board, type SourceGroup, type Vertical } from "@/lib/data";
import {
  BOARDS, newId, REASON_SCOPES, SYS_LABEL, SYSTEMS,
  type ActivityRec, type LocationRec, type MasterKey, type MasterStore, type ReasonRec, type SourceRec, type Sys,
} from "@/lib/masters";
import type { Commit } from "./shared";

const VERTICALS: Vertical[] = ["Schools", "Higher Ed"];
const ALL_BOARDS = [...BOARDS.Schools, ...BOARDS["Higher Ed"]] as Board[];
const groupHelp = `Lead-source reporting group: ${SOURCE_GROUPS.join(", ")}`;
const names = (xs: { name: string }[]) => xs.slice(0, 6).map((x) => x.name).join(", ") + (xs.length > 6 ? `, +${xs.length - 6} more` : "");

function log(commit: Commit, master: MasterKey, file: string, what: string, recs: { name: string }[], update: (s: MasterStore) => MasterStore) {
  const noun = recs.length === 1 ? what.replace(/ies$/, "y").replace(/s$/, "") : what;
  commit(update, { master, action: "Created", record: `Bulk upload · ${file}`, detail: `${recs.length} ${noun} added: ${names(recs)}` });
}

export function locationSpec(store: MasterStore, commit: Commit): UploadSpec<LocationRec> {
  const taken = (k: string) => new Set(store.locations.map((l) => norm(k === "name" ? l.name : k === "short" ? l.short : l.codes[k as Sys])));
  const have = { name: taken("name"), short: taken("short"), saas: taken("saas"), crm: taken("crm"), fabs: taken("fabs") };
  const codeCol = (s: Sys) => ({ label: `${SYS_LABEL[s]} code`, required: true, help: `Location code in ${SYS_LABEL[s]} — must be unique` });
  return {
    what: "locations", file: "locations",
    columns: [
      { label: "Name", required: true, aliases: ["Location name", "Full name"], help: "Full name, e.g. Apeejay School, Dwarka" },
      { label: "Short name", required: true, aliases: ["Short"], help: "Shown in charts and filters, e.g. Dwarka" },
      { label: "Vertical", required: true, help: VERTICALS.join(" or ") },
      { label: "Board", required: true, help: `Schools: ${BOARDS.Schools.join(", ")} · Higher Ed: ${BOARDS["Higher Ed"].join(", ")}` },
      { label: "City", required: true, help: "City" },
      ...SYSTEMS.map(codeCol),
    ],
    check: (r): UploadCheck<LocationRec> => {
      const name = r["Name"].trim(), short = r["Short name"].trim(), city = r["City"].trim();
      if (!name) return { error: "Name is blank" };
      if (!short) return { error: "Short name is blank" };
      const vertical = readChoice(r["Vertical"], VERTICALS);
      if (!vertical) return { error: r["Vertical"] ? `Vertical “${r["Vertical"]}” must be Schools or Higher Ed` : "Vertical is blank" };
      const board = readChoice(r["Board"], ALL_BOARDS);
      if (!board || !BOARDS[vertical].includes(board)) return { error: r["Board"] ? `Board “${r["Board"]}” isn't used for ${vertical} (${BOARDS[vertical].join(", ")})` : "Board is blank" };
      if (!city) return { error: "City is blank" };
      if (have.name.has(norm(name))) return { error: `A location named “${name}” already exists` };
      if (have.short.has(norm(short))) return { error: `Short name “${short}” is already used` };
      const codes = {} as Record<Sys, string>;
      for (const s of SYSTEMS) {
        const c = r[`${SYS_LABEL[s]} code`].trim();
        if (!c) return { error: `${SYS_LABEL[s]} code is blank` };
        if (have[s].has(norm(c))) return { error: `${SYS_LABEL[s]} code ${c} is already used` };
        codes[s] = c;
      }
      return {
        key: [`n|${norm(name)}`, `s|${norm(short)}`, ...SYSTEMS.map((s) => `${s}|${norm(codes[s])}`)],
        note: `${vertical} · ${board} · ${city}`,
        value: { id: newId("loc", short), name, short, vertical, board, city, codes, active: true, custom: true },
      };
    },
    importRows: (recs, file) => log(commit, "Location", file, "locations", recs, (s) => ({ ...s, locations: [...s.locations, ...recs] })),
    notes: <p>New locations start with no grades / programmes — add them in the Grades &amp; programmes tab.</p>,
  };
}

export function sourceSpec(store: MasterStore, commit: Commit): UploadSpec<SourceRec> {
  const have = new Set(store.sources.map((s) => norm(s.name)));
  return {
    what: "lead sources", file: "lead-sources",
    columns: [
      { label: "Lead source", required: true, aliases: ["Source", "Name"], help: "As it appears in LeadSquared's source field" },
      { label: "Reporting group", required: true, aliases: ["Group"], help: groupHelp },
    ],
    check: (r): UploadCheck<SourceRec> => {
      const name = r["Lead source"].trim();
      if (!name) return { error: "Lead source is blank" };
      const group = readChoice<SourceGroup>(r["Reporting group"], SOURCE_GROUPS);
      if (!group) return { error: r["Reporting group"] ? `Reporting group “${r["Reporting group"]}” isn't one of ${SOURCE_GROUPS.join(", ")}` : "Reporting group is blank" };
      if (have.has(norm(name))) return { error: `“${name}” already exists` };
      return { key: norm(name), note: group, value: { id: newId("src", name), name, group, active: true, custom: true } };
    },
    importRows: (recs, file) => log(commit, "Lead source", file, "lead sources", recs, (s) => ({ ...s, sources: [...s.sources, ...recs] })),
  };
}

export function reasonSpec(store: MasterStore, commit: Commit): UploadSpec<ReasonRec> {
  const have = new Set(store.reasons.map((s) => norm(s.name)));
  return {
    what: "withdrawal reasons", file: "withdrawal-reasons",
    columns: [
      { label: "Reason", required: true, aliases: ["Withdrawal reason", "Name"], help: "e.g. Relocation" },
      { label: "Applies to", aliases: ["Scope"], help: `${REASON_SCOPES.join(", ")}; blank = Both` },
    ],
    check: (r): UploadCheck<ReasonRec> => {
      const name = r["Reason"].trim();
      if (!name) return { error: "Reason is blank" };
      const appliesTo = r["Applies to"].trim() ? readChoice(r["Applies to"], REASON_SCOPES) : "Both";
      if (!appliesTo) return { error: `Applies to “${r["Applies to"]}” isn't one of ${REASON_SCOPES.join(", ")}` };
      if (have.has(norm(name))) return { error: `“${name}” already exists` };
      return { key: norm(name), note: appliesTo, value: { id: newId("rsn", name), name, appliesTo, active: true, custom: true } };
    },
    importRows: (recs, file) => log(commit, "Withdrawal reason", file, "withdrawal reasons", recs, (s) => ({ ...s, reasons: [...s.reasons, ...recs] })),
  };
}

export function activitySpec(store: MasterStore, commit: Commit): UploadSpec<ActivityRec> {
  const have = new Set(store.activities.map((s) => norm(s.name)));
  return {
    what: "outreach activities", file: "outreach-activities",
    columns: [
      { label: "Activity", required: true, aliases: ["Outreach activity", "Name"], help: "e.g. School van branding" },
      { label: "Reporting group", required: true, aliases: ["Group"], help: groupHelp },
      { label: "Counted as", required: true, aliases: ["Unit"], help: "What the activity count means, plural — e.g. events, fairs, campaigns" },
    ],
    check: (r): UploadCheck<ActivityRec> => {
      const name = r["Activity"].trim();
      if (!name) return { error: "Activity is blank" };
      const group = readChoice<SourceGroup>(r["Reporting group"], SOURCE_GROUPS);
      if (!group) return { error: r["Reporting group"] ? `Reporting group “${r["Reporting group"]}” isn't one of ${SOURCE_GROUPS.join(", ")}` : "Reporting group is blank" };
      const unit = r["Counted as"].trim().toLowerCase();
      if (!unit) return { error: "Counted as is blank" };
      if (have.has(norm(name))) return { error: `“${name}” already exists` };
      return { key: norm(name), note: `${group} · ${unit}`, value: { id: newId("act", name), name, group, unit, active: true, custom: true } };
    },
    importRows: (recs, file) => log(commit, "Outreach activity", file, "outreach activities", recs, (s) => ({ ...s, activities: [...s.activities, ...recs] })),
  };
}
