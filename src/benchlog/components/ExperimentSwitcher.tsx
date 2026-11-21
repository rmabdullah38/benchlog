import { useState } from "react";
import { Check, ChevronsUpDown, Pencil, Plus } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Experiment } from "../types";

interface Props { experiments: Experiment[]; currentId: string | null; onSelect: (id: string) => void; onNew: () => void; onEdit: () => void }
export function ExperimentSwitcher({ experiments, currentId, onSelect, onNew, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  const cur = experiments.find((e) => e.id === currentId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-8 w-full md:w-auto md:max-w-[22rem] min-w-0 items-center gap-2 rounded-md border bg-card px-2.5 text-sm hover:bg-accent">
        <span className="min-w-0 flex-1 truncate text-left">{cur?.name ?? "Select experiment"}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search experiments…" />
          <CommandList>
            <CommandEmpty>No experiment found.</CommandEmpty>
            <CommandGroup heading="Experiments">
              {experiments.map((e) => (
                <CommandItem key={e.id} value={e.name} onSelect={() => { onSelect(e.id); setOpen(false); }}>
                  <Check className={e.id === currentId ? "size-4" : "size-4 opacity-0"} />
                  <span className="truncate">{e.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={() => { setOpen(false); onNew(); }}><Plus className="size-4" />New experiment</CommandItem>
              {cur && <CommandItem onSelect={() => { setOpen(false); onEdit(); }}><Pencil className="size-4" />Edit specs</CommandItem>}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
