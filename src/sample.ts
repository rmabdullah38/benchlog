// A week of realistic bench notes, pre-structured, so judges can try drift detection,
// Ask and Report right away. Sample entries carry no AI badge because no model produced them.
import type { Entry } from "./types";

export const sampleExperiment = {
  name: "Catheter pH sensor: calibration batch 7",
  goal: "Track IrOx pH electrode sensitivity (target 55–60 mV/pH) and offset across daily recalibration.",
};

type Seed = Omit<Entry, "id" | "seq" | "experimentId" | "pendingSync">;

const day = 864e5;

export function sampleEntries(): Seed[] {
  const now = Date.now();
  const cal = (d: number, slope: number, offset: number, note: string, extra: Partial<Seed["structured"]> = {}): Seed => ({
    raw: note,
    photo: null,
    private: false,
    status: "done",
    source: null,
    routeReason: "Sample data",
    latencyMs: null,
    createdAt: now - d * day,
    structured: {
      title: `Daily 3-point calibration, day ${8 - d}`,
      kind: "measurement",
      summary: `Calibrated electrode #3 in pH 4/7/10 buffers. Slope ${slope} mV/pH, offset ${offset} mV.`,
      setup: "Electrode #3 vs Ag/AgCl, 25 °C bath, Gamry OCP mode",
      measurements: [
        { name: "Sensitivity", value: slope, unit: "mV/pH" },
        { name: "Offset", value: offset, unit: "mV" },
      ],
      anomalies: [],
      tags: ["calibration", "electrode-3"],
      followUps: [],
      ...extra,
    },
  });

  return [
    {
      raw: "Fabbed batch 7: 6 IrOx electrodes electrodeposited, 300 cycles CV. Electrode 3 looks most uniform under scope.",
      photo: null,
      private: false,
      status: "done",
      source: null,
      routeReason: "Sample data",
      latencyMs: null,
      createdAt: now - 7.2 * day,
      structured: {
        title: "Batch 7 IrOx electrodeposition",
        kind: "procedure",
        summary: "Electrodeposited six IrOx electrodes with 300 CV cycles. Electrode #3 had the most uniform film.",
        setup: "IrOx deposition bath, 300 CV cycles",
        measurements: [{ name: "CV cycles", value: 300, unit: "cycles" }],
        anomalies: [],
        tags: ["fabrication", "batch-7"],
        followUps: ["Calibrate electrode #3 daily for a week"],
      },
    },
    cal(7, 57.8, 3.1, "cal day1 e3: slope 57.8 mV/pH offset +3.1mV. looks good"),
    cal(6, 58.1, 3.4, "e3 cal 58.1 mV/pH, +3.4 mV"),
    cal(5, 57.6, 3.9, "day 3 cal e3 slope 57.6, offset 3.9 mV. pH10 buffer bottle almost empty"),
    cal(4, 58.3, 4.2, "e3 58.3 mV/pH offset 4.2. new pH 10 buffer opened (lot 22B)", {
      followUps: ["Note buffer lot change when comparing offsets"],
    }),
    cal(3, 57.9, 4.6, "slope 57.9 offset 4.6 mV — offset creeping up ~0.4 mV/day?", {
      anomalies: [{ description: "Offset rising roughly 0.4 mV per day since day 1.", severity: "low", origin: "model" }],
    }),
    cal(2, 58.0, 5.1, "e3 58.0 mV/pH +5.1 mV. stored dry overnight by mistake", {
      anomalies: [{ description: "Electrode stored dry overnight, which can shift IrOx response.", severity: "medium", origin: "model" }],
      followUps: ["Re-hydrate 1 h before next calibration"],
    }),
  ];
}
