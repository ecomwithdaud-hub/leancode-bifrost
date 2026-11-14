"use client";

import React, { useState } from "react";
import { Play, Sparkles, RefreshCw, Terminal, Info, Copy, Check } from "lucide-react";

interface TaskConsoleProps {
  isRunning: boolean;
  logs: any[];
  currentPrompt: string;
  onRunTask: (prompt: string) => Promise<void>;
  onSeedCache: () => Promise<void>;
  onSimulateFailover: () => Promise<void>;
}

const DEMO_PROMPTS = [
  "Add docstrings to example_module.py",
  "Explain architecture in 2 sentences",
  "Write unit tests for example_module.py",
  "Audit workspace for unused imports",
  "Optimize token slicing in leancode.py",
  "Run pytest verification suite",
];

export const TaskConsole: React.FC<TaskConsoleProps> = ({
  isRunning,
  logs,
  currentPrompt,
  onRunTask,
  onSeedCache,
  onSimulateFailover,
}) => {
  const [promptInput, setPromptInput] = useState("");
  const [demoStatus, setDemoStatus] = useState<string | null>(null);
  const [activeLogFilter, setActiveLogFilter] = useState<"All" | "Cache" | "Routing" | "Security">("All");
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptInput.trim() || isRunning) return;
    const task = promptInput;
    setPromptInput("");
    await onRunTask(task);
  };

  const handleSeedDemo = async () => {
    setDemoStatus("Seeding demo files & priming SHA-256 cache...");
    await onSeedCache();
    setDemoStatus("SHA-256 Cache primed! Watch 'Tokens Saved' increment.");
    setTimeout(() => setDemoStatus(null), 4000);
  };

  const handleFailoverDemo = async () => {
    setDemoStatus("Simulating 429 Provider Rate Limit on primary model...");
    await onSimulateFailover();
    setDemoStatus("Failover triggered! Switched to fallback model.");
    setTimeout(() => setDemoStatus(null), 4000);
  };

  const handleCopyLogs = () => {
    if (!logs || logs.length === 0) return;
    const logText = logs
      .map((l) => `[${l.time_str || "NOW"}] [${l.level}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(logText);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Filter logs client-side
  const filteredLogs = (logs || []).filter((log) => {
    if (activeLogFilter === "All") return true;
    const text = `${log.level || ""} ${log.message || ""}`.toLowerCase();
    if (activeLogFilter === "Cache") {
      return (
        text.includes("cache") ||
        text.includes("sha") ||
        text.includes("hit") ||
        text.includes("slice") ||
        text.includes("saving") ||
        text.includes("token")
      );
    }
    if (activeLogFilter === "Routing") {
      return (
        text.includes("failover") ||
        text.includes("route") ||
        text.includes("model") ||
        text.includes("gateway") ||
        text.includes("bifrost") ||
        text.includes("429") ||
        text.includes("task")
      );
    }
    if (activeLogFilter === "Security") {
      return (
        text.includes("confidential") ||
        text.includes("approval") ||
        text.includes("gate") ||
        text.includes("deny") ||
        text.includes("approve") ||
        text.includes("action") ||
        text.includes("lock") ||
        text.includes("marker")
      );
    }
    return true;
  });

  return (
    <div className="rounded-xl border border-white/[0.08] hover:border-white/15 bg-[#0f1218] p-5 space-y-4 transition-colors">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Agent Execution Console
          </h3>
        </div>

        {/* Hackathon Judge Preset Buttons (Subtle Neutral) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSeedDemo}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-colors"
          >
            <Sparkles className="w-3 h-3 text-slate-400" />
            <span>Judge Demo: Cache Hit</span>
          </button>

          <button
            type="button"
            onClick={handleFailoverDemo}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
            <span>Judge Demo: Failover</span>
          </button>
        </div>
      </div>

      {demoStatus && (
        <div className="p-2.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs text-slate-300 flex items-center gap-2 font-mono">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{demoStatus}</span>
        </div>
      )}

      {/* 6 Clickable Preset Prompt Chips */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          Demo Prompts (1-Click Fill)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_PROMPTS.map((promptText, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPromptInput(promptText)}
              className="text-[11px] font-mono bg-[#141821] border border-white/10 hover:border-[#a3e635]/50 hover:text-white text-slate-300 rounded-md px-2.5 py-1 transition-colors cursor-pointer text-left"
            >
              {promptText}
            </button>
          ))}
        </div>
      </div>

      {/* Task Input Form with Textarea & Ctrl+Enter Support */}
      <form onSubmit={(e) => handleSubmit(e)} className="space-y-2">
        <div className="relative">
          <textarea
            rows={2}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Enter coding task or click a demo prompt above (Ctrl+Enter to run)..."
            disabled={isRunning}
            className="w-full bg-[#090b10] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:border-white/20 focus:outline-none disabled:opacity-50 resize-none leading-relaxed"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            Press <kbd className="px-1 py-0.5 rounded bg-white/[0.05] border border-white/10 text-slate-300">Ctrl</kbd> + <kbd className="px-1 py-0.5 rounded bg-white/[0.05] border border-white/10 text-slate-300">Enter</kbd> to dispatch
          </span>
          <button
            type="submit"
            disabled={isRunning || !promptInput.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#a3e635] hover:bg-[#bef264] text-[#090b10] text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 ml-auto"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#090b10]" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-[#090b10] text-[#090b10]" />
                <span>Dispatch Task</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Live Activity & Telemetry Feed */}
      <div className="rounded-lg bg-[#090b10] border border-white/[0.06] p-3 font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500 border-b border-white/[0.06] pb-2 mb-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span>AGENT LOG STREAM</span>
            <span className="text-slate-600">·</span>
            {/* Filter Pills */}
            <div className="flex items-center gap-1">
              {(["All", "Cache", "Routing", "Security"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveLogFilter(filter)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    activeLogFilter === filter
                      ? "bg-white/[0.08] text-slate-200 border border-white/20 font-semibold"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLogs}
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 transition-colors"
            >
              {copiedLogs ? <Check className="w-2.5 h-2.5 text-[#a3e635]" /> : <Copy className="w-2.5 h-2.5" />}
              <span>{copiedLogs ? "Copied!" : "Copy"}</span>
            </button>
          </div>
        </div>

        <div className="h-64 overflow-y-auto space-y-1.5 pr-2">
          {filteredLogs && filteredLogs.length > 0 ? (
            filteredLogs.map((log, idx) => {
              let badgeColor = "text-slate-400";
              if (log.level === "WARNING") badgeColor = "text-amber-400";
              if (log.level === "ERROR") badgeColor = "text-rose-400";
              if (log.level === "SUCCESS") badgeColor = "text-[#a3e635]";

              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-slate-300 leading-relaxed text-[11px]"
                >
                  <span className="text-slate-600 shrink-0 text-[10px]">
                    {log.time_str || "NOW"}
                  </span>
                  <span className={`shrink-0 font-bold text-[10px] ${badgeColor}`}>
                    [{log.level}]
                  </span>
                  <span className="text-slate-300 break-words">{log.message}</span>
                </div>
              );
            })
          ) : (
            <div className="text-slate-600 text-center py-12 font-sans text-xs">
              {logs && logs.length > 0
                ? `No logs match the "${activeLogFilter}" filter.`
                : "No tasks currently running. Enter a coding task above or click a demo prompt."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
