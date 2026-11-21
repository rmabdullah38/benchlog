import { useRef, useState } from "react";
import { Camera, Lock, LockOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Composer({ onLogEntry, offline }: { onLogEntry: (text: string, photo: string | null, isPrivate: boolean) => void; offline?: boolean }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [priv, setPriv] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const submit = () => {
    if (!text.trim() && !photo) return;
    onLogEntry(text.trim(), photo, priv);
    setText(""); setPhoto(null);
  };
  return (
    <div className="rounded-lg border bg-card shadow-card focus-within:border-ring/60">
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={3}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
        placeholder="What did you just do or see?"
        aria-label="New bench note"
        className="block w-full resize-none bg-transparent px-4 pt-3 pb-1 text-[15px] outline-none placeholder:text-muted-foreground"
      />
      {photo && (
        <div className="relative mx-4 mb-2 inline-block">
          <img src={photo} alt="Attached" className="h-16 rounded border" />
          <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" className="absolute -top-1.5 -right-1.5 rounded-full border bg-background p-0.5"><X className="size-3" /></button>
        </div>
      )}
      <div className="flex items-center gap-1 border-t px-2 py-1.5">
        <input ref={file} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setPhoto(String(r.result)); r.readAsDataURL(f); } e.target.value = ""; }} />
        <Button variant="ghost" size="sm" onClick={() => file.current?.click()}><Camera className="size-4" />Photo</Button>
        <Button variant="ghost" size="sm" aria-pressed={priv} onClick={() => setPriv((p) => !p)} className={cn(priv && "bg-device-soft text-device hover:bg-device-soft hover:text-device")}>
          {priv ? <Lock className="size-4" /> : <LockOpen className="size-4" />}Keep on this device
        </Button>
        <span className="ml-auto hidden font-mono text-[11px] text-muted-foreground sm:inline">{offline ? "saved locally · " : ""}⌘↵</span>
        <Button size="sm" onClick={submit} disabled={!text.trim() && !photo} className="ml-2">Log it</Button>
      </div>
    </div>
  );
}
