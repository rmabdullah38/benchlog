import { CloudOff, Download, RefreshCw, Wifi, WifiOff, Zap, Check, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Connectivity, NanoState } from "../types";

const pill = "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-accent";
const tone = {
  ok: "border-device/30 text-device",
  cloud: "border-cloud/30 text-cloud",
  warn: "border-warn/40 text-warn bg-warn-soft",
  neutral: "border-border text-muted-foreground",
};

export function ConnectivityPill({ value, onClick }: { value: Connectivity; onClick?: (() => void) | undefined }) {
  const on = value === "online";
  return (
    <button type="button" onClick={onClick} className={cn(pill, on ? tone.ok : tone.warn)} aria-label={`Connectivity: ${value}. Toggle`} title={on ? "Online" : "Offline"}>
      {on ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
      <span className="hidden lg:inline">{on ? "Online" : "Offline"}</span>
    </button>
  );
}

export function NanoPill({ value, onClick }: { value: NanoState; onClick?: (() => void) | undefined }) {
  const c = {
    ready: { cls: tone.ok, Icon: Zap, label: "Gemini Nano ready" },
    downloading: { cls: tone.neutral, Icon: Download, label: "Downloading" },
    available: { cls: tone.neutral, Icon: Download, label: "Get on-device model" },
    unavailable: { cls: tone.cloud, Icon: Cloud, label: "Cloud only" },
  }[value.state];
  return (
    <button type="button" onClick={onClick} className={cn(pill, c.cls, "relative overflow-hidden")} title={c.label}>
      {value.state === "downloading" && (
        <span aria-hidden className="absolute inset-y-0 left-0 bg-device-soft" style={{ width: `${value.progress}%` }} />
      )}
      <c.Icon className="relative size-3.5" />
      <span className="relative hidden lg:inline">{c.label}{value.state === "downloading" && <span className="ml-1 font-mono">{value.progress}%</span>}</span>
    </button>
  );
}

export function SyncPill({ pending, offline }: { pending: number; offline?: boolean }) {
  return (
    <span className={cn(pill, "hover:bg-transparent", pending ? tone.warn : tone.neutral)} role="status">
      {pending ? (offline ? <CloudOff className="size-3.5" /> : <RefreshCw className="size-3.5" />) : <Check className="size-3.5" />}
      {pending ? <><span className="font-mono">{pending}</span><span className="hidden lg:inline">to sync</span></> : <span className="hidden lg:inline">Synced</span>}
    </span>
  );
}

export function StatusPills(p: { connectivity: Connectivity; nano: NanoState; pending: number; onToggleOnline?: () => void; onNanoClick?: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <ConnectivityPill value={p.connectivity} onClick={p.onToggleOnline} />
      <NanoPill value={p.nano} onClick={p.onNanoClick} />
      <SyncPill pending={p.pending} offline={p.connectivity === "offline"} />
    </div>
  );
}
