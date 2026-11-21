import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BenchApp } from "@/benchlog/BenchApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider delayDuration={200}>
      <BenchApp />
      <Toaster position="bottom-center" />
    </TooltipProvider>
  </StrictMode>,
);
