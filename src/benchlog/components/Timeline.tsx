import type { Spec } from "../lib";
import type { Entry, Measurement } from "../types";
import { EmptyState } from "./EmptyState";
import { EntryCard } from "./EntryCard";

interface Props {
  entries: Entry[]; specs?: Spec[]; highlightSeq?: number | null;
  onDelete?: (id: string) => void; onRetry?: (id: string) => void;
  onEditMeasurement?: (id: string, i: number, m: Measurement | null) => void; onLoadSample?: () => void;
}
export function Timeline({ entries, onLoadSample, highlightSeq, ...rest }: Props) {
  if (!entries.length) return <EmptyState onLoadSample={onLoadSample} />;
  return (
    <div className="space-y-4">
      {entries.map((e) => <EntryCard key={e.id} entry={e} highlighted={e.seq === highlightSeq} {...rest} />)}
    </div>
  );
}
