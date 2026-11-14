"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, Scissors, Database, ShieldAlert, Cpu, CheckCircle2 } from "lucide-react";

interface RoutingPipelineProps {
  activeModel: string;
  isConfidential: boolean;
  cacheHits: number;
  tokensSaved: number;
  budgetCap: number;
  triggerKey?: any;
}

export const RoutingPipeline: React.FC<RoutingPipelineProps> = ({
  activeModel,
  isConfidential,
  cacheHits,
  tokensSaved,
  budgetCap,
  triggerKey,
}) => {
  const [elapsedMs, setElapsedMs] = useState<number>(3200);

  // Trigger sequential animation on mount or when triggerKey changes
  useEffect(() => {
    setElapsedMs(0);
    const startTime = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const current = now - startTime;
      if (current >= 3200) {
        setElapsedMs(3200);
        clearInterval(interval);
      } else {
        setElapsedMs(current);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [triggerKey]);

  // Model node title and subtitle
  const modelTitle = isConfidential
    ? "Ollama Local (qwen2.5-coder)"
    : (activeModel || "Gemini 3.8 Flash / Cloud");

  const nodes = [
    {
      id: "slicer",
      name: "Prompt + Line Slicer",
      subtitle: "AST line-range slicing",
      icon: Scissors,
      badge: "Step 01",
    },
    {
      id: "cache",
      name: "SHA-256 Cache",
      subtitle: cacheHits > 0 ? `${cacheHits} hit(s) · saved tokens` : "Deduplication engine",
      icon: Database,
      badge: cacheHits > 0 ? `+${tokensSaved} tok` : "Step 02",
      highlight: cacheHits > 0,
    },
    {
      id: "budget",
      name: "Bifrost Budget Guard",
      subtitle: `Pre-call < $${budgetCap.toFixed(2)} cap`,
      icon: CheckCircle2,
      badge: "Step 03",
    },
    {
      id: "model",
      name: modelTitle,
      subtitle: isConfidential ? "Air-gapped private model" : "Gateway routed inference",
      icon: isConfidential ? ShieldAlert : Cpu,
      badge: isConfidential ? "LOCAL LOCK" : "Step 04",
      highlight: isConfidential,
    },
  ];

  return (
    <div className="rounded-xl border border-white/[0.08] hover:border-white/15 bg-[#0f1218] p-4 transition-colors">
      <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635]"></span>
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-300">
            Sequential Token Routing Pipeline
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
          {elapsedMs < 3200 ? `Tracing execution · ${(elapsedMs / 1000).toFixed(1)}s` : "Pipeline active · live telemetry"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 items-center">
        {nodes.map((node, index) => {
          const nodeStartMs = index * 800;
          const isNodeActive = elapsedMs >= nodeStartMs;
          const isNodeTyping = elapsedMs >= nodeStartMs && elapsedMs < nodeStartMs + 500;
          const isNodeDone = elapsedMs >= nodeStartMs + 500 || elapsedMs >= 3200;

          // Typewriter calculation for title
          let displayedName = "";
          if (isNodeDone) {
            displayedName = node.name;
          } else if (isNodeTyping) {
            const fraction = Math.min(1, Math.max(0, (elapsedMs - nodeStartMs) / 500));
            const charCount = Math.floor(node.name.length * fraction);
            displayedName = node.name.slice(0, charCount);
          }

          const isArrowActive = elapsedMs >= nodeStartMs + 650;
          const IconComponent = node.icon;

          return (
            <div key={node.id} className="relative flex items-center">
              {/* Node Card */}
              <div
                className={`w-full rounded-lg p-2.5 border transition-all duration-300 ${
                  isNodeTyping
                    ? "bg-[#141821] border-[#a3e635]/60 shadow-sm"
                    : isNodeDone
                    ? node.highlight
                      ? "bg-[#141821] border-[#a3e635]/40"
                      : "bg-[#090b10] border-white/[0.08]"
                    : "bg-[#090b10]/40 border-white/[0.04] opacity-40"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <IconComponent
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isNodeDone
                          ? node.highlight
                            ? "text-[#a3e635]"
                            : "text-slate-300"
                          : "text-slate-600"
                      }`}
                    />
                    <span className="text-[11px] font-mono font-medium text-slate-200 truncate">
                      {displayedName}
                      {isNodeTyping && (
                        <span className="inline-block w-1.5 h-3 bg-[#a3e635] ml-0.5 align-middle animate-pulse"></span>
                      )}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-mono px-1 py-0.2 rounded shrink-0 ${
                      node.highlight
                        ? "bg-[#a3e635]/10 text-[#a3e635] border border-[#a3e635]/30 font-semibold"
                        : "bg-white/[0.04] text-slate-500 border border-white/[0.06]"
                    }`}
                  >
                    {node.badge}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate pl-5">
                  {isNodeDone ? node.subtitle : "..."}
                </div>
              </div>

              {/* Connecting Arrow for Desktop (1-3) */}
              {index < 3 && (
                <div className="hidden md:flex absolute -right-2 z-10 w-4 h-4 rounded-full bg-[#0f1218] border border-white/[0.08] items-center justify-center">
                  <ArrowRight
                    className={`w-2.5 h-2.5 transition-colors duration-300 ${
                      isArrowActive ? "text-[#a3e635]" : "text-slate-700"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
