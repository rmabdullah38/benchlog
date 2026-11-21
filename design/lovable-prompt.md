Design the front end for **BenchLog**, an offline-first lab notebook for engineers and scientists working at a lab bench (hardware labs, biomedical wet labs, cleanrooms) where wifi is unreliable. Build **UI only**: React + TypeScript + Tailwind + shadcn/ui, all data from a local `mockData.ts`, **no backend, no Supabase, no auth, no API calls**. I will wire it to my existing Firebase logic myself, so keep components presentational with typed props and callbacks (e.g. `onLogEntry(text, photo, isPrivate)`), and keep all state in one top-level `App` or a single store hook.

## The product in one line
You type a messy bench note ("slope 51.2 mV/pH, offset +9 mV, electrode looked discolored") and AI turns it into a structured entry with measurements, units, anomaly flags and next steps. Short notes run on an **on-device model (Gemini Nano in Chrome)**: free, private, works offline. Big jobs (weekly reports, whole-notebook questions) run in the **cloud**. Showing *where* each AI result ran, and *why*, is a core part of the design, not a footnote.

## Look and feel
- Precise, calm, instrument-grade. Think a modern lab notebook crossed with an oscilloscope UI or Linear, not a chat app. Dense but readable; built for a laptop on a bench.
- Light and dark mode (dark is the default for the demo). Subtle dot-grid "graph paper" background.
- Type: IBM Plex Sans for UI, IBM Plex Mono for every number, unit and ID.
- Color carries meaning: **on-device = green**, **cloud = blue**, **warning/drift = amber**, **out of spec / high severity = red**, private = a lock icon. Keep everything else neutral.
- Clear keyboard focus states, AA contrast, respects reduced motion. Responsive down to a 390 px phone (single column, panels become tabs or a bottom sheet).

## Layout (single page app, three regions)
1. **Top bar**
   - BenchLog logo (flask icon), an **experiment switcher** (dropdown with search plus "New experiment" and "Edit specs")
   - Three **status pills**: connectivity (Online / Offline), on-device model (Gemini Nano ready / Downloading 42% / Get on-device model / Cloud only), sync (Synced / 3 waiting to sync)
   - An account button ("Sign in with Google" or avatar)
2. **Main column: the notebook**
   - **Composer** at the top: a multi-line text area ("What did you just do or see?"), a Photo button (attach a meter or scope photo, with a thumbnail preview), a "Keep on this device" lock toggle, a ⌘↵ hint and a "Log it" button. It should feel as fast as a chat input.
   - **Timeline of entry cards**, newest first. Each card shows:
     - `#8` sequence number, title, kind tag (measurement / observation / procedure / issue / idea), timestamp, lock icon if private, "not synced" if pending
     - an **AI badge**: "⚡ On-device · 820 ms" (green) or "☁ Cloud · 2.1 s" (blue); a tooltip shows the routing reason (e.g. "Short task: on-device first", "Private: stays on this device", "Offline: on-device", "→ cloud fallback")
     - summary sentence and setup line
     - **measurement chips** in mono: `Slope 51.2 mV/pH`. Variants: normal; **auto-detected** (dashed border, small "auto" label, found by a rule-based scanner); **unverified** (amber, ⚠, the number isn't in the original note); a "+" chip to add one. Chips look editable: clicking one turns it into an inline input.
     - **anomaly callouts**, each with a type label: **Drift** ("Slope 51.2 mV/pH is 27.8σ below its mean of 57.95 over 6 readings"), **Spec** ("Offset 12 mV is above spec < 10 mV"), or model severity low / medium / high
     - follow-ups ("→ Re-hydrate electrode 1 h before next calibration"), tags, a collapsible "Raw note" with the original text and photo, and Delete (with a confirm step)
     - States: queued ("Waiting for connection" / "Waiting for on-device model"), processing (a shimmer: "Structuring on-device…"), done, error with a Retry button
   - **Empty state**: a short explanation plus a "Load sample experiment" button
3. **Right side panel** (tabs; collapses on small screens)
   - **Ask**: a question input, an "On-device only (includes private entries)" toggle, a streaming Markdown answer with entry citations like `[#6]` that link to the card, and an AI badge plus routing reason
   - **Report**: a "Write weekly report" button, a streaming Markdown report (Summary / Experiments and results / Anomalies and open issues / Next steps), a badge with the reason (e.g. "Long-context report: cloud", "Cloud error → on-device draft"), and Download .md / Copy buttons
   - **Trends**: one small sparkline card per measured quantity (name, latest value, min/max, reading count), spec band shaded when the experiment has specs, an out-of-spec point in red; plus an "Export CSV" button
   - **AI activity**: a summary bar ("⚡ 12 on-device · ☁ 3 cloud", a split bar) and a log list (time, task: structure / ask / report, badge, latency, reason). This tab is the "proof" of hybrid inference, so make it look great.

## Dialogs and sheets
- **New / edit experiment**: name, goal, and **spec limits** in a mono input with helper text ("Slope 55-60 mV/pH; Offset < 10 mV"); show parsed specs as chips as you type
- **On-device model**: explains what Gemini Nano is, the download progress, and why some things stay local
- **Offline banner**: when offline, a slim amber bar: "Offline. Notes are saved on this device and structured on-device. They'll sync when you're back."

## Mock data to include
One experiment, "Catheter pH sensor: calibration batch 7" (specs: Slope 55-60 mV/pH; Offset < 10 mV), with about 9 entries over a week:
- a fabrication entry
- six daily calibrations (Slope ~57.6–58.3 mV/pH, Offset rising 3.1 → 5.1 mV)
- a bad day (Slope 51.2 mV/pH with Drift and Spec flags, Offset 9 mV, "electrode looked discolored", ⚡ On-device · 8.6 s)
- a private entry (🔒)

Also include one entry in each of the queued, processing and error states, an AI activity log with both green and blue rows, and a short sample report.

## Deliverables
- One route (`/`) plus a `/design` page that shows every component in every state side by side (entry card states, all chip variants, all badges and pills, anomaly types, empty/offline/error states), so I can port them.
- Component files: `TopBar`, `StatusPills`, `ExperimentSwitcher`, `Composer`, `EntryCard`, `MeasurementChip`, `AnomalyCallout`, `AiBadge`, `Timeline`, `SidePanel`, `AskPanel`, `ReportPanel`, `TrendsPanel`, `ActivityPanel`, `ExperimentDialog`, `NanoDialog`, `OfflineBanner`, `EmptyState`.
- `types.ts` with these shapes (keep the names; my backend uses them):

```ts
type Source = "on_device" | "in_cloud";
interface Measurement { name: string; value: number; unit: string; origin?: "model" | "auto"; unverified?: boolean }
interface Anomaly { description: string; severity: "low" | "medium" | "high"; origin?: "model" | "stats" | "spec" }
interface StructuredEntry { title: string; kind: "measurement" | "observation" | "procedure" | "issue" | "idea"; summary: string; setup: string; measurements: Measurement[]; anomalies: Anomaly[]; tags: string[]; followUps: string[] }
interface Entry { id: string; seq: number; experimentId: string | null; raw: string; photo?: string | null; private: boolean; status: "queued" | "processing" | "done" | "error"; structured?: StructuredEntry | null; source?: Source | null; routeReason?: string | null; latencyMs?: number | null; error?: string | null; createdAt: number; pendingSync?: boolean }
interface Experiment { id: string; name: string; goal?: string; specs?: string; createdAt: number }
interface Activity { task: "structure" | "ask" | "report"; source: Source | "failed"; reason: string; ms: number; at: number }
```

Don't add features beyond this list (no chat bubbles, no team or sharing features, no pricing page, no landing page). Polish what's here.
