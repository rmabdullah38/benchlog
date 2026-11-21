import { WifiOff } from "lucide-react";
export function OfflineBanner() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-warn/30 bg-warn-soft px-4 py-1.5 text-xs text-warn">
      <WifiOff className="size-3.5 shrink-0" />
      <span>Offline. Notes are saved on this device and structured on-device. They'll sync when you're back.</span>
    </div>
  );
}
