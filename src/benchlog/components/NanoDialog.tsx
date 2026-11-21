import { Cloud, Lock, WifiOff, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { NanoState } from "../types";

export function NanoDialog({ open, onOpenChange, nano, onDownload }: { open: boolean; onOpenChange: (o: boolean) => void; nano: NanoState; onDownload: () => void }) {
  const rows = [
    { Icon: Zap, cls: "text-device", t: "Short notes run on-device", d: "Structuring a bench note takes a few seconds, costs nothing, and needs no connection." },
    { Icon: Lock, cls: "text-device", t: "Private entries never leave", d: "Anything marked “Keep on this device” is only processed locally." },
    { Icon: WifiOff, cls: "text-warn", t: "Works offline", d: "No wifi at the bench? Notes are still structured, then sync when you're back." },
    { Icon: Cloud, cls: "text-cloud", t: "Big jobs go to the cloud", d: "Weekly reports and whole-notebook questions need a longer context." },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="size-4 text-device" />On-device model</DialogTitle>
          <DialogDescription>Gemini Nano is a small AI model built into Chrome. It runs on this laptop, not on a server.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.t} className="flex gap-3"><r.Icon className={`mt-0.5 size-4 shrink-0 ${r.cls}`} /><div><p className="text-sm font-medium">{r.t}</p><p className="text-xs text-muted-foreground">{r.d}</p></div></li>
          ))}
        </ul>
        <div className="rounded-md border bg-muted p-3">
          {nano.state === "ready" && <p className="flex items-center gap-2 text-sm text-device"><Zap className="size-4" />Ready. Gemini Nano is installed.</p>}
          {nano.state === "downloading" && (
            <div className="space-y-2"><div className="flex justify-between text-sm"><span>Downloading Gemini Nano</span><span className="font-mono">{nano.progress}%</span></div><Progress value={nano.progress} /></div>
          )}
          {nano.state === "available" && <div className="flex items-center justify-between gap-3"><span className="text-sm">A few GB, one-time download. Needs ~22 GB free disk.</span><Button size="sm" onClick={onDownload}>Download</Button></div>}
          {nano.state === "unavailable" && <p className="text-sm text-cloud">This browser can't run Gemini Nano. Everything runs in the cloud; private entries wait until it's available.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
