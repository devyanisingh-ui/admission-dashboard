/**
 * CSV reading for bulk uploads. Handles quoted fields (with commas, quotes and line breaks),
 * a UTF-8 byte-order mark, and comma, semicolon or tab separators (Excel uses ";" in some locales).
 */
import { CYCLE_MONTHS } from "./data";

/** Parses CSV text into rows of cells. Blank lines are dropped. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const sep = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"' && cur.trim() === "") { cur = ""; q = true; }
    else if (c === sep) { row.push(cur.trim()); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cur.trim()); cur = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur.trim());
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

/** Lower-case letters and digits only — for forgiving header and name matching. */
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A number cell: allows ₹, commas, spaces and a trailing "%". Blank → NaN. */
export function readNumber(raw: string | undefined): number {
  const s = (raw ?? "").replace(/[₹,\s%]/g, "").replace(/^rs\.?/i, "");
  return s === "" ? NaN : Number(s);
}

/** A cycle month ("Nov", "November", "nov-26", "11") → "Nov"; undefined if not recognised. */
export function readMonth(raw: string | undefined): string | undefined {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return undefined;
  const byName = CYCLE_MONTHS.find((m) => s.startsWith(m.toLowerCase()));
  if (byName) return byName;
  const n = Number(s.split(/[-/ ]/)[0]);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return Number.isInteger(n) && n >= 1 && n <= 12 ? names[n - 1] : undefined;
}

/** Matches a cell to one of the allowed values, ignoring case, spaces and punctuation. */
export function readChoice<T extends string>(raw: string | undefined, options: readonly T[]): T | undefined {
  const n = norm(raw ?? "");
  return n ? options.find((o) => norm(o) === n) : undefined;
}

/** Finds a school by short name, full name or any system code (SaaS / LeadSquared / FABS). */
export function readLocation<L extends { name: string; short: string; codes: Record<string, string> }>(raw: string | undefined, locs: readonly L[]): L | undefined {
  const n = norm(raw ?? "");
  if (!n) return undefined;
  return locs.find((l) => norm(l.short) === n || norm(l.name) === n) ?? locs.find((l) => Object.values(l.codes).some((c) => norm(c) === n));
}
