"use client";

import React, { useState } from "react";
import { Play, Sparkles, Shield, RefreshCw, Terminal, Check, Info } from "lucide-react";

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
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-slate-100">Live Agent Execution Console</h3>
        </div>

        {/* Hackathon Judge Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSeedDemo}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900/60 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Judge Demo: Cache Hit</span>
          </button>

          <button
            onClick={handleFailoverDemo}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-950/60 text-amber-300 border border-amber-800/80 hover:bg-amber-900/60 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Judge Demo: Failover</span>
          </button>
        </div>
      </div>

      {demoStatus && (
        <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800 text-xs text-cyan-300 flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{demoStatus}</span>
        </div>
      )}

      {/* Task Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          placeholder="E.g., Locate the tax calculation function, optimize it, and add tests..."
          disabled={isRunning}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 font-mono"
        />
        <button
          type="submit"
          disabled={isRunning || !promptInput.trim()}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white text-white" />
              <span>Dispatch Task</span>
            </>
          )}
        </button>
      </form>

      {/* Live Activity & Telemetry Feed */}
      <div className="rounded-lg bg-[#070b12] border border-slate-800 p-4 font-mono text-xs">
        <div className="flex items-center justify-between text-slate-500 border-b border-slate-800/80 pb-2 mb-2 text-[11px]">
          <span>AGENT LOG STREAM</span>
          <span>BIFROST GATEWAY (localhost:8080)</span>
        </div>

        <div className="h-64 overflow-y-auto space-y-1.5 pr-2">
          {logs && logs.length > 0 ? (
            logs.map((log, idx) => {
              let badgeColor = "text-slate-400";
              if (log.level === "WARNING") badgeColor = "text-amber-400";
              if (log.level === "ERROR") badgeColor = "text-rose-400";
              if (log.level === "SUCCESS") badgeColor = "text-emerald-400";

              return (
                <div key={idx} className="flex items-start gap-2 text-slate-300 leading-relaxed">
                  <span className="text-slate-600 shrink-0 text-[10px]">{log.time_str || "NOW"}</span>
                  <span className={`shrink-0 font-bold text-[10px] ${badgeColor}`}>[{log.level}]</span>
                  <span className="text-slate-200 break-words">{log.message}</span>
                </div>
              );
            })
          ) : (
            <div className="text-slate-600 text-center py-10 font-sans text-xs">
              No tasks currently running. Enter a coding task above or click a Judge Demo button.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
