import "./style.css";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { auth, config, loadRemoteConfig, upgradeToGoogle, whenSignedIn } from "./firebase";
import {
  askNotebook,
  downloadOnDeviceModel,
  onDeviceAvailability,
  structureEntry,
  writeReport,
  type AIResult,
  type Task,
} from "./ai";
import { driftAnomalies, series } from "./anomaly";
import {
  addEntry,
  addExperiment,
  removeEntry,
  setUser,
  updateEntry,
  watchEntries,
  watchExperiments,
} from "./store";
import { sampleExperiment, sampleEntries } from "./sample";
import type { Entry, Experiment } from "./types";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let entries: Entry[] = [];
let experiments: Experiment[] = [];
let currentExp: string | null = localStorageGet("benchlog.exp");
let pendingSync = 0;
let photo: { mimeType: string; data: string; url: string } | null = null;
let nano: Awaited<ReturnType<typeof onDeviceAvailability>> = "unsupported";
let lastReport = "";

interface Activity {
  task: Task;
  source: "on_device" | "in_cloud" | "failed";
  reason: string;
  ms: number;
  at: number;
}
const activity: Activity[] = [];

function localStorageGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function localStorageSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

const visible = () => entries.filter((e) => (currentExp ? e.experimentId === currentExp : true));

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
whenSignedIn(async (user) => {
  setUser(user.uid);
  renderAccount();
  await loadRemoteConfig();
  watchExperiments((x) => {
    experiments = x;
    if (currentExp && !x.some((e) => e.id === currentExp)) currentExp = x[0]?.id ?? null;
    if (!currentExp && x.length) currentExp = x[0].id;
    renderExperiments();
    renderTimeline();
  });
  watchEntries((list, pending) => {
    entries = list;
    pendingSync = pending;
    renderSync();
    renderTimeline();
    renderTrends();
    void processQueue();
  });
});

window.addEventListener("online", () => {
  renderNet();
  void loadRemoteConfig();
  void processQueue();
});
window.addEventListener("offline", renderNet);
renderNet();
renderSync();
renderAccount();
renderTimeline();
void refreshNano();

// ---------------------------------------------------------------------------
// Status pills
// ---------------------------------------------------------------------------
function renderNet() {
  const el = $("net");
  el.textContent = navigator.onLine ? "● Online" : "● Offline";
  el.className = `pill ${navigator.onLine ? "ok" : "warn"}`;
}

async function refreshNano() {
  nano = await onDeviceAvailability();
  const el = $<HTMLButtonElement>("nano");
  const labels: Record<string, [string, string, string]> = {
    available: ["⚡ Gemini Nano ready", "ok", "On-device model is ready. Short tasks run locally."],
    downloadable: ["⬇ Get on-device model", "info", "Download Gemini Nano to work offline."],
    downloading: ["⬇ Downloading Nano…", "info", "Gemini Nano is downloading."],
    unavailable: ["☁ Cloud only", "muted", "This device can't run Gemini Nano. BenchLog uses the cloud."],
    unsupported: ["☁ Cloud only", "muted", "Use Chrome on desktop to run Gemini Nano on-device."],
  };
  const [text, cls, title] = labels[nano];
  el.textContent = text;
  el.className = `pill ${cls}`;
  el.title = title;
  el.disabled = nano !== "downloadable";
  if (nano === "available") void processQueue();
}

$("nano").addEventListener("click", async () => {
  if (nano !== "downloadable") return;
  const el = $("nano");
  try {
    await downloadOnDeviceModel((p) => (el.textContent = `⬇ Nano ${Math.round(p * 100)}%`));
  } catch (e) {
    toast(String(e));
  }
  void refreshNano();
});

function renderSync() {
  const el = $("sync");
  el.textContent = pendingSync ? `⟳ ${pendingSync} to sync` : "✓ Synced";
  el.className = `pill ${pendingSync ? "warn" : "ok"}`;
  el.title = pendingSync
    ? "Saved on this device. Will sync to Firestore when you're back online."
    : "Everything is backed up to Firestore.";
}

function renderAccount() {
  const u = auth.currentUser;
  const el = $("account");
  el.textContent = !u || u.isAnonymous ? "Sign in with Google" : (u.displayName ?? u.email ?? "Account");
  el.title = !u || u.isAnonymous ? "Keep your notebook across devices" : "Signed in";
}
$("account").addEventListener("click", async () => {
  if (auth.currentUser && !auth.currentUser.isAnonymous) return;
  try {
    await upgradeToGoogle();
    renderAccount();
  } catch (e) {
    toast("Sign-in failed: " + (e as Error).message);
  }
});

// ---------------------------------------------------------------------------
// Experiments
// ---------------------------------------------------------------------------
function renderExperiments() {
  const sel = $<HTMLSelectElement>("experiment");
  sel.innerHTML =
    `<option value="">All entries</option>` +
    experiments.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
  sel.value = currentExp ?? "";
}
$("experiment").addEventListener("change", (e) => {
  currentExp = (e.target as HTMLSelectElement).value || null;
  localStorageSet("benchlog.exp", currentExp ?? "");
  renderTimeline();
  renderTrends();
});
$("new-exp").addEventListener("click", () => {
  $("exp-form").hidden = false;
  $("exp-name").focus();
});
$("exp-cancel").addEventListener("click", () => ($("exp-form").hidden = true));
$("exp-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $<HTMLInputElement>("exp-name").value.trim();
  if (!name) return;
  addExperiment(name, $<HTMLInputElement>("exp-goal").value.trim());
  $<HTMLFormElement>("exp-form").reset();
  $("exp-form").hidden = true;
});

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------
$("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  logEntry();
});
$("raw").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    logEntry();
  }
});

$<HTMLInputElement>("photo").addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  photo = await downscale(file, 768);
  const prev = $("photo-preview");
  prev.hidden = false;
  prev.innerHTML = `<img src="${photo.url}" alt="Attached photo" /><button type="button" class="ghost small" id="photo-x">Remove</button>`;
  $("photo-x").addEventListener("click", clearPhoto);
});

function clearPhoto() {
  photo = null;
  $<HTMLInputElement>("photo").value = "";
  $("photo-preview").hidden = true;
  $("photo-preview").innerHTML = "";
}

async function downscale(file: File, max: number) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.72);
  return { mimeType: "image/jpeg", data: url.split(",")[1], url };
}

function logEntry() {
  if (!auth.currentUser) return toast("Connect once to create your notebook, then it works offline.");
  const raw = $<HTMLTextAreaElement>("raw").value.trim();
  if (!raw && !photo) return;
  const seq = entries.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
  addEntry({
    seq,
    experimentId: currentExp,
    raw,
    photo: photo?.url ?? null,
    private: $<HTMLInputElement>("private").checked,
    status: "queued",
    structured: null,
    source: null,
    createdAt: Date.now(),
  });
  $<HTMLTextAreaElement>("raw").value = "";
  clearPhoto();
}

// ---------------------------------------------------------------------------
// Processing queue: structures entries as soon as some model is reachable.
// ---------------------------------------------------------------------------
let processing = false;
async function processQueue() {
  if (processing) return;
  processing = true;
  const tried = new Set<string>(); // guards against stale snapshots re-queuing an entry
  try {
    for (;;) {
      const canRun = (e: Entry) =>
        navigator.onLine ? !e.private || nano === "available" : nano === "available";
      const next = entries.find(
        (e) => (e.status === "queued" || e.status === "processing") && !tried.has(e.id) && canRun(e),
      );
      if (!next) break; // the rest wait for 'online' or the Nano download
      tried.add(next.id);
      updateEntry(next.id, { status: "processing", error: null });
      next.status = "processing";
      const exp = experiments.find((x) => x.id === next.experimentId) ?? null;
      try {
        const img = next.photo ? { mimeType: "image/jpeg", data: next.photo.split(",")[1] } : null;
        const res = await structureEntry(next.raw, img, exp, { private: next.private });
        log("structure", res);
        const history = entries.filter(
          (e) => e.id !== next.id && e.experimentId === next.experimentId && e.createdAt < next.createdAt,
        );
        const stats = driftAnomalies(res.value.measurements, history, config.anomalyZ());
        res.value.anomalies = [
          ...res.value.anomalies.map((a) => ({ ...a, origin: "model" as const })),
          ...stats,
        ];
        updateEntry(next.id, {
          status: "done",
          structured: res.value,
          source: res.source,
          routeReason: res.route.reason,
          latencyMs: Math.round(res.ms),
        });
        next.status = "done";
      } catch (err) {
        console.error(err);
        activity.unshift({ task: "structure", source: "failed", reason: String((err as Error).message ?? err), ms: 0, at: Date.now() });
        renderActivity();
        updateEntry(next.id, { status: "error", error: friendly(err) });
        next.status = "error";
      }
    }
  } finally {
    processing = false;
  }
}

function friendly(err: unknown) {
  const m = String((err as Error)?.message ?? err);
  if (!navigator.onLine) return "Offline and the on-device model isn't ready. Will retry when you reconnect.";
  if (/app.?check/i.test(m)) return "App Check rejected the request.";
  return m.slice(0, 200);
}

function log<T>(task: Task, r: AIResult<T>) {
  activity.unshift({ task, source: r.source, reason: r.route.reason, ms: Math.round(r.ms), at: Date.now() });
  renderActivity();
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
function badge(source?: string | null, ms?: number | null, reason?: string | null) {
  if (!source) return "";
  const on = source === "on_device";
  return `<span class="badge ${on ? "device" : "cloud"}" title="${esc(reason ?? "")}">${on ? "⚡ On-device" : "☁ Cloud"}${
    ms ? ` · ${ms < 1000 ? ms + " ms" : (ms / 1000).toFixed(1) + " s"}` : ""
  }</span>`;
}

function renderTimeline() {
  const list = visible();
  $("empty").hidden = list.length > 0;
  const tl = $("timeline");
  tl.innerHTML = list
    .slice()
    .reverse()
    .map((e) => {
      const s = e.structured;
      const time = new Date(e.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      const status =
        e.status === "queued"
          ? `<span class="badge queued">${e.private && nano !== "available" ? "Waiting for on-device model" : navigator.onLine ? "Queued" : "Queued: offline"}</span>`
          : e.status === "processing"
            ? `<span class="badge queued pulse">Structuring…</span>`
            : e.status === "error"
              ? `<span class="badge error" title="${esc(e.error ?? "")}">Failed</span> <button class="link retry" data-id="${e.id}">Retry</button>`
              : badge(e.source, e.latencyMs, e.routeReason);
      const meas = s?.measurements.length
        ? `<div class="meas">${s.measurements.map((m) => `<span class="chip mono">${esc(m.name)} <b>${fmtNum(m.value)}</b> ${esc(m.unit)}</span>`).join("")}</div>`
        : "";
      const anom = s?.anomalies.length
        ? `<ul class="anoms">${s.anomalies
            .map((a) => `<li class="anom ${a.severity}"><span class="sev">${a.origin === "stats" ? "Drift" : a.severity}</span>${esc(a.description)}</li>`)
            .join("")}</ul>`
        : "";
      const fu = s?.followUps.length
        ? `<div class="followups"><span class="label">Next</span> ${s.followUps.map((f) => `<span class="fu">${esc(f)}</span>`).join("")}</div>`
        : "";
      const tags = s?.tags.length ? `<div class="tags">${s.tags.map((t) => `<span>#${esc(t)}</span>`).join(" ")}</div>` : "";
      return `<li class="card entry ${s?.anomalies.length ? "has-anom" : ""}">
        <div class="entry-head">
          <span class="seq mono">#${e.seq}</span>
          <h3>${esc(s?.title ?? (e.raw.slice(0, 60) || "Photo entry"))}</h3>
          ${s ? `<span class="kind">${s.kind}</span>` : ""}
          ${e.private ? `<span class="lock" title="Private: processed on-device only">🔒</span>` : ""}
          <span class="spacer"></span>
          ${status}
        </div>
        <div class="entry-sub muted"><time>${time}</time>${e.pendingSync ? ` · <span class="unsynced" title="Saved locally, not yet synced">not synced</span>` : ""}</div>
        ${s?.summary ? `<p class="summary">${esc(s.summary)}</p>` : ""}
        ${s?.setup ? `<p class="setup"><span class="label">Setup</span> ${esc(s.setup)}</p>` : ""}
        ${meas}${anom}${fu}
        <details class="raw"><summary>Raw note</summary><p>${esc(e.raw) || "<em>(photo only)</em>"}</p>${e.photo ? `<img src="${e.photo}" alt="Attached photo" />` : ""}</details>
        <div class="entry-foot">${tags}<span class="spacer"></span><button class="link del" data-id="${e.id}">Delete</button></div>
      </li>`;
    })
    .join("");
}

$("timeline").addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const id = t.dataset.id;
  if (!id) return;
  if (t.classList.contains("retry")) {
    updateEntry(id, { status: "queued", error: null });
  } else if (t.classList.contains("del")) {
    if (t.dataset.confirm) removeEntry(id);
    else {
      t.dataset.confirm = "1";
      t.textContent = "Confirm delete";
      setTimeout(() => {
        delete t.dataset.confirm;
        t.textContent = "Delete";
      }, 3000);
    }
  }
});

// ---------------------------------------------------------------------------
// Side panel: Ask / Report / Trends / Activity
// ---------------------------------------------------------------------------
document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll<HTMLElement>("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
  }),
);

$("ask-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $<HTMLInputElement>("question").value.trim();
  if (!q) return;
  const out = $("answer");
  const meta = $("answer-meta");
  out.innerHTML = `<p class="muted pulse">Thinking…</p>`;
  meta.innerHTML = "";
  try {
    const res = await askNotebook(q, visible().filter((x) => x.status === "done"), (t) => (out.innerHTML = md(t)), {
      private: $<HTMLInputElement>("ask-private").checked,
    });
    log("ask", res);
    meta.innerHTML = `${badge(res.source, Math.round(res.ms), res.route.reason)} <span class="muted">${esc(res.route.reason)}</span>`;
  } catch (err) {
    out.innerHTML = `<p class="error-text">${esc(friendly(err))}</p>`;
  }
});

$("report-btn").addEventListener("click", async () => {
  const out = $("report");
  const meta = $("report-meta");
  const list = visible().filter((x) => x.status === "done");
  if (!list.length) return toast("Log a few entries first.");
  out.innerHTML = `<p class="muted pulse">Writing report…</p>`;
  meta.innerHTML = "";
  try {
    const exps = currentExp ? experiments.filter((x) => x.id === currentExp) : experiments;
    const res = await writeReport(list, exps, (t) => (out.innerHTML = md(t)));
    lastReport = res.value;
    $("report-dl").hidden = false;
    log("report", res);
    meta.innerHTML = `${badge(res.source, Math.round(res.ms), res.route.reason)} <span class="muted">${esc(res.route.reason)}</span>`;
  } catch (err) {
    out.innerHTML = `<p class="error-text">${esc(friendly(err))}</p>`;
  }
});

$("report-dl").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lastReport], { type: "text/markdown" }));
  a.download = `benchlog-report-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
});

function renderTrends() {
  const s = [...series(visible()).values()].filter((x) => x.values.length >= 2);
  $("trends").innerHTML = s.length
    ? s
        .map((x) => {
          const last = x.values[x.values.length - 1];
          return `<div class="trend"><div class="trend-head"><span>${esc(x.name)}</span><span class="mono">${fmtNum(last)} ${esc(x.unit)}</span></div>${spark(x.values)}<div class="muted small">${x.values.length} readings · min ${fmtNum(Math.min(...x.values))} · max ${fmtNum(Math.max(...x.values))}</div></div>`;
        })
        .join("")
    : `<p class="muted">Trends appear once a quantity has been measured twice.</p>`;
}

function spark(v: number[]) {
  const w = 260, h = 44, p = 4;
  const lo = Math.min(...v), hi = Math.max(...v);
  const span = hi - lo || 1;
  const pts = v.map((y, i) => [p + (i * (w - 2 * p)) / Math.max(1, v.length - 1), h - p - ((y - lo) / span) * (h - 2 * p)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const [lx, ly] = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="trend"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="${lx}" cy="${ly}" r="3"/></svg>`;
}

function renderActivity() {
  const on = activity.filter((a) => a.source === "on_device").length;
  const cl = activity.filter((a) => a.source === "in_cloud").length;
  $("split").innerHTML = activity.length
    ? `<span class="badge device">⚡ ${on} on-device</span> <span class="badge cloud">☁ ${cl} cloud</span>`
    : "";
  $("activity").innerHTML = activity
    .slice(0, 50)
    .map(
      (a) =>
        `<li><span class="mono muted">${new Date(a.at).toLocaleTimeString()}</span> <b>${a.task}</b> ${
          a.source === "failed" ? `<span class="badge error">failed</span>` : badge(a.source, a.ms)
        }<div class="muted small">${esc(a.reason)}</div></li>`,
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Sample data for judges / first run
// ---------------------------------------------------------------------------
$("seed").addEventListener("click", () => {
  if (!auth.currentUser) return toast("Connect once to create your notebook, then it works offline.");
  const id = addExperiment(sampleExperiment.name, sampleExperiment.goal, Date.now() - 7 * 864e5);
  currentExp = id;
  localStorageSet("benchlog.exp", id);
  const base = entries.reduce((m, e) => Math.max(m, e.seq), 0);
  sampleEntries().forEach((s, i) => addEntry({ ...s, seq: base + i + 1, experimentId: id }));
  toast("Sample loaded. Try logging: “Slope today 51.2 mV/pH, offset +9 mV”");
});

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function md(s: string) {
  return DOMPurify.sanitize(marked.parse(s, { async: false }) as string);
}
function fmtNum(x: number) {
  return Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(2) : String(+x.toPrecision(5));
}
let toastTimer = 0;
function toast(msg: string) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 5000);
}
