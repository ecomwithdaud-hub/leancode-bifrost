"use client";

import React, { useState } from "react";
import { Play, Sparkles, RefreshCw, Terminal, Info } from "lucide-react";

interface TaskConsoleProps {
  isRunning: boolean;
  logs: any[];
  currentPrompt: string;
  onRunTask: (prompt: string) => Promise<void>;
  onSeedCache: () => Promise<void>;
  onSimulateFailover: () => Promise<void>;
}

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0f1218] p-5 space-y-4">
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

      {/* Task Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          placeholder="E.g., Locate calculate_tax in example_module.py and optimize it..."
          disabled={isRunning}
          className="flex-1 bg-[#090b10] border border-white/[0.08] rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:border-white/20 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isRunning || !promptInput.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#a3e635] hover:bg-[#bef264] text-[#090b10] text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
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
      </form>

      {/* Live Activity & Telemetry Feed */}
      <div className="rounded-lg bg-[#090b10] border border-white/[0.06] p-3 font-mono text-xs">
        <div className="flex items-center justify-between text-slate-500 border-b border-white/[0.06] pb-2 mb-2 text-[11px]">
          <span>AGENT LOG STREAM</span>
          <span>BIFROST GATEWAY (localhost:8080)</span>
        </div>

        <div className="h-64 overflow-y-auto space-y-1.5 pr-2">
          {logs && logs.length > 0 ? (
            logs.map((log, idx) => {
              let badgeColor = "text-slate-400";
              if (log.level === "WARNING") badgeColor = "text-amber-400";
              if (log.level === "ERROR") badgeColor = "text-rose-400";
              if (log.level === "SUCCESS") badgeColor = "text-[#a3e635]";

              return (
                <div key={idx} className="flex items-start gap-2 text-slate-300 leading-relaxed text-[11px]">
                  <span className="text-slate-600 shrink-0 text-[10px]">{log.time_str || "NOW"}</span>
                  <span className={`shrink-0 font-bold text-[10px] ${badgeColor}`}>[{log.level}]</span>
                  <span className="text-slate-300 break-words">{log.message}</span>
                </div>
              );
            })
          ) : (
            <div className="text-slate-600 text-center py-12 font-sans text-xs">
              No tasks currently running. Enter a coding task above or click a Judge Demo button.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
