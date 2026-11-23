"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { norm, parseCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/export";
import { Drawer } from "./drawer";
import { Button, fmt } from "./ui";

/**
 * Bulk upload from a CSV file: download the template, fill it in (Excel → Save as CSV), upload it,
 * review every row in a preview, then import the rows that passed. Rows with problems are skipped
 * and can be downloaded, fixed and uploaded again.
 */

export interface UploadColumn {
  /** Header in the template; also how the column is matched in an uploaded file. */
  label: string;
  required?: boolean;
  /** What to enter — shown in the column guide. */
  help: string;
  /** Other headers accepted for this column. */
  aliases?: string[];
}
/** One data row, keyed by column label (missing optional columns are ""). */
export type UploadRow = Record<string, string>;
export interface UploadCheck<T> {
  value?: T;
  /** Why the row can't be imported. */
  error?: string;
  /** Nothing to import (e.g. the value is unchanged) — not a problem, just left out. */
  skip?: string;
  /** Shown for a row that will be imported, e.g. "Target 40 → 45". */
  note?: string;
  /** Rows sharing any key in one file are duplicates; only the first is kept. */
  key?: string | string[];
}
export interface UploadSpec<T> {
  /** E.g. "spend entries". */
  what: string;
  /** Template file name (no extension). */
  file: string;
  columns: UploadColumn[];
  /** Pre-filled template rows; the template is headers only when omitted. */
  templateRows?: () => Record<string, string | number>[];
  check: (row: UploadRow) => UploadCheck<T>;
  importRows: (rows: T[], fileName: string) => void;
  /** Extra guidance under the column guide. */
  notes?: ReactNode;
}

interface Checked<T> { line: number; cells: UploadRow; result: UploadCheck<T> }
interface Parsed<T> { file: string; rows: Checked<T>[]; error?: string }

const PREVIEW_LIMIT = 300;

function readFile<T>(spec: UploadSpec<T>, file: string, text: string): Parsed<T> {
  const grid = parseCsv(text);
  if (grid.length < 2) return { file, rows: [], error: "The file has no data rows under the header row." };
  // Headers match a column's label or aliases exactly, ignoring case, spacing, "*" and units in brackets, e.g. "Annual budget (₹)".
  const head = grid[0].map((h) => norm(h.replace(/\([^)]*\)|\[[^\]]*\]|\*/g, "")));
  const index = spec.columns.map((c) => {
    const names = [c.label, ...(c.aliases ?? [])].map(norm);
    return head.findIndex((h) => names.includes(h));
  });
  const missing = spec.columns.filter((c, i) => c.required && index[i] < 0).map((c) => `“${c.label}”`);
  if (missing.length) return { file, rows: [], error: `Missing column${missing.length > 1 ? "s" : ""} ${missing.join(", ")}. Download the template to see the layout.` };

  const seen = new Map<string, number>();
  const rows: Checked<T>[] = [];
  grid.slice(1).forEach((cellsIn, i) => {
    const cells: UploadRow = Object.fromEntries(spec.columns.map((c, ci) => [c.label, index[ci] >= 0 ? (cellsIn[index[ci]] ?? "").trim() : ""]));
    if (spec.columns.every((c) => !cells[c.label])) return;
    const line = i + 2;
    let result = spec.check(cells);
    if (!result.error && !result.skip && result.key) {
      const keys = ([] as string[]).concat(result.key);
      const first = keys.map((k) => seen.get(k)).find(Boolean);
      if (first) result = { error: `Repeats row ${first} of this file` };
      else keys.forEach((k) => seen.set(k, line));
    }
    rows.push({ line, cells, result });
  });
  if (!rows.length) return { file, rows, error: "The file has no data rows under the header row." };
  return { file, rows };
}

export function BulkUpload<T>({ title, spec, onClose }: { title: string; spec: UploadSpec<T>; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed<T> | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [drag, setDrag] = useState(false);

  const load = async (f: File) => {
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setParsed({ file: f.name, rows: [], error: "Upload a .csv file. In Excel, use File › Save As › CSV (comma delimited)." });
      return;
    }
    setOnlyProblems(false);
    setParsed(readFile(spec, f.name, await f.text()));
  };
  const template = () => {
    const rows = spec.templateRows?.() ?? [];
    downloadCsv(`${spec.file}-template`, rows.length ? rows : [Object.fromEntries(spec.columns.map((c) => [c.label, ""]))]);
  };

  const ok = parsed?.rows.filter((r) => !r.result.error && !r.result.skip) ?? [];
  const skipped = parsed?.rows.filter((r) => r.result.skip) ?? [];
  const bad = parsed?.rows.filter((r) => r.result.error) ?? [];
  const shown = (onlyProblems ? bad : parsed?.rows ?? []).slice(0, PREVIEW_LIMIT);
  const downloadProblems = () =>
    downloadCsv(`${spec.file}-problems`, bad.map((r) => ({ ...Object.fromEntries(spec.columns.map((c) => [c.label, r.cells[c.label]])), Problem: r.result.error ?? "" })));
  const doImport = () => {
    if (!parsed || !ok.length) return;
    spec.importRows(ok.map((r) => r.result.value as T), parsed.file);
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-[920px]"
      title={title}
      subtitle="Download the template, fill it in, save as CSV and upload it · you review every row before anything is saved"
      footer={
        <>
          {parsed && bad.length > 0 && <Button size="sm" variant="ghost" onClick={downloadProblems}><Download size={13} /> Rows with problems</Button>}
          <span className="ml-auto" />
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" disabled={!ok.length} onClick={doImport}>
            <Upload size={13} /> {ok.length ? `Import ${fmt(ok.length)} ${ok.length === 1 ? "row" : "rows"}` : "Import"}
          </Button>
        </>
      }
    >
      <input ref={fileRef} type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ""; }} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) load(f); }}
        className={clsx("flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-4 py-3", drag ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60")}
      >
        <FileSpreadsheet size={22} className="shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1 text-sm">
          {parsed ? <span className="font-medium text-slate-800">{parsed.file}</span> : <span className="font-medium text-slate-800">Drop a CSV file here, or choose one</span>}
          <p className="text-xs text-slate-500">{parsed ? `${fmt(parsed.rows.length)} data row${parsed.rows.length === 1 ? "" : "s"} read` : `One row per ${spec.what.replace(/ies$/, "y").replace(/s$/, "")} · the first row holds the column names`}</p>
        </div>
        <Button size="sm" onClick={template}><Download size={13} /> Template</Button>
        <Button size="sm" variant={parsed ? undefined : "primary"} onClick={() => fileRef.current?.click()}><Upload size={13} /> {parsed ? "Choose another file" : "Choose file"}</Button>
      </div>

      {parsed?.error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {parsed.error}</p>
      )}

      {parsed && !parsed.error ? (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700"><CheckCircle2 size={13} /> {fmt(ok.length)} ready to import</span>
            {skipped.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{fmt(skipped.length)} unchanged</span>}
            {bad.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700"><AlertTriangle size={13} /> {fmt(bad.length)} with problems — skipped</span>}
            {bad.length > 0 && (
              <label className="ml-auto flex cursor-pointer select-none items-center gap-1.5 text-slate-600">
                <input type="checkbox" className="h-3.5 w-3.5 accent-brand-600" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Show only problems
              </label>
            )}
          </div>
          <div className="max-h-[52vh] overflow-auto rounded-lg border border-slate-200 scroll-thin">
            <table className="w-full text-xs tabular">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Row</th>
                  {spec.columns.map((c) => <th key={c.label} className="whitespace-nowrap px-2 py-2 text-left font-medium">{c.label}</th>)}
                  <th className="px-2 py-2 text-left font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((r) => (
                  <tr key={r.line} className={r.result.error ? "bg-rose-50/50" : undefined}>
                    <td className="px-2 py-1.5 text-slate-400">{r.line}</td>
                    {spec.columns.map((c) => <td key={c.label} className="max-w-[160px] truncate px-2 py-1.5 text-slate-700" title={r.cells[c.label]}>{r.cells[c.label] || <span className="text-slate-300">—</span>}</td>)}
                    <td className="min-w-[180px] px-2 py-1.5">
                      {r.result.error ? (
                        <span className="text-rose-700">{r.result.error}</span>
                      ) : r.result.skip ? (
                        <span className="text-slate-400">{r.result.skip}</span>
                      ) : (
                        <span className="text-emerald-700">{r.result.note ?? "Will be added"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(onlyProblems ? bad : parsed.rows).length > PREVIEW_LIMIT && <p className="mt-1 text-[11px] text-slate-400">Showing the first {PREVIEW_LIMIT} rows.</p>}
        </div>
      ) : (
        <ColumnGuide spec={spec} />
      )}
    </Drawer>
  );
}

function ColumnGuide<T>({ spec }: { spec: UploadSpec<T> }) {
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Columns</h3>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {spec.columns.map((c) => (
              <tr key={c.label}>
                <td className="w-48 whitespace-nowrap px-3 py-2 align-top font-medium text-slate-800">
                  {c.label}
                  {!c.required && <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-slate-400">optional</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{c.help}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <p>Names are matched ignoring case and spacing. Amounts may include ₹ and commas.</p>
        {spec.notes}
      </div>
    </div>
  );
}

/** The "Upload CSV" button shown next to an Add button. */
export function UploadButton({ onClick, label = "Upload CSV" }: { onClick: () => void; label?: string }) {
  return <Button size="sm" onClick={onClick}><Upload size={13} /> {label}</Button>;
}
