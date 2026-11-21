// Per-experiment spec limits, written the way engineers write them:
//   "Slope 55-60 mV/pH; Offset < 10 mV; Leakage <= 1 nA; Temp 36.5 to 37.5 °C"
// Any measurement outside its spec becomes a deterministic anomaly (no model involved).
import { normalizeUnit, toSI } from "./extract";
import type { Anomaly, Measurement } from "./types";

export interface Spec {
  name: string;
  min?: number;
  max?: number;
  unit: string;
  text: string;
}

const NUM = "[-+]?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?";

export function parseSpecs(text: string | undefined): Spec[] {
  if (!text) return [];
  const out: Spec[] = [];
  for (const raw of text.split(/[;\n]+/)) {
    const s = raw.trim();
    if (!s) continue;
    let m = s.match(new RegExp(`^(.+?)\\s+(${NUM})\\s*(?:-|–|to|\\.\\.)\\s*(${NUM})\\s*(.*)$`, "i"));
    if (m) {
      out.push({ name: m[1].trim(), min: +m[2], max: +m[3], unit: normalizeUnit(m[4]).unit, text: s });
      continue;
    }
    m = s.match(new RegExp(`^(.+?)\\s*(<=|≤|<|>=|≥|>)\\s*(${NUM})\\s*(.*)$`));
    if (m) {
      const upper = /</.test(m[2]) || m[2] === "≤";
      out.push({
        name: m[1].trim(),
        ...(upper ? { max: +m[3] } : { min: +m[3] }),
        unit: normalizeUnit(m[4]).unit,
        text: s,
      });
    }
  }
  return out;
}

/** Value of `m` expressed in the spec's unit, or null if the units aren't comparable. */
function inSpecUnit(m: Measurement, spec: Spec): number | null {
  if (!spec.unit || normalizeUnit(m.unit).unit === spec.unit) return m.value;
  const a = toSI(m.value, m.unit);
  const one = toSI(1, spec.unit);
  return a !== null && one !== null ? a / one : null;
}

export function checkSpecs(measurements: Measurement[], specs: Spec[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (const spec of specs) {
    const key = spec.name.toLowerCase();
    for (const m of measurements) {
      if (!m.name.toLowerCase().includes(key)) continue;
      const v = inSpecUnit(m, spec);
      if (v === null) continue;
      const low = spec.min !== undefined && v < spec.min;
      const high = spec.max !== undefined && v > spec.max;
      if (low || high) {
        out.push({
          origin: "spec",
          severity: "high",
          description: `${m.name} = ${m.value} ${m.unit} is ${high ? "above" : "below"} spec (${spec.text}).`,
        });
      }
    }
  }
  return out;
}
