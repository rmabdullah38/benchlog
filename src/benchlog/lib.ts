import type { Entry, Measurement } from "./types";

export { parseSpecs, checkSpecs, type Spec } from "../core/specs";
import type { Spec } from "../core/specs";

export function specLabel(s: Spec) {
  if (s.min !== undefined && s.max !== undefined) return `${s.min}–${s.max} ${s.unit}`;
  if (s.max !== undefined) return `< ${s.max} ${s.unit}`;
  return `> ${s.min} ${s.unit}`;
}

export function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtDate(ts: number) {
  const d = new Date(ts);
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  return `${mon} ${d.getDate()} · ${fmtTime(ts)}`;
}

export interface Series { name: string; unit: string; points: { seq: number; value: number; at: number }[] }
export function seriesFrom(entries: Entry[]): Series[] {
  const map = new Map<string, Series>();
  [...entries].sort((a, b) => a.createdAt - b.createdAt).forEach((e) =>
    e.structured?.measurements.forEach((m: Measurement) => {
      const k = `${m.name.trim().toLowerCase()}|${m.unit}`;
      if (!map.has(k)) map.set(k, { name: m.name, unit: m.unit, points: [] });
      map.get(k)!.points.push({ seq: e.seq, value: m.value, at: e.createdAt });
    }),
  );
  return [...map.values()].filter((s) => s.points.length >= 2);
}

export function toCsv(entries: Entry[]) {
  const rows = ["seq,timestamp,name,value,unit"];
  entries.forEach((e) => e.structured?.measurements.forEach((m) =>
    rows.push([e.seq, new Date(e.createdAt).toISOString(), JSON.stringify(m.name), m.value, JSON.stringify(m.unit)].join(","))));
  return rows.join("\n");
}
