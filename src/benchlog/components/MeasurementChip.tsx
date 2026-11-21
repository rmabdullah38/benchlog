import { useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Measurement } from "../types";

interface Props { measurement: Measurement; outOfSpec?: boolean; onChange?: (m: Measurement | null) => void }

function parse(text: string, fallback?: Measurement): Measurement | null {
  const m = text.trim().match(/^(.+?)\s+(-?[\d.]+)\s*(.*)$/);
  if (!m) return null;
  return { name: m[1]!, value: +m[2]!, unit: m[3]!.trim(), origin: fallback?.origin ?? "model" };
}

export function MeasurementChip({ measurement: m, outOfSpec, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing) {
    return (
      <input
        autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter") { const n = draft.trim() ? parse(draft, m) : null; if (n || !draft.trim()) onChange?.(n); setEditing(false); }
        }}
        aria-label="Edit measurement: name value unit"
        className="h-7 w-48 rounded border border-ring bg-background px-2 font-mono text-xs outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => { setDraft(`${m.name} ${m.value} ${m.unit}`); setEditing(true); }}
      title={m.unverified ? "Not found in the original note" : m.origin === "auto" ? "Detected by rule-based scanner" : "Click to edit"}
      className={cn(
        "group inline-flex h-7 items-center gap-1.5 rounded border px-2 font-mono text-xs transition-colors hover:border-ring",
        m.unverified ? "border-warn/50 bg-warn-soft text-warn"
          : outOfSpec ? "border-danger/50 bg-danger-soft text-danger"
          : m.origin === "auto" ? "border-dashed border-muted-foreground/50 bg-transparent"
          : "border-border bg-secondary",
      )}
    >
      {m.unverified && <TriangleAlert className="size-3" aria-label="unverified" />}
      <span className={cn("font-sans", !m.unverified && !outOfSpec && "text-muted-foreground")}>{m.name}</span>
      <span className="font-medium">{m.value}</span>
      <span className="opacity-70">{m.unit}</span>
    </button>
  );
}

export function AddMeasurementChip({ onAdd }: { onAdd?: (m: Measurement) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing)
    return (
      <input autoFocus placeholder="Name 1.23 unit" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); if (e.key === "Enter") { const n = parse(draft); if (n) onAdd?.(n); setDraft(""); setEditing(false); } }}
        aria-label="New measurement" className="h-7 w-40 rounded border border-ring bg-background px-2 font-mono text-xs outline-none" />
    );
  return (
    <button type="button" onClick={() => setEditing(true)} aria-label="Add measurement"
      className="inline-flex size-7 items-center justify-center rounded border border-dashed text-muted-foreground hover:border-ring hover:text-foreground">
      <Plus className="size-3.5" />
    </button>
  );
}
