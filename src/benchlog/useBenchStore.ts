// The app's single store hook, backed by Firebase (Auth, Firestore offline cache, Remote Config)
// and Firebase AI Logic hybrid inference. The UI components only see this hook's return value.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { InferenceMode } from "firebase/ai";
import { auth, config, loadRemoteConfig, upgradeToGoogle, whenSignedIn } from "../core/firebase";
import {
  askNotebook,
  downloadOnDeviceModel,
  onDeviceAvailability,
  structureEntry,
  warmUpOnDevice,
  writeReport,
  type AIResult,
} from "../core/ai";
import { driftAnomalies } from "../core/anomaly";
import { normalizeUnit, reconcile } from "../core/extract";
import { checkSpecs, parseSpecs } from "../core/specs";
import { sampleEntries, sampleExperiment } from "../core/sample";
import {
  addEntry,
  addExperiment,
  removeEntry,
  setUser as setStoreUser,
  updateEntry,
  updateExperiment,
  watchEntries,
  watchExperiments,
} from "../core/store";
import type { Activity, Anomaly, Connectivity, Entry, Experiment, Measurement, NanoState, Source, User } from "./types";

export interface Stream { text: string; streaming: boolean; source?: Source; reason?: string; ms?: number }

const LS_EXP = "benchlog.exp";
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

async function downscale(dataUrl: string, max = 768): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

function friendly(err: unknown) {
  const m = String((err as Error)?.message ?? err);
  if (!navigator.onLine) return "Offline and the on-device model isn't ready. Will retry when you reconnect.";
  if (/app.?check/i.test(m)) return "App Check rejected the request.";
  return m.slice(0, 200);
}

export function useBenchStore() {
  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [experimentId, setExperimentIdState] = useState<string | null>(ls.get(LS_EXP) || null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [connectivity, setConnectivity] = useState<Connectivity>(navigator.onLine ? "online" : "offline");
  const [nano, setNano] = useState<NanoState>({ state: "unavailable" });
  const [answer, setAnswer] = useState<Stream | null>(null);
  const [report, setReport] = useState<Stream | null>(null);

  // Refs so the background queue always sees the latest state.
  const entriesRef = useRef(entries);
  const experimentsRef = useRef(experiments);
  const nanoRef = useRef(nano);
  entriesRef.current = entries;
  experimentsRef.current = experiments;
  nanoRef.current = nano;

  const setExperimentId = useCallback((id: string | null) => {
    setExperimentIdState(id);
    ls.set(LS_EXP, id ?? "");
  }, []);

  const log = useCallback((a: Activity) => setActivity((xs) => [a, ...xs].slice(0, 100)), []);
  const logResult = useCallback(
    (task: Activity["task"], r: AIResult<unknown>) =>
      log({ task, source: r.source, reason: r.route.reason, ms: Math.round(r.ms), at: Date.now() }),
    [log],
  );

  // --- Auth + Firestore subscriptions -------------------------------------------------
  useEffect(() => {
    let unsubs: Array<() => void> = [];
    whenSignedIn(async (u) => {
      unsubs.forEach((f) => f());
      setStoreUser(u.uid);
      setUid(u.uid);
      setUser(u.isAnonymous ? null : { name: u.displayName ?? u.email ?? "Signed in", photoUrl: u.photoURL });
      await loadRemoteConfig();
      unsubs = [
        watchExperiments((x) => setExperiments(x)),
        watchEntries((list) => setEntries(list)),
      ];
    });
    return () => unsubs.forEach((f) => f());
  }, []);

  // Keep the selected experiment valid.
  useEffect(() => {
    if (!experiments.length) return;
    if (!experimentId || !experiments.some((e) => e.id === experimentId)) setExperimentId(experiments[0]!.id);
  }, [experiments, experimentId, setExperimentId]);

  // --- Connectivity ---------------------------------------------------------------------
  useEffect(() => {
    const on = () => { setConnectivity("online"); void loadRemoteConfig(); };
    const off = () => setConnectivity("offline");
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // --- On-device model status -----------------------------------------------------------
  const refreshNano = useCallback(async () => {
    const a = await onDeviceAvailability();
    const next: NanoState =
      a === "available" ? { state: "ready" }
      : a === "downloadable" ? { state: "available" }
      : a === "downloading" ? { state: "downloading", progress: nanoRef.current.state === "downloading" ? nanoRef.current.progress : 0 }
      : { state: "unavailable" };
    setNano(next);
    return a;
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const poll = async () => {
      const a = await refreshNano();
      if (a === "downloading") timer = window.setTimeout(poll, 10_000);
    };
    void poll();
    return () => clearTimeout(timer);
  }, [refreshNano]);

  // Pre-load Gemini Nano while the user is still typing (avoids a ~20 s cold start).
  useEffect(() => {
    if (nano.state !== "ready") return;
    const idle = (self as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => {
      if (!entriesRef.current.some((e) => e.status === "queued" || e.status === "processing")) void warmUpOnDevice();
    });
  }, [nano.state]);

  const onDownloadNano = useCallback(async () => {
    setNano({ state: "downloading", progress: 0 });
    try {
      await downloadOnDeviceModel((p) => setNano({ state: "downloading", progress: Math.round(p * 100) }));
    } catch (e) {
      log({ task: "structure", source: "failed", reason: `Model download: ${String((e as Error).message ?? e)}`, ms: 0, at: Date.now() });
    }
    void refreshNano();
  }, [log, refreshNano]);

  // --- Deterministic checks ---------------------------------------------------------------
  const ruleChecks = useCallback((entry: Entry, measurements: Measurement[]): Anomaly[] => {
    const history = entriesRef.current.filter(
      (e) => e.id !== entry.id && e.experimentId === entry.experimentId && e.createdAt < entry.createdAt,
    );
    const exp = experimentsRef.current.find((x) => x.id === entry.experimentId);
    return [...checkSpecs(measurements, parseSpecs(exp?.specs)), ...driftAnomalies(measurements, history, config.anomalyZ())];
  }, []);

  // --- Processing queue: structure entries whenever some allowed model is reachable --------
  const processing = useRef(false);
  const processQueue = useCallback(async () => {
    if (processing.current) return;
    processing.current = true;
    const tried = new Set<string>();
    try {
      for (;;) {
        const nanoReady = nanoRef.current.state === "ready";
        const canRun = (e: Entry) => (navigator.onLine ? !e.private || nanoReady : nanoReady);
        const next = entriesRef.current.find(
          (e) => (e.status === "queued" || e.status === "processing") && !tried.has(e.id) && canRun(e),
        );
        if (!next) break;
        tried.add(next.id);
        updateEntry(next.id, { status: "processing", error: null });
        const exp = experimentsRef.current.find((x) => x.id === next.experimentId) ?? null;
        try {
          const img = next.photo ? { mimeType: "image/jpeg", data: next.photo.split(",")[1]! } : null;
          const res = await structureEntry(next.raw, img, exp, { private: next.private });
          logResult("structure", res);
          // Cross-check the model against a deterministic scan of the note.
          res.value.measurements = reconcile(next.raw, res.value.measurements);
          res.value.anomalies = [
            ...res.value.anomalies.map((a) => ({ ...a, origin: "model" as const })),
            ...ruleChecks(next, res.value.measurements),
          ];
          updateEntry(next.id, {
            status: "done",
            structured: res.value,
            source: res.source,
            routeReason: res.route.reason,
            latencyMs: Math.round(res.ms),
          });
        } catch (err) {
          console.error(err);
          log({ task: "structure", source: "failed", reason: String((err as Error).message ?? err), ms: 0, at: Date.now() });
          updateEntry(next.id, { status: "error", error: friendly(err) });
        }
      }
    } finally {
      processing.current = false;
    }
  }, [log, logResult, ruleChecks]);

  useEffect(() => { void processQueue(); }, [entries, nano.state, connectivity, processQueue]);

  // --- Actions --------------------------------------------------------------------------
  const visible = useMemo(
    () =>
      entries
        .filter((e) => (experimentId ? e.experimentId === experimentId : true))
        .sort((a, b) => b.seq - a.seq),
    [entries, experimentId],
  );
  const experiment = experiments.find((e) => e.id === experimentId) ?? null;
  const pendingSync = entries.filter((e) => e.pendingSync).length;

  const onLogEntry = useCallback(
    async (text: string, photo: string | null, isPrivate: boolean) => {
      if (!uid) return;
      const seq = entriesRef.current.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
      const small = photo ? await downscale(photo).catch(() => null) : null;
      addEntry({
        seq,
        experimentId,
        raw: text,
        photo: small,
        private: isPrivate,
        status: "queued",
        structured: null,
        source: null,
        createdAt: Date.now(),
      });
    },
    [uid, experimentId],
  );

  const onDelete = useCallback((id: string) => removeEntry(id), []);
  const onRetry = useCallback((id: string) => updateEntry(id, { status: "queued", error: null }), []);

  const onEditMeasurement = useCallback(
    (id: string, index: number, m: Measurement | null) => {
      const e = entriesRef.current.find((x) => x.id === id);
      if (!e?.structured) return;
      const ms = [...e.structured.measurements];
      if (m) m = { ...m, unit: normalizeUnit(m.unit).unit, unverified: false };
      if (m === null) ms.splice(index, 1);
      else if (index >= ms.length) ms.push(m);
      else ms[index] = m;
      const modelAnoms = e.structured.anomalies.filter((a) => !a.origin || a.origin === "model");
      updateEntry(id, {
        structured: { ...e.structured, measurements: ms, anomalies: [...modelAnoms, ...ruleChecks(e, ms)] },
      });
    },
    [ruleChecks],
  );

  const onAsk = useCallback(
    async (q: string, onDeviceOnly: boolean) => {
      setAnswer({ text: "", streaming: true });
      try {
        const done = visible.filter((x) => x.status === "done").sort((a, b) => a.seq - b.seq);
        const res = await askNotebook(q, done, (t) => setAnswer((a) => ({ ...(a ?? {}), text: t, streaming: true })), {
          private: onDeviceOnly,
        });
        logResult("ask", res);
        setAnswer({ text: res.value, streaming: false, source: res.source, reason: res.route.reason, ms: Math.round(res.ms) });
      } catch (err) {
        setAnswer({ text: `**Couldn't answer:** ${friendly(err)}`, streaming: false });
      }
    },
    [visible, logResult],
  );

  const onWriteReport = useCallback(async () => {
    setReport({ text: "", streaming: true });
    try {
      const done = visible.filter((x) => x.status === "done").sort((a, b) => a.seq - b.seq);
      const exps = experimentId ? experiments.filter((x) => x.id === experimentId) : experiments;
      const res = await writeReport(done, exps, (t) => setReport((r) => ({ ...(r ?? {}), text: t, streaming: true })));
      logResult("report", res);
      setReport({ text: res.value, streaming: false, source: res.source, reason: res.route.reason, ms: Math.round(res.ms) });
    } catch (err) {
      setReport({ text: `**Couldn't write the report:** ${friendly(err)}`, streaming: false });
    }
  }, [visible, experimentId, experiments, logResult]);

  const onSaveExperiment = useCallback(
    (x: Omit<Experiment, "id" | "createdAt"> & { id?: string }) => {
      const fields = { name: x.name, goal: x.goal ?? "", specs: x.specs ?? "" };
      if (x.id) {
        updateExperiment(x.id, fields);
        // Re-run spec checks on this experiment's entries with the new limits.
        const specs = parseSpecs(fields.specs);
        for (const e of entriesRef.current.filter((e) => e.experimentId === x.id && e.structured)) {
          const keep = e.structured!.anomalies.filter((a) => a.origin !== "spec");
          updateEntry(e.id, { structured: { ...e.structured!, anomalies: [...keep, ...checkSpecs(e.structured!.measurements, specs)] } });
        }
        return;
      }
      setExperimentId(addExperiment(fields.name, fields.goal, Date.now(), fields.specs));
    },
    [setExperimentId],
  );

  const onLoadSample = useCallback(() => {
    if (!uid) return;
    const id = addExperiment(sampleExperiment.name, sampleExperiment.goal, Date.now() - 7 * 864e5, sampleExperiment.specs);
    setExperimentId(id);
    const base = entriesRef.current.reduce((m, e) => Math.max(m, e.seq), 0);
    sampleEntries().forEach((s, i) => addEntry({ ...s, seq: base + i + 1, experimentId: id }));
  }, [uid, setExperimentId]);

  const onSignIn = useCallback(async () => {
    try {
      await upgradeToGoogle();
      const u = auth.currentUser;
      if (u && !u.isAnonymous) setUser({ name: u.displayName ?? u.email ?? "Signed in", photoUrl: u.photoURL });
    } catch (e) {
      console.warn("Sign-in failed", e);
    }
  }, []);
  const onSignOut = useCallback(() => { void signOut(auth); }, []);

  // Eval hook for the accuracy harness (eval/README.md); only exposed with ?debug=1.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("debug")) return;
    (self as unknown as Record<string, unknown>).__benchlog = {
      structure: (raw: string, mode: InferenceMode) =>
        structureEntry(raw, null, null, { forceMode: mode }).then((r) => ({
          ...r.value,
          measurements: reconcile(raw, r.value.measurements),
          source: r.source,
          ms: Math.round(r.ms),
        })),
    };
  }, []);

  return {
    experiments, experiment, experimentId, setExperimentId, entries: visible, allEntries: entries, activity,
    connectivity, nano, user, pendingSync, answer, report, ready: !!uid,
    onLogEntry, onDelete, onRetry, onEditMeasurement, onAsk, onWriteReport, onSaveExperiment, onLoadSample,
    onDownloadNano, onSignIn, onSignOut,
  };
}
export type BenchStore = ReturnType<typeof useBenchStore>;
