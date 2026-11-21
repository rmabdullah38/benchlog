import { Fragment, type ReactNode } from "react";

/** Minimal Markdown: ## headings, - lists, **bold**, [#n] citations. */
export function Markdown({ text, streaming, onCite }: { text: string; streaming?: boolean; onCite?: ((seq: number) => void) | undefined }) {
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*|\[#\d+(?:\s*[,–-]\s*#\d+)*\])/g).flatMap((part) => {
      // Expand "[#7, #8]" and "[#2–#6]" into individual citations.
      const multi = part.match(/^\[(#\d+(?:\s*[,–-]\s*#\d+)+)\]$/);
      return multi ? multi[1]!.split(/\s*,\s*/).map((x) => `[${x.replace(/\s*[–-]\s*/, "]–[")}]`).join(" ").split(/(\[#\d+\])/g) : [part];
    }).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      const c = part.match(/^\[#(\d+)\]$/);
      if (c) return (
        <button key={i} type="button" onClick={() => onCite?.(+c[1]!)} className="mx-0.5 rounded bg-secondary px-1 font-mono text-[11px] text-foreground hover:bg-accent hover:underline">#{c[1]}</button>
      );
      return <Fragment key={i}>{part}</Fragment>;
    });
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={`u${out.length}`} className="my-1.5 list-disc space-y-1 pl-5">{list}</ul>); list = []; } };
  lines.forEach((l, i) => {
    const h = l.match(/^#{1,4}\s+(.*)$/);
    const li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (h) { flush(); out.push(<h4 key={i} className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">{inline(h[1]!.replace(/\*\*/g, ""))}</h4>); }
    else if (li) list.push(<li key={i}>{inline(li[1]!)}</li>);
    else if (l.trim()) { flush(); out.push(<p key={i} className="my-1.5">{inline(l)}</p>); }
  });
  flush();
  return (
    <div className="text-sm leading-relaxed">
      {out}
      {streaming && <span className="caret-blink ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-foreground/70" aria-hidden />}
    </div>
  );
}
