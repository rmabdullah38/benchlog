import { useState } from "react";
import { ArrowUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Stream } from "../useBenchStore";
import { AiBadge } from "./AiBadge";
import { Markdown } from "./Markdown";

export function AskPanel({ answer, onAsk, onCite }: { answer: Stream | null; onAsk: (q: string, onDeviceOnly: boolean) => void; onCite?: (seq: number) => void }) {
  const [q, setQ] = useState("How has the offset changed this week?");
  const [local, setLocal] = useState(false);
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) onAsk(q, local); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this notebook…" aria-label="Question"
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:border-ring" />
        <Button size="icon" type="submit" aria-label="Ask" disabled={answer?.streaming}><ArrowUp className="size-4" /></Button>
      </form>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Switch checked={local} onCheckedChange={setLocal} />
        <Lock className="size-3" />On-device only (includes private entries)
      </label>
      {answer && (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center gap-2">
            {answer.source && <AiBadge source={answer.source} ms={answer.ms} />}
            <span className="truncate font-mono text-[11px] text-muted-foreground">{answer.reason}</span>
          </div>
          <Markdown text={answer.text} streaming={answer.streaming} onCite={onCite} />
        </div>
      )}
    </div>
  );
}
