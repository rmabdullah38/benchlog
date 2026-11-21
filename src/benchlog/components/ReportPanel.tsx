import { Copy, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Stream } from "../useBenchStore";
import { AiBadge } from "./AiBadge";
import { Markdown } from "./Markdown";

export function ReportPanel({ report, onWriteReport, onCite }: { report: Stream | null; onWriteReport: () => void; onCite?: (seq: number) => void }) {
  const download = () => {
    if (!report) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([report.text], { type: "text/markdown" }));
    a.download = "benchlog-weekly-report.md"; a.click();
  };
  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={onWriteReport} disabled={report?.streaming}><FileText className="size-4" />Write weekly report</Button>
      {report && (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-3 flex items-center gap-2">
            {report.source && <AiBadge source={report.source} ms={report.ms} />}
            <span className="truncate font-mono text-[11px] text-muted-foreground">{report.reason}</span>
            <div className="ml-auto flex gap-1">
              <Button size="icon" variant="ghost" className="size-7" aria-label="Copy report" disabled={report.streaming}
                onClick={() => { void navigator.clipboard.writeText(report.text); toast("Report copied"); }}><Copy className="size-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={report.streaming} onClick={download}><Download className="size-3.5" />.md</Button>
            </div>
          </div>
          <Markdown text={report.text} streaming={report.streaming} onCite={onCite} />
        </div>
      )}
    </div>
  );
}
