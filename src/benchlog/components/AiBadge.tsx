import { Cloud, TriangleAlert, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fmtMs } from "../lib";
import type { Source } from "../types";

interface Props { source: Source | "failed"; ms?: number | null | undefined; reason?: string | null | undefined; className?: string }

export function AiBadge({ source, ms, reason, className }: Props) {
  const cfg = {
    on_device: { Icon: Zap, label: "On-device", cls: "text-device bg-device-soft border-device/30" },
    in_cloud: { Icon: Cloud, label: "Cloud", cls: "text-cloud bg-cloud-soft border-cloud/30" },
    failed: { Icon: TriangleAlert, label: "Failed", cls: "text-danger bg-danger-soft border-danger/30" },
  }[source];
  const badge = (
    <span tabIndex={reason ? 0 : -1} className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap", cfg.cls, className)}>
      <cfg.Icon className="size-3" aria-hidden />
      {cfg.label}
      {ms != null && ms > 0 && <span className="font-mono opacity-80">· {fmtMs(ms)}</span>}
    </span>
  );
  if (!reason) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="font-mono text-xs">{reason}</TooltipContent>
    </Tooltip>
  );
}
