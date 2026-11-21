// Deterministic number+unit scanner. Runs alongside the language model:
//  - recovers measurements the model missed (marked origin "auto")
//  - flags model numbers that never appear in the note (marked unverified)
//  - normalizes units ("kohm" -> "kΩ", "uV" -> "µV") and moves qualifiers ("rms", "pk-pk")
//    out of the unit and into the name, so drift checks compare like with like.
import type { Measurement } from "./types";

const PREFIX: Record<string, number> = { p: 1e-12, n: 1e-9, "µ": 1e-6, m: 1e-3, "": 1, k: 1e3, M: 1e6, G: 1e9 };
// Units that are compared as-is (no SI prefix math).
const FIXED = ["mV/pH", "mV/s", "V/s", "mL/min", "µL/min", "L/min", "bpm", "%", "°C", "°F", "K", "deg", "°", "dB", "dBm", "mM", "µM", "nM", "rpm", "ppm", "psi", "kPa", "Pa", "mmHg", "cycles"];
// Qualifiers only count as separate words ("12 ps rms"), never inside a unit ("mL/min").
const QUALIFIERS = /(?:^|\s)(rms|pk-pk|p-p|pp|peak|avg|mean|max|min|typ)(?=\s|$)/i;

export function normalizeUnit(raw: string): { unit: string; qualifier: string } {
  let u = (raw || "").trim();
  let qualifier = "";
  const q = u.match(QUALIFIERS);
  if (q) {
    qualifier = q[1].toLowerCase();
    u = u.replace(QUALIFIERS, "").trim();
  }
  u = u
    .replace(/^(k|M|m|G)?ohms?$/i, (_, p) => `${p ?? ""}Ω`)
    .replace(/^u(?=[A-Za-zΩ])/, "µ")
    .replace(/^deg(rees)?\s*C$/i, "°C")
    .replace(/^C$/, "°C")
    .replace(/^degrees?$/i, "deg")
    .replace(/^(k|M|G)?hz$/i, (_, p) => `${p ?? ""}Hz`)
    .replace(/^sec(s|onds?)?$/i, "s");
  // A bare SI prefix ("4.7k" on a resistor) is most likely ohms; keep it as written.
  return { unit: u, qualifier };
}

/** Value in base SI units when the unit is a prefixed base unit, else null (compare raw). */
export function toSI(value: number, unit: string): number | null {
  const { unit: u } = normalizeUnit(unit);
  if (FIXED.includes(u)) return null;
  const m = u.match(/^(p|n|µ|m|k|M|G)?(V|A|Ω|Hz|s|F|W|g|L)$/);
  if (!m) return null;
  return value * PREFIX[m[1] ?? ""];
}

const UNIT_RE =
  "(?:mV\\/pH|mV\\/s|V\\/s|[µu]?L\\/min|mL\\/min|bpm|rpm|ppm|psi|kPa|mmHg|dBm|dB|°C|°F|deg|%|" +
  "[pnuµmkMG]?(?:V|A|Hz|hz|Ω|ohms?|s|F|W|g|L)|[kKM]?ohms?|[mµun]M|C)";
// number, optional space, unit, then a boundary (so "3V3" and "clk_200" don't match)
const SCAN = new RegExp(
  `(?<![\\w.])([-+−]?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?)\\s?(${UNIT_RE})(?![A-Za-z0-9])`,
  "g",
);

const STOP = new Set(["at", "of", "is", "was", "to", "the", "a", "an", "and", "on", "in", "with", "about", "around", "~", "=", "@", "reads", "measured", "settled", "now", "today", "before"]);

export function scan(note: string): Measurement[] {
  const out: Measurement[] = [];
  for (const m of note.matchAll(SCAN)) {
    const value = Number(m[1].replace("−", "-"));
    if (!Number.isFinite(value)) continue;
    const pre = note.slice(Math.max(0, m.index! - 24), m.index).toLowerCase();
    const post = note.slice(m.index! + m[0].length, m.index! + m[0].length + 12).toLowerCase();
    // Spec limits and targets aren't measurements ("spec is <1 nA", "should be 4.7k").
    if (/[<>≤≥]\s*$|spec(?:\s+is)?\s*$|should be[^,;]*$|target\s*$|limit\s*$/.test(pre)) continue;
    // A number+unit naming a thing ("5V rail", "3.3 V supply") isn't a reading.
    if (/^\s*(rail|supply|bus|line|domain|input|output|range|part|version)\b/.test(post)) continue;
    const { unit } = normalizeUnit(m[2]);
    const clause = note.slice(0, m.index).split(/[,;:()]|\.\s/).pop() ?? "";
    const before = clause.split(/\s+/).filter(Boolean);
    const words: string[] = [];
    for (let i = before.length - 1; i >= 0 && words.length < 2; i--) {
      const w = before[i].replace(/[^\w/.-]/g, "");
      if (!w || STOP.has(w.toLowerCase()) || /^[-+]?\d/.test(w) || new RegExp(`^${UNIT_RE}$`).test(w)) {
        if (words.length) break;
        continue;
      }
      words.unshift(w);
    }
    out.push({ name: words.join(" ") || "value", value, unit });
  }
  return out;
}

function same(a: Measurement, b: Measurement) {
  const sa = toSI(a.value, a.unit);
  const sb = toSI(b.value, b.unit);
  if (sa !== null && sb !== null) return Math.abs(sa - sb) <= Math.abs(sb) * 0.005 + 1e-18;
  return Math.abs(a.value - b.value) <= Math.abs(b.value) * 0.005 + 1e-12;
}

function appearsIn(note: string, m: Measurement, scanned: Measurement[]) {
  if (scanned.some((s) => same(m, s))) return true;
  const text = note.replace(/−/g, "-");
  const forms = [String(m.value), String(Math.abs(m.value)), m.value.toPrecision(3), m.value.toExponential(1)];
  return forms.some((f) => text.includes(f.replace(/\.?0+(e|$)/, "$1")));
}

/** Cleans model measurements and merges in anything the scanner found that the model missed. */
export function reconcile(note: string, model: Measurement[]): Measurement[] {
  const scanned = scan(note);
  const cleaned = model.map((m) => {
    const { unit, qualifier } = normalizeUnit(m.unit);
    const name = qualifier && !m.name.toLowerCase().includes(qualifier) ? `${m.name} (${qualifier})` : m.name;
    const out: Measurement = { ...m, name, unit };
    if (!appearsIn(note, out, scanned)) out.unverified = true;
    return out;
  });
  for (const s of scanned) {
    if (!cleaned.some((c) => same(c, s))) cleaned.push({ ...s, origin: "auto" });
  }
  return cleaned;
}
