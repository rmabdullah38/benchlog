export type Source = "on_device" | "in_cloud";
export interface Measurement { name: string; value: number; unit: string; origin?: "model" | "auto"; unverified?: boolean }
export interface Anomaly { description: string; severity: "low" | "medium" | "high"; origin?: "model" | "stats" | "spec" }
export interface StructuredEntry { title: string; kind: "measurement" | "observation" | "procedure" | "issue" | "idea"; summary: string; setup: string; measurements: Measurement[]; anomalies: Anomaly[]; tags: string[]; followUps: string[] }
export interface Entry { id: string; seq: number; experimentId: string | null; raw: string; photo?: string | null; private: boolean; status: "queued" | "processing" | "done" | "error"; structured?: StructuredEntry | null; source?: Source | null; routeReason?: string | null; latencyMs?: number | null; error?: string | null; createdAt: number; pendingSync?: boolean }
export interface Experiment { id: string; name: string; goal?: string; specs?: string; createdAt: number }
export interface Activity { task: "structure" | "ask" | "report"; source: Source | "failed"; reason: string; ms: number; at: number }

export type Connectivity = "online" | "offline";
export type NanoState = { state: "ready" } | { state: "downloading"; progress: number } | { state: "available" } | { state: "unavailable" };
export interface User { name: string; photoUrl?: string | null }
