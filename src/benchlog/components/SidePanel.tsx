import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PanelTab = "ask" | "report" | "trends" | "activity";
export function SidePanel({ tab, onTab, ask, report, trends, activity }: { tab: PanelTab; onTab: (t: PanelTab) => void; ask: ReactNode; report: ReactNode; trends: ReactNode; activity: ReactNode }) {
  return (
    <Tabs value={tab} onValueChange={(v) => onTab(v as PanelTab)} className="gap-3">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="ask">Ask</TabsTrigger>
        <TabsTrigger value="report">Report</TabsTrigger>
        <TabsTrigger value="trends">Trends</TabsTrigger>
        <TabsTrigger value="activity">AI activity</TabsTrigger>
      </TabsList>
      <TabsContent value="ask">{ask}</TabsContent>
      <TabsContent value="report">{report}</TabsContent>
      <TabsContent value="trends">{trends}</TabsContent>
      <TabsContent value="activity">{activity}</TabsContent>
    </Tabs>
  );
}
