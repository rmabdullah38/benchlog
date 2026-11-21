import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseSpecs, specLabel } from "../lib";
import type { Experiment } from "../types";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; experiment?: Experiment | null; onSave: (x: { id?: string; name: string; goal?: string; specs?: string }) => void }
export function ExperimentDialog({ open, onOpenChange, experiment, onSave }: Props) {
  const [name, setName] = useState(""); const [goal, setGoal] = useState(""); const [specs, setSpecs] = useState("");
  useEffect(() => { if (open) { setName(experiment?.name ?? ""); setGoal(experiment?.goal ?? ""); setSpecs(experiment?.specs ?? ""); } }, [open, experiment]);
  const parsed = parseSpecs(specs);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{experiment ? "Edit experiment" : "New experiment"}</DialogTitle>
          <DialogDescription>Specs drive the red out-of-spec flags and the shaded bands on Trends.</DialogDescription>
        </DialogHeader>
        <form id="exp-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; onSave({ ...(experiment ? { id: experiment.id } : {}), name: name.trim(), goal, specs }); onOpenChange(false); }}>
          <div className="space-y-1.5"><Label htmlFor="exp-name">Name</Label><Input id="exp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Catheter pH sensor: calibration batch 8" /></div>
          <div className="space-y-1.5"><Label htmlFor="exp-goal">Goal</Label><Textarea id="exp-goal" rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-specs">Spec limits</Label>
            <Input id="exp-specs" className="font-mono" value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="Slope 55-60 mV/pH; Offset < 10 mV" />
            <p className="text-xs text-muted-foreground">One per quantity, separated by “;”. Use a range <span className="font-mono">55-60</span> or a limit <span className="font-mono">&lt; 10</span>, then the unit.</p>
            {parsed.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {parsed.map((s) => <span key={s.raw} className="rounded border border-device/30 bg-device-soft px-2 py-0.5 font-mono text-xs text-device">{s.name} {specLabel(s)}</span>)}
              </div>
            )}
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="exp-form" disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
