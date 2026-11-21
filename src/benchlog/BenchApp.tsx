import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { parseSpecs } from "./lib";
import { useBenchStore } from "./useBenchStore";
import { ActivityPanel } from "./components/ActivityPanel";
import { AskPanel } from "./components/AskPanel";
import { Composer } from "./components/Composer";
import { ExperimentDialog } from "./components/ExperimentDialog";
import { ExperimentSwitcher } from "./components/ExperimentSwitcher";
import { NanoDialog } from "./components/NanoDialog";
import { OfflineBanner } from "./components/OfflineBanner";
import { ReportPanel } from "./components/ReportPanel";
import { SidePanel, type PanelTab } from "./components/SidePanel";
import { StatusPills } from "./components/StatusPills";
import { Timeline } from "./components/Timeline";
import { AccountButton, TopBar } from "./components/TopBar";
import { TrendsPanel } from "./components/TrendsPanel";

export function BenchApp() {
  const s = useBenchStore();
  const [tab, setTab] = useState<PanelTab>("ask");
  const [mobileView, setMobileView] = useState<"notebook" | "panel">("notebook");
  const [expDialog, setExpDialog] = useState<null | "new" | "edit">(null);
  const [nanoOpen, setNanoOpen] = useState(false);
  const [hl, setHl] = useState<number | null>(null);
  const specs = parseSpecs(s.experiment?.specs);

  const cite = (seq: number) => {
    setMobileView("notebook"); setHl(seq);
    requestAnimationFrame(() => document.getElementById(`entry-${seq}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    setTimeout(() => setHl(null), 2000);
  };

  return (
    <div className="min-h-screen">
      <TopBar
        switcher={<ExperimentSwitcher experiments={s.experiments} currentId={s.experimentId} onSelect={s.setExperimentId} onNew={() => setExpDialog("new")} onEdit={() => setExpDialog("edit")} />}
        pills={<StatusPills connectivity={s.connectivity} nano={s.nano} pending={s.pendingSync} onNanoClick={() => setNanoOpen(true)} />}
        account={<AccountButton user={s.user} onSignIn={s.onSignIn} onSignOut={s.onSignOut} />}
      />
      {s.connectivity === "offline" && <OfflineBanner />}

      <div className="sticky top-[57px] z-20 flex border-b bg-background/90 backdrop-blur md:hidden" role="tablist">
        {(["notebook", "panel"] as const).map((v) => (
          <Button key={v} variant="ghost" role="tab" aria-selected={mobileView === v} onClick={() => setMobileView(v)}
            className={cn("flex-1 rounded-none py-2 text-sm", mobileView === v ? "border-b-2 border-foreground font-medium" : "text-muted-foreground")}>
            {v === "notebook" ? "Notebook" : "Insights"}
          </Button>
        ))}
      </div>

      <main className="mx-auto grid max-w-[1280px] gap-6 px-4 py-5 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className={cn("min-w-0 space-y-4", mobileView !== "notebook" && "hidden md:block")} aria-label="Notebook">
          <Composer onLogEntry={s.onLogEntry} offline={s.connectivity === "offline"} />
          <Timeline entries={s.entries} specs={specs} highlightSeq={hl} onDelete={s.onDelete} onRetry={s.onRetry} onEditMeasurement={s.onEditMeasurement} onLoadSample={s.onLoadSample} />
        </section>
        <aside className={cn("min-w-0 md:sticky md:top-[72px] md:self-start md:max-h-[calc(100vh-88px)] md:overflow-y-auto", mobileView !== "panel" && "hidden md:block")} aria-label="Insights">
          <SidePanel tab={tab} onTab={setTab}
            ask={<AskPanel answer={s.answer} onAsk={s.onAsk} onCite={cite} />}
            report={<ReportPanel report={s.report} onWriteReport={s.onWriteReport} onCite={cite} />}
            trends={<TrendsPanel entries={s.entries} specs={specs} />}
            activity={<ActivityPanel activity={s.activity} />}
          />
        </aside>
      </main>

      <ExperimentDialog open={expDialog !== null} onOpenChange={(o) => !o && setExpDialog(null)} experiment={expDialog === "edit" ? s.experiment : null} onSave={s.onSaveExperiment} />
      <NanoDialog open={nanoOpen} onOpenChange={setNanoOpen} nano={s.nano} onDownload={s.onDownloadNano} />
    </div>
  );
}
