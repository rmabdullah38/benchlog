export interface Measurement {
  name: string;
  value: number;
  unit: string;
}

export interface Anomaly {
  description: string;
  severity: "low" | "medium" | "high";
  /** "model" = flagged by the language model; "stats" = flagged by the drift check. */
  origin?: "model" | "stats";
}

export interface StructuredEntry {
  title: string;
  kind: "measurement" | "observation" | "procedure" | "issue" | "idea";
  summary: string;
  setup: string;
  measurements: Measurement[];
  anomalies: Anomaly[];
  tags: string[];
  followUps: string[];
}

export type EntryStatus = "queued" | "processing" | "done" | "error";

export interface Entry {
  id: string;
  seq: number;
  experimentId: string | null;
  raw: string;
  /** Small JPEG data URL of an attached instrument photo, if any. */
  photo?: string | null;
  private: boolean;
  status: EntryStatus;
  structured?: StructuredEntry | null;
  source?: "on_device" | "in_cloud" | null;
  routeReason?: string | null;
  latencyMs?: number | null;
  error?: string | null;
  createdAt: number;
  /** True while the write is only in the local cache (not yet synced). */
  pendingSync?: boolean;
}

export interface Experiment {
  id: string;
  name: string;
  goal?: string;
  createdAt: number;
}
