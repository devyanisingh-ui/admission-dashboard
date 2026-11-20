/** Client-side export helpers (Phase 1 demo: CSV opens in Excel; PDF via the browser print dialog). */
export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const head = Object.keys(rows[0]);
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [head.join(","), ...rows.map((r) => head.map((h) => esc(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const printPdf = () => window.print();

/**
 * Prints one report on its own (choose "Save as PDF" in the print dialog).
 * Uses a hidden frame, so no pop-up permission is needed. Returns false if printing could not start.
 */
export function printReport(title: string, subtitle: string, rows: Record<string, string | number>[]) {
  document.getElementById("report-print-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "report-print-frame";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const w = frame.contentWindow;
  if (!w) return false;
  const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const head = rows.length ? Object.keys(rows[0]) : [];
  const isNum = (h: string) => rows.every((r) => typeof r[h] === "number");
  const fmtCell = (v: string | number) => (typeof v === "number" ? v.toLocaleString("en-IN") : esc(v));
  const printed = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font: 11px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; margin: 0; padding: 16px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 12px; }
  h1 { font-size: 17px; margin: 0; color: #1e3a8a; }
  .sub { color: #475569; margin-top: 2px; }
  .meta { color: #64748b; text-align: right; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; color: #334155; text-align: left; font-weight: 600; padding: 5px 6px; border-bottom: 1px solid #cbd5e1; white-space: nowrap; }
  td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .n { text-align: right; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #fafbfc; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  footer { margin-top: 10px; color: #94a3b8; font-size: 10px; }
</style></head><body>
<header><div><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div></div>
<div class="meta">Apeejay Admissions Dashboard<br>Printed ${esc(printed)} · ${rows.length.toLocaleString("en-IN")} rows</div></header>
${rows.length ? `<table><thead><tr>${head.map((h) => `<th class="${isNum(h) ? "n" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
<tbody>${rows.map((r) => `<tr>${head.map((h) => `<td class="${isNum(h) ? "n" : ""}">${fmtCell(r[h] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "<p>No rows for the current filters.</p>"}
<footer>Demo data · read-only integration with LeadSquared, SaaS and FABS.</footer>
</body></html>`);
  w.document.close();
  // Give the frame a moment to lay out, then print just the frame.
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* printing unavailable */
    }
  }, 150);
  return true;
}
