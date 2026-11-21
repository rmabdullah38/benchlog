import { Cloud, Zap } from "lucide-react";
import { fmtMs, fmtTime } from "../lib";
import type { Activity } from "../types";
import { AiBadge } from "./AiBadge";

export function ActivityPanel({ activity }: { activity: Activity[] }) {
  const dev = activity.filter((a) => a.source === "on_device").length;
  const cloud = activity.filter((a) => a.source === "in_cloud").length;
  const failed = activity.length - dev - cloud;
  const total = Math.max(1, activity.length);
  const avg = (src: string) => { const xs = activity.filter((a) => a.source === src && a.ms > 0); return xs.length ? xs.reduce((s, a) => s + a.ms, 0) / xs.length : 0; };
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-4 font-mono">
            <span className="flex items-center gap-1 text-device"><Zap className="size-4" /><span className="text-2xl font-semibold">{dev}</span><span className="text-xs">on-device</span></span>
            <span className="flex items-center gap-1 text-cloud"><Cloud className="size-4" /><span className="text-2xl font-semibold">{cloud}</span><span className="text-xs">cloud</span></span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{Math.round((dev / total) * 100)}% local</span>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${dev} on-device, ${cloud} cloud, ${failed} failed`}>
          <div className="bg-device" style={{ width: `${(dev / total) * 100}%` }} />
          <div className="bg-cloud" style={{ width: `${(cloud / total) * 100}%` }} />
          <div className="bg-danger" style={{ width: `${(failed / total) * 100}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-3 font-mono text-[10px] text-muted-foreground">
          <span>avg ⚡ {fmtMs(avg("on_device"))}</span><span className="text-center">avg ☁ {fmtMs(avg("in_cloud"))}</span><span className="text-right">{failed} failed</span>
        </div>
      </div>
      <ol className="divide-y rounded-lg border bg-card">
        {activity.slice(0, 8).map((a, i) => (
          <li key={i} className="grid grid-cols-[3rem_4.5rem_1fr] items-center gap-2 px-3 py-2 text-xs">
            <span className="font-mono text-muted-foreground">{fmtTime(a.at)}</span>
            <span className="font-mono uppercase tracking-wide text-[10px]">{a.task}</span>
            <div className="flex min-w-0 items-center gap-2">
              <AiBadge source={a.source} ms={a.ms} />
              <span className="truncate text-muted-foreground" title={a.reason}>{a.reason}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
