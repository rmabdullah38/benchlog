import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
export function EmptyState({ onLoadSample }: { onLoadSample?: (() => void) | undefined }) {
  return (
    <div className="rounded-lg border border-dashed bg-card/60 px-6 py-14 text-center">
      <FlaskConical className="mx-auto size-8 text-muted-foreground" />
      <h3 className="mt-3 font-medium">No entries yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Type what you just did or saw, as messy as you like. BenchLog pulls out measurements, flags anomalies and suggests next steps, on-device when it can.
      </p>
      <Button variant="outline" size="sm" className="mt-5" onClick={onLoadSample}>Load sample experiment</Button>
    </div>
  );
}
