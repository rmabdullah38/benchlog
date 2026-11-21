import { useState } from "react";
import { ArrowRight, CloudOff, Lock, RotateCw, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtDate, type Spec } from "../lib";
import type { Entry, Measurement } from "../types";
import { AiBadge } from "./AiBadge";
import { AnomalyCallout } from "./AnomalyCallout";
import { AddMeasurementChip, MeasurementChip } from "./MeasurementChip";

interface Props {
  entry: Entry;
  specs?: Spec[] | undefined;
  highlighted?: boolean;
  onDelete?: ((id: string) => void) | undefined;
  onRetry?: ((id: string) => void) | undefined;
  onEditMeasurement?: ((id: string, index: number, m: Measurement | null) => void) | undefined;
}

function outOfSpec(m: Measurement, specs: Spec[] = []) {
  const s = specs.find((x) => x.name.toLowerCase() === m.name.toLowerCase() && x.unit === m.unit);
  return !!s && ((s.min !== undefined && m.value < s.min) || (s.max !== undefined && m.value > s.max));
}

export function EntryCard({ entry: e, specs, highlighted, onDelete, onRetry, onEditMeasurement }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [raw, setRaw] = useState(false);
  const s = e.structured;
  const done = s && e.status === "done";
  return (
    <article id={`entry-${e.seq}`}
      className={cn("group scroll-mt-24 rounded-lg border bg-card px-5 py-4 shadow-card transition-shadow",
        highlighted && "ring-2 ring-ring", e.status === "error" && "border-danger/40")}>
      <header className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-muted-foreground">#{e.seq}</span>
        <h3 className="min-w-0 flex-1 truncate font-medium">{s?.title ?? <span className="font-normal text-muted-foreground">{e.raw}</span>}</h3>
        {e.private && <Lock className="size-3.5 self-center text-muted-foreground" aria-label="Private: on this device only" />}
        {e.pendingSync && <CloudOff className="size-3.5 self-center text-warn" aria-label="Not synced yet" />}
        <time className="shrink-0 font-mono text-[11px] text-muted-foreground">{fmtDate(e.createdAt)}</time>
      </header>

      {e.status === "queued" && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" />{e.routeReason === "Waiting for on-device model" ? "Waiting for on-device model" : "Waiting for connection"}
        </p>
      )}
      {e.status === "processing" && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <p className="text-xs text-device">Structuring {e.source === "in_cloud" ? "in the cloud" : "on-device"}…</p>
          <div className="shimmer h-3 w-3/4 rounded" /><div className="shimmer h-3 w-1/2 rounded" />
        </div>
      )}
      {e.status === "error" && (
        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <span className="text-danger">{e.error ?? "Couldn't structure this note."}</span>
          <Button size="sm" variant="outline" onClick={() => onRetry?.(e.id)}><RotateCw className="size-3.5" />Retry</Button>
        </div>
      )}

      {done && (
        <div className="mt-2 space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            {s.measurements.map((m, i) => (
              <MeasurementChip key={`${m.name}${i}`} measurement={m} outOfSpec={outOfSpec(m, specs)} onChange={(n) => onEditMeasurement?.(e.id, i, n)} />
            ))}
            <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <AddMeasurementChip onAdd={(m) => onEditMeasurement?.(e.id, s.measurements.length, m)} />
            </span>
          </div>
          {s.anomalies.length > 0 && <div className="space-y-1">{s.anomalies.map((a, i) => <AnomalyCallout key={i} anomaly={a} />)}</div>}
          {s.followUps[0] && (
            <p className="flex gap-1.5 text-sm"><ArrowRight className="mt-0.5 size-3.5 shrink-0" />{s.followUps[0]}</p>
          )}
        </div>
      )}

      {raw && (
        <div className="mt-3 flex gap-3 rounded bg-muted p-3">
          <pre className="flex-1 font-mono text-xs whitespace-pre-wrap">{e.raw}</pre>
          {e.photo && <img src={e.photo} alt="Attached bench photo" className="h-20 rounded border" />}
        </div>
      )}

      {(done || e.status === "error") && (
        <footer className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          {e.source && done && <AiBadge source={e.source} ms={e.latencyMs} reason={e.routeReason} />}
          <button type="button" onClick={() => setRaw((r) => !r)} className="hover:text-foreground">{raw ? "Hide note" : "Original note"}</button>
          <div className="ml-auto">
            {confirm ? (
              <span className="inline-flex items-center gap-1">
                Delete?
                <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => onDelete?.(e.id)}>Delete</Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirm(false)}>Cancel</Button>
              </span>
            ) : (
              <Button size="icon" variant="ghost" className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Delete entry ${e.seq}`} onClick={() => setConfirm(true)}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </footer>
      )}
    </article>
  );
}
