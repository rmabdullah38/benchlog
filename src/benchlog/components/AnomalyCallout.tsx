import { cn } from "@/lib/utils";
import type { Anomaly } from "../types";

export function AnomalyCallout({ anomaly: a }: { anomaly: Anomaly }) {
  const label = a.origin === "stats" ? "Drift" : a.origin === "spec" ? "Out of spec" : a.severity === "high" ? "High" : a.severity === "medium" ? "Check" : "Note";
  const red = a.severity === "high" || a.origin === "spec";
  const amber = !red && (a.severity === "medium" || a.origin === "stats");
  return (
    <p className="flex items-start gap-2 text-sm">
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", red ? "bg-danger" : amber ? "bg-warn" : "bg-muted-foreground")} aria-hidden />
      <span><span className={cn("font-medium", red ? "text-danger" : amber ? "text-warn" : "text-muted-foreground")}>{label}:</span> {a.description}</span>
    </p>
  );
}
