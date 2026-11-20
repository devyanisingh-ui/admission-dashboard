"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { useApp } from "@/lib/context";
import { downloadCsv, printPdf } from "@/lib/export";
import { Button } from "./ui";

export function ExportButtons({ name, rows }: { name: string; rows: () => Record<string, string | number>[] }) {
  const { can } = useApp();
  if (!can("export")) return null;
  return (
    <>
      <Button size="sm" onClick={printPdf}>
        <FileText size={14} /> PDF
      </Button>
      <Button size="sm" onClick={() => downloadCsv(name, rows())}>
        <FileSpreadsheet size={14} /> Excel
      </Button>
    </>
  );
}
