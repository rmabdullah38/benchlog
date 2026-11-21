# BenchLog

**The lab notebook that works where the wifi doesn't.**

BenchLog is an offline-first lab notebook for engineers and scientists who work at the bench: hardware labs, biomedical wet labs, cleanrooms and hospital basements where the connection drops out. You type a quick note (or snap a photo of a multimeter or scope), and **Gemini Nano runs on your laptop** to turn it into a structured notebook entry with measurements, units, anomaly flags and follow-ups. This works even with no internet. When you're back online, entries sync to Firestore and **Gemini in the cloud** handles the long-context work: weekly reports for your PI and questions that need your whole notebook.

Live demo: **https://benchlog-e9484.web.app** (Chrome on desktop for on-device AI; any browser works in cloud mode)

Built for [#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/), Web/Chrome category.

## Why hybrid matters here

| Job | Where it runs | Why |
|---|---|---|
| Structure a bench note into JSON (measurements, units, anomalies) | **On-device first** (`PREFER_ON_DEVICE`) | Instant, free, and works in a basement with no signal |
| Read a value from a photo of an instrument | On-device first, cloud fallback | Same, plus cloud handles devices without multimodal Nano |
| **Private entries** (unpublished data, anything patient-adjacent) | **On-device only** (`ONLY_ON_DEVICE`) | The text and photo never leave the laptop. If Nano isn't ready, the entry waits rather than going to the cloud |
| Ask a question about recent work | On-device first | Quick lookups don't need a datacenter |
| Ask across the whole notebook / long inputs | **Cloud** (`PREFER_IN_CLOUD`) | On-device context is small; Gemini in the cloud reads everything |
| Weekly report | **Cloud** (`PREFER_IN_CLOUD`), on-device draft when offline | Long-context synthesis |

A small router (`src/ai.ts`) chooses the `InferenceMode` per call based on task, input length, connectivity and the privacy flag. It records **why** each call ran where it did. Every result shows an ⚡ On-device or ☁ Cloud badge using `response.inferenceSource`, and the *AI activity* tab logs every routing decision.

## Features

- **Capture anything, structure it automatically.** Free-form notes become entries with title, kind, setup, measurements (`name`, `value`, `unit`), anomalies, tags and follow-ups. The same JSON schema is used on-device (`responseConstraint`) and in the cloud (`responseSchema`).
- **Photo readings.** Attach a photo of a meter or scope; the model reads the displayed value.
- **Drift detection.** A deterministic check compares each new measurement with earlier readings of the same quantity in the experiment and flags anything beyond a z-score threshold, e.g. *"Sensitivity = 51.2 mV/pH is 27σ below its mean of 57.95 mV/pH over 6 earlier readings."* No model needed, so it also works offline.
- **Offline-first.** Firestore's persistent local cache stores every entry in IndexedDB. A service worker caches the app shell, so BenchLog opens with no connection at all. A queue structures entries as soon as *any* allowed model is reachable.
- **Private mode.** A per-entry 🔒 toggle keeps processing on-device. Private entries are filtered out of every cloud prompt (Ask and Report).
- **Ask your notebook.** Streaming answers that cite entries by `[#n]`.
- **Weekly report.** A streaming Markdown report you can download.
- **Trends.** Sparklines for every quantity you've measured more than once.
- **Tunable without redeploying.** Remote Config holds the cloud model names, the on-device length limit, the offline context size and the drift threshold.

## Firebase products used

- **Firebase AI Logic** with hybrid inference: `getGenerativeModel(ai, { mode, onDeviceParams, inCloudParams })`, `generateContent` and `generateContentStream`, structured output on both sides, `inferenceSource`
- **App Check** with the reCAPTCHA Enterprise provider (required by AI Logic)
- **Cloud Firestore** with `persistentLocalCache` for offline writes and sync
- **Authentication**: anonymous by default, upgradeable to Google (`linkWithPopup`) to keep your notebook across devices
- **Remote Config** for routing and model parameters
- **Firebase Hosting** with a PWA service worker

## Code map

```
src/ai.ts        Hybrid router, model configs, prompts, schema, streaming
src/firebase.ts  App, App Check, Auth, Firestore (offline cache), Remote Config, AI
src/anomaly.ts   Deterministic drift detection and trend series
src/store.ts     Firestore reads/writes (non-blocking so they work offline)
src/main.ts      UI, processing queue, status pills, panels
src/sample.ts    A week of sample calibration data for first-time users
```

## Run it yourself

Prerequisites: Node 20+, a Firebase project, and Chrome on desktop if you want on-device inference.

1. **Create a Firebase project** and register a web app.
2. In **AI Logic**, choose the Gemini Developer API (no-cost tier).
3. In **App Check**, register the web app with a reCAPTCHA Enterprise site key. For local development, set `VITE_APPCHECK_DEBUG=true` and register the debug token printed in the browser console under *App Check › Manage debug tokens*.
4. Enable **Firestore** (production mode) and **Authentication** (Anonymous and Google).
5. Configure and run:
   ```bash
   cp .env.example .env   # fill in your web app config and site key
   npm install
   npm run dev
   ```
6. Deploy hosting, Firestore rules and the Remote Config template:
   ```bash
   npx firebase-tools deploy --only hosting,firestore,remoteconfig
   ```

### Enabling Gemini Nano in Chrome

On-device inference uses Chrome's built-in Prompt API. Use a recent desktop Chrome on a machine that meets Chrome's hardware requirements for Gemini Nano. The first time, click **⬇ Get on-device model** in BenchLog's header to start the download (it can take a few minutes). Once the pill reads **⚡ Gemini Nano ready**, turn off wifi and keep logging.

If Nano isn't available, BenchLog still works fully in cloud mode, and private entries wait until a device with Nano processes them.

## Try this

1. Click **Load sample experiment** (a week of pH-sensor calibrations).
2. Log: `Slope today 51.2 mV/pH, offset +9 mV. Electrode looked discolored.` You'll get a structured entry with a **Drift** flag computed against the previous six readings.
3. Turn off wifi. Log another note. It's structured on-device (⚡ badge) and marked *not synced*.
4. Turn wifi back on. It syncs. Open **Report** and generate a weekly report in the cloud.

## License

Apache 2.0. See [LICENSE](LICENSE).
