// Deterministic drift check: compares each new measurement with earlier readings of the
// same quantity (same name and unit) in the same experiment. Runs locally, no model needed.
import type { Anomaly, Entry, Measurement } from "../benchlog/types";

const key = (m: Measurement) =>
  `${m.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${m.unit.trim()}`;

export function driftAnomalies(
  measurements: Measurement[],
  history: Entry[],
  zThreshold: number,
): Anomaly[] {
  const out: Anomaly[] = [];
  for (const m of measurements) {
    const k = key(m);
    const prior = history
      .flatMap((e) => e.structured?.measurements ?? [])
      .filter((p) => key(p) === k)
      .map((p) => p.value);
    if (prior.length < 4) continue;
    const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
    const sd = Math.sqrt(prior.reduce((a, b) => a + (b - mean) ** 2, 0) / (prior.length - 1));
    const scale = sd > 0 ? sd : Math.abs(mean) * 0.01 || 1;
    const z = (m.value - mean) / scale;
    if (Math.abs(z) >= zThreshold) {
      out.push({
        origin: "stats",
        severity: Math.abs(z) >= zThreshold * 2 ? "high" : "medium",
        description:
          `${m.name} = ${fmt(m.value)} ${m.unit} is ${Math.abs(z).toFixed(1)}σ ` +
          `${z > 0 ? "above" : "below"} its mean of ${fmt(mean)} ${m.unit} over ${prior.length} earlier readings.`,
      });
    }
  }
  return out;
}

function fmt(x: number) {
  return Math.abs(x) >= 1000 || Math.abs(x) < 0.01 ? x.toExponential(2) : +x.toPrecision(4) + "";
}

/** Series for sparklines: measurement key -> values over time. */
export function series(entries: Entry[]): Map<string, { name: string; unit: string; values: number[] }> {
  const map = new Map<string, { name: string; unit: string; values: number[] }>();
  for (const e of entries) {
    for (const m of e.structured?.measurements ?? []) {
      const k = key(m);
      if (!map.has(k)) map.set(k, { name: m.name, unit: m.unit, values: [] });
      map.get(k)!.values.push(m.value);
    }
  }
  return map;
}
