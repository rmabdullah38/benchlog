// BenchLog's hybrid AI layer, built on Firebase AI Logic.
//
// Each task gets a clear job on each side:
//   - On-device (Gemini Nano in Chrome): structure raw bench notes, read meter photos,
//     answer quick questions. Works offline, free, and private entries never leave the laptop.
//   - Cloud (Gemini): long-context work across the whole notebook: weekly reports and
//     questions that need every run, not just the last few.
// A small router chooses an InferenceMode per call and records why.
import {
  getGenerativeModel,
  InferenceMode,
  Schema,
  ThinkingLevel,
  type GenerativeModel,
  type Part,
} from "firebase/ai";
import { ai, config } from "./firebase";
import type { Entry, Experiment, StructuredEntry } from "./types";

export type Task = "structure" | "ask" | "report";
export type Source = "on_device" | "in_cloud";

export interface RouteDecision {
  mode: InferenceMode;
  reason: string;
}

export interface AIResult<T> {
  value: T;
  source: Source;
  route: RouteDecision;
  ms: number;
}

// ---------------------------------------------------------------------------
// On-device availability (Chrome Prompt API, used under the hood by the SDK)
// ---------------------------------------------------------------------------
type Availability = "available" | "downloadable" | "downloading" | "unavailable" | "unsupported";

interface LanguageModelStatic {
  availability(opts?: unknown): Promise<Exclude<Availability, "unsupported">>;
  create(opts?: unknown): Promise<{ destroy(): void }>;
}

function languageModel(): LanguageModelStatic | undefined {
  return (self as unknown as { LanguageModel?: LanguageModelStatic }).LanguageModel;
}

export async function onDeviceAvailability(withImages = false): Promise<Availability> {
  const LM = languageModel();
  if (!LM) return "unsupported";
  try {
    return await LM.availability({
      expectedInputs: withImages
        ? [{ type: "text", languages: ["en"] }, { type: "image" }]
        : [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
  } catch {
    return "unavailable";
  }
}

/** Starts (or resumes) the Gemini Nano download, reporting progress 0..1. */
export async function downloadOnDeviceModel(onProgress: (p: number) => void) {
  const LM = languageModel();
  if (!LM) throw new Error("This browser has no on-device model (Chrome Prompt API).");
  const session = await LM.create({
    expectedInputs: [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
    monitor(m: { addEventListener: (t: string, cb: (e: { loaded: number }) => void) => void }) {
      m.addEventListener("downloadprogress", (e) => onProgress(e.loaded));
    },
  });
  session.destroy();
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export function route(task: Task, inputChars: number, opts: { private?: boolean } = {}): RouteDecision {
  if (opts.private) {
    return { mode: InferenceMode.ONLY_ON_DEVICE, reason: "Private: stays on this device" };
  }
  if (!navigator.onLine) {
    return { mode: InferenceMode.ONLY_ON_DEVICE, reason: "Offline: on-device" };
  }
  if (task === "report") {
    return { mode: InferenceMode.PREFER_IN_CLOUD, reason: "Long-context report: cloud" };
  }
  if (inputChars > config.onDeviceMaxChars()) {
    return {
      mode: InferenceMode.PREFER_IN_CLOUD,
      reason: `${inputChars.toLocaleString()} chars > on-device limit: cloud`,
    };
  }
  return { mode: InferenceMode.PREFER_ON_DEVICE, reason: "Short task: on-device first" };
}

// A configuration lives for the life of a model instance, so cache one per (task, mode).
const models = new Map<string, GenerativeModel>();

function model(task: Task, mode: InferenceMode, withImage = false, cloudModel?: string): GenerativeModel {
  // Image input gets its own session config so text-only devices still run text on-device.
  const key = `${task}:${mode}:${withImage}:${cloudModel ?? ""}`;
  const cached = models.get(key);
  if (cached) return cached;

  const system = SYSTEM[task];
  const json = task === "structure";
  const m = getGenerativeModel(ai, {
    mode,
    inCloudParams: {
      model: cloudModel ?? (task === "report" ? config.reportModel() : config.cloudModel()),
      systemInstruction: system,
      generationConfig: json
        ? { responseMimeType: "application/json", responseSchema: entrySchema, temperature: 0.2 }
        : task === "report" && !cloudModel
          ? // Reports are summaries, not puzzles: low thinking keeps them fast.
            { temperature: 0.4, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : { temperature: 0.4 },
    },
    onDeviceParams: {
      createOptions: {
        expectedInputs:
          withImage
            ? [{ type: "text", languages: ["en"] }, { type: "image" }]
            : [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        initialPrompts: [{ role: "system", content: [{ type: "text", value: system }] }],
      },
      promptOptions: json ? { responseConstraint: entrySchema } : undefined,
    },
  });
  models.set(key, m);
  return m;
}

function sourceOf(s: string | undefined): Source {
  return s === "on_device" ? "on_device" : "in_cloud";
}

/** Notes when the SDK fell back to the other side, so the UI explains what happened. */
function withFallback(r: RouteDecision, source: Source): RouteDecision {
  if (r.mode === InferenceMode.PREFER_ON_DEVICE && source === "in_cloud") {
    return { ...r, reason: `${r.reason} → cloud fallback (Nano not available)` };
  }
  if (r.mode === InferenceMode.PREFER_IN_CLOUD && source === "on_device") {
    return { ...r, reason: `${r.reason} → on-device fallback (cloud unreachable)` };
  }
  return r;
}

// ---------------------------------------------------------------------------
// Prompts and schema
// ---------------------------------------------------------------------------
const SYSTEM: Record<Task, string> = {
  structure:
    "You turn a lab engineer's raw bench notes into a structured lab-notebook entry. " +
    "Extract only what is stated or shown; never invent numbers. Keep units exactly as written " +
    "(convert 'mV' etc. into the unit field). If a photo of an instrument is attached, read the " +
    "displayed value and unit. Flag anything the note itself calls odd, out of spec, failed, " +
    "noisy, drifting or unexpected as an anomaly. Title: under 8 words.",
  ask:
    "You answer questions about a lab notebook. Use only the entries provided. Cite entries " +
    "by their [#n] tag. If the notes don't contain the answer, say so plainly. Be concise.",
  report:
    "You write a weekly lab report from notebook entries, in Markdown, for a PI or lab manager. " +
    "Sections: Summary (3 bullets), Experiments and results (with key numbers and units), " +
    "Anomalies and open issues, Next steps. Cite entries by their [#n] tag. Do not invent data.",
};

const entrySchema = Schema.object({
  properties: {
    title: Schema.string(),
    kind: Schema.enumString({ enum: ["measurement", "observation", "procedure", "issue", "idea"] }),
    summary: Schema.string(),
    setup: Schema.string(),
    measurements: Schema.array({
      items: Schema.object({
        properties: {
          name: Schema.string(),
          value: Schema.number(),
          unit: Schema.string(),
        },
      }),
    }),
    anomalies: Schema.array({
      items: Schema.object({
        properties: {
          description: Schema.string(),
          severity: Schema.enumString({ enum: ["low", "medium", "high"] }),
        },
      }),
    }),
    tags: Schema.array({ items: Schema.string() }),
    followUps: Schema.array({ items: Schema.string() }),
  },
  optionalProperties: ["setup"],
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export async function structureEntry(
  raw: string,
  image: { mimeType: string; data: string } | null,
  experiment: Experiment | null,
  opts: { private?: boolean },
): Promise<AIResult<StructuredEntry>> {
  const r = route("structure", raw.length, opts);
  const t0 = performance.now();
  const prompt =
    (experiment ? `Experiment: ${experiment.name}. ${experiment.goal ?? ""}\n` : "") +
    `Raw note:\n${raw || "(no text, see attached photo)"}`;
  const parts: Part[] = [{ type: "text", text: prompt }];
  if (image) parts.push({ type: "inlineData", inlineData: { mimeType: image.mimeType, data: image.data } });

  const res = await model("structure", r.mode, !!image).generateContent(parts);
  const value = normalize(JSON.parse(res.response.text()));
  const source = sourceOf(res.response.inferenceSource);
  return { value, source, route: withFallback(r, source), ms: performance.now() - t0 };
}

function normalize(v: Partial<StructuredEntry>): StructuredEntry {
  return {
    title: v.title?.trim() || "Untitled entry",
    kind: v.kind ?? "observation",
    summary: v.summary ?? "",
    setup: v.setup ?? "",
    measurements: (v.measurements ?? []).filter((m) => m && m.name && Number.isFinite(m.value)),
    anomalies: v.anomalies ?? [],
    tags: (v.tags ?? []).map((t) => t.toLowerCase().replace(/^#/, "")).slice(0, 6),
    followUps: v.followUps ?? [],
  };
}

function entryContext(entries: Entry[]): string {
  return entries
    .map((e) => {
      const s = e.structured;
      const when = new Date(e.createdAt).toLocaleString();
      if (!s) return `[#${e.seq}] ${when} (unprocessed): ${e.raw}`;
      const ms = s.measurements.map((m) => `${m.name}=${m.value} ${m.unit}`).join(", ");
      const an = s.anomalies.map((a) => `${a.severity}: ${a.description}`).join("; ");
      return `[#${e.seq}] ${when} ${s.title} (${s.kind}). ${s.summary}` +
        (ms ? ` Measurements: ${ms}.` : "") +
        (an ? ` Anomalies: ${an}.` : "") +
        ` Raw: ${e.raw}`;
    })
    .join("\n");
}

/** Streams an answer. Offline or private, it sees only the most recent entries. */
export async function askNotebook(
  question: string,
  entries: Entry[],
  onChunk: (text: string) => void,
  opts: { private?: boolean },
): Promise<AIResult<string>> {
  // Private entries may only ever be seen by the on-device model.
  const shareable = entries.filter((e) => !e.private);
  let r = route("ask", entryContext(opts.private ? entries : shareable).length + question.length, opts);
  let ctxEntries = r.mode === InferenceMode.ONLY_ON_DEVICE ? entries : shareable;
  if (r.mode === InferenceMode.ONLY_ON_DEVICE || r.mode === InferenceMode.PREFER_ON_DEVICE) {
    const all = ctxEntries.length;
    ctxEntries = ctxEntries.slice(-config.onDeviceContextEntries());
    if (ctxEntries.length < all) {
      r = { ...r, reason: `${r.reason} (last ${ctxEntries.length} of ${all} entries)` };
    }
  }
  return stream("ask", r, `Notebook:\n${entryContext(ctxEntries)}\n\nQuestion: ${question}`, onChunk);
}

export async function writeReport(
  entries: Entry[],
  experiments: Experiment[],
  onChunk: (text: string) => void,
): Promise<AIResult<string>> {
  // Reports may be shared with a PI, so private entries are never included.
  const shared = entries.filter((e) => !e.private);
  const exps = experiments.map((x) => `- ${x.name}: ${x.goal ?? ""}`).join("\n");
  const prompt = (list: Entry[]) => `Experiments:\n${exps}\n\nEntries:\n${entryContext(list)}`;

  // On-device draft: the local context window is small, so summarize recent work only.
  const onDevice = (reason: string) => {
    const n = config.onDeviceContextEntries();
    const recent = shared.slice(-n);
    const why = shared.length > n ? `${reason}: draft from last ${n} entries` : reason;
    return stream("report", { mode: InferenceMode.ONLY_ON_DEVICE, reason: why }, prompt(recent), onChunk);
  };

  if (!navigator.onLine) return onDevice("Offline: on-device");

  // Online: long-context report in the cloud. If the report model errors, retry once with
  // the lighter cloud model before falling back to an on-device draft.
  const cloud = { mode: InferenceMode.ONLY_IN_CLOUD, reason: "Long-context report: cloud" };
  try {
    return await stream("report", cloud, prompt(shared), onChunk, undefined, 45_000);
  } catch (e1) {
    console.warn("Report model failed, retrying with", config.cloudModel(), e1);
    try {
      return await stream(
        "report",
        { ...cloud, reason: `${cloud.reason} (retried on ${config.cloudModel()})` },
        prompt(shared),
        onChunk,
        config.cloudModel(),
        45_000,
      );
    } catch (e2) {
      console.warn("Cloud report failed, drafting on-device", e2);
      return onDevice("Cloud error → on-device draft");
    }
  }
}

async function stream(
  task: Task,
  r: RouteDecision,
  prompt: string,
  onChunk: (t: string) => void,
  cloudModel?: string,
  timeout?: number,
): Promise<AIResult<string>> {
  const t0 = performance.now();
  const res = await model(task, r.mode, false, cloudModel).generateContentStream(
    prompt,
    timeout ? { timeout } : undefined,
  );
  let text = "";
  for await (const chunk of res.stream) {
    text += chunk.text();
    onChunk(text);
  }
  const final = await res.response;
  const source = sourceOf(final.inferenceSource);
  return { value: text, source, route: withFallback(r, source), ms: performance.now() - t0 };
}
