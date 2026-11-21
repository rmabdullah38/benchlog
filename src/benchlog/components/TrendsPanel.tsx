import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { seriesFrom, specLabel, toCsv, type Series, type Spec } from "../lib";
import type { Entry } from "../types";

export function Sparkline({ series, spec }: { series: Series; spec?: Spec }) {
  const W = 240, H = 56, P = 4;
  const vals = series.points.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (spec?.min !== undefined) lo = Math.min(lo, spec.min);
  if (spec?.max !== undefined) hi = Math.max(hi, spec.max);
  const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
  const x = (i: number) => P + (i / Math.max(1, vals.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const out = (v: number) => !!spec && ((spec.min !== undefined && v < spec.min) || (spec.max !== undefined && v > spec.max));
  const bandTop = y(spec?.max ?? hi), bandBot = y(spec?.min ?? lo);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" role="img" aria-label={`${series.name} trend`}>
      {spec && <rect x={0} y={bandTop} width={W} height={bandBot - bandTop} className="fill-device-soft" />}
      <polyline fill="none" strokeWidth={1.5} className="stroke-foreground/70" points={vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      {vals.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={out(v) ? 3.5 : 2} className={out(v) ? "fill-danger" : "fill-foreground"} />)}
    </svg>
  );
}

export function TrendsPanel({ entries, specs }: { entries: Entry[]; specs: Spec[] }) {
  const series = seriesFrom(entries);
  const exportCsv = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(entries)], { type: "text/csv" }));
    a.download = "benchlog-measurements.csv"; a.click();
  };
  return (
    <div className="space-y-2">
      {series.length === 0 && <p className="text-sm text-muted-foreground">Log at least two readings of the same quantity to see a trend.</p>}
      {series.map((s) => {
        const spec = specs.find((x) => x.name.toLowerCase() === s.name.toLowerCase() && x.unit === s.unit);
        const vals = s.points.map((p) => p.value);
        const last = vals.at(-1)!;
        const bad = !!spec && ((spec.min !== undefined && last < spec.min) || (spec.max !== undefined && last > spec.max));
        return (
          <div key={s.name + s.unit} className="rounded-lg border bg-card p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{s.name}</span>
              <span className={cn("font-mono text-sm", bad && "text-danger")}>{last} <span className="text-xs text-muted-foreground">{s.unit}</span></span>
            </div>
            <Sparkline series={s} {...(spec ? { spec } : {})} />
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>min {Math.min(...vals)} · max {Math.max(...vals)}</span>
              <span>{spec ? `spec ${specLabel(spec)} · ` : ""}n={vals.length}</span>
            </div>
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="w-full" onClick={exportCsv}><Download className="size-3.5" />Export CSV</Button>
    </div>
  );
}
