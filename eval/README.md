# Accuracy eval

`cases.json` holds 14 labeled bench notes (pH calibration, power rails, CV sweeps, impedance,
PPG/PTT, FPGA timing, typos, negative numbers, scientific notation, notes with no numbers).
Each case lists the measurements a correct entry must contain and whether it should be
flagged as an anomaly.

How to run: open `https://benchlog-e9484.web.app/?debug=1` in Chrome with Gemini Nano
available. The page exposes `__benchlog.structure(note, mode)`, which runs the real
structuring path (Firebase AI Logic with `InferenceMode.ONLY_ON_DEVICE` or
`ONLY_IN_CLOUD`) plus the deterministic scanner. Run every case through it and score:
- recall: expected measurements found (values compared after SI conversion, ±1%)
- precision: found measurements that were expected
- anomaly accuracy: flagged / not flagged as labeled

## Results (Nov 21, 2026, Gemini Nano in Chrome 157 on an M-series Mac)

| Version | Recall | Precision | Anomaly flags |
|---|---|---|---|
| v1 prompt, model only | 0.88 | 0.92 | 12/14 |
| v1 prompt + scanner | 1.00 | 0.86 | 12/14 |
| v2 prompt (conditions, unit rules, example), model only | 1.00 | 0.83 | 13/14 |

"Extra" measurements are mostly real numbers the labels didn't require (the 1 kHz test
frequency, the "previous" noise value). The scanner also flags any model number that
doesn't appear in the note (⚠ in the UI); in v2 it caught one value copied from the
prompt's example, which led to the example-value filter.
