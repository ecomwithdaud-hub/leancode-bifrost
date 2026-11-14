"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { RoutingPipeline } from "@/components/RoutingPipeline";
import { MetricsCards } from "@/components/MetricsCards";
import { BudgetBar } from "@/components/BudgetBar";
import { PendingActions } from "@/components/PendingActions";
import { TaskConsole } from "@/components/TaskConsole";
import { TeamModal } from "@/components/TeamModal";

const API_BASE = "http://localhost:8000";

const HERO_PHRASES = [
  "Spend fewer tokens.",
  "Slice files, not budgets.",
  "Enforce local privacy.",
];

export default function Dashboard() {
  const [status, setStatus] = useState<any>(null);
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");

  // Animation states
  const [mounted, setMounted] = useState<boolean>(false);
  const [phraseIndex, setPhraseIndex] = useState<number>(0);
  const [phraseFading, setPhraseFading] = useState<boolean>(false);
  const [pipelineTrigger, setPipelineTrigger] = useState<number>(0);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      // 1. Status
      const sRes = await fetch(`${API_BASE}/api/status`);
      if (sRes.ok) {
        const sJson = await sRes.json();
        setStatus(sJson);
      }

      // 2. Telemetry & Pending Actions
      const tRes = await fetch(`${API_BASE}/api/telemetry`);
      if (tRes.ok) {
        const tJson = await tRes.json();
        setTelemetryData(tJson.telemetry);
        setPendingActions(tJson.pending_actions || []);
        setLogs(tJson.logs || []);
        setIsRunning(tJson.is_running || false);
        setCurrentPrompt(tJson.current_prompt || "");
      }
    } catch (e) {
      // Server not reachable yet
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();
    const interval = setInterval(fetchData, 1500);

    // Rotating headline phrase interval every 3.5s
    const phraseInterval = setInterval(() => {
      setPhraseFading(true);
      setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % HERO_PHRASES.length);
        setPhraseFading(false);
      }, 260);
    }, 3500);

    return () => {
      clearInterval(interval);
      clearInterval(phraseInterval);
    };
  }, []);

  const handleRunTask = async (prompt: string) => {
    try {
      setPipelineTrigger((prev) => prev + 1);
      const res = await fetch(`${API_BASE}/api/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Failed to submit task", e);
    }
  };

  const handleApproveAction = async (actionId: string) => {
    try {
      setPipelineTrigger((prev) => prev + 1);
      await fetch(`${API_BASE}/api/action/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: actionId }),
      });
      fetchData();
    } catch (e) {
      console.error("Approval error", e);
    }
  };

  const handleDenyAction = async (actionId: string, reason?: string) => {
    try {
      await fetch(`${API_BASE}/api/action/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: actionId, reason }),
      });
      fetchData();
    } catch (e) {
      console.error("Denial error", e);
    }
  };

  const handleToggleConfidential = async () => {
    try {
      setPipelineTrigger((prev) => prev + 1);
      await fetch(`${API_BASE}/api/confidential/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      fetchData();
    } catch (e) {
      console.error("Confidential toggle error", e);
    }
  };

  const handleSeedCache = async () => {
    try {
      setPipelineTrigger((prev) => prev + 1);
      await fetch(`${API_BASE}/api/demo/seed-cache`, { method: "POST" });
      fetchData();
    } catch (e) {
      console.error("Seed cache error", e);
    }
  };

  const handleSimulateFailover = async () => {
    try {
      setPipelineTrigger((prev) => prev + 1);
      await fetch(`${API_BASE}/api/demo/simulate-failover`, { method: "POST" });
      fetchData();
    } catch (e) {
      console.error("Failover simulation error", e);
    }
  };

  const totalSpend = telemetryData?.total_spend_usd || 0;
  const budgetCap = status?.user_budget_usd || 0.25;
  const agentStatus = telemetryData?.status || "INITIALIZED";
  const isConfidential = status?.confidential_locked || telemetryData?.confidential_locked;
  const activeModel =
    telemetryData?.active_model ||
    status?.candidate_models?.[0] ||
    status?.primary_model ||
    "openai/gpt-4o-mini";
  const cacheHits = telemetryData?.cache_hits || 0;
  const tokensSaved = telemetryData?.tokens_saved_by_cache || 0;

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 flex flex-col">
      {/* Minimal Top Bar */}
      <Header
        status={status}
        telemetry={telemetryData}
        onToggleConfidential={handleToggleConfidential}
        onOpenTeam={() => setIsTeamModalOpen(true)}
      />

      {/* Team Zepra Tech Modal */}
      <TeamModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 space-y-4">
        {/* 2-Column Hero Section with Staggered Fade-Up */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1 pb-2">
          {/* Left: Eyebrow + Live Dot + Rotating Headline + Subtitle (7 cols) */}
          <div
            className={`lg:col-span-7 space-y-2 transition-all duration-[450ms] ease-out transform ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            {/* Live Pulsing Dot + Eyebrow */}
            <div className="flex items-center gap-2 text-[11px] font-mono font-semibold tracking-wider text-[#a3e635] uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#a3e635] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#a3e635]"></span>
              </span>
              <span>GLOBAL AI HACKATHON · PROBLEM 01</span>
            </div>

            {/* Stacked Headline with Rotating Second Line */}
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              <span className="text-[#f1f5f9] block">Get the job done.</span>
              <div className="h-[1.25em] overflow-hidden relative">
                <span
                  className={`text-[#64748b] block transition-all duration-300 transform ${
                    phraseFading
                      ? "opacity-0 -translate-y-2"
                      : "opacity-100 translate-y-0"
                  }`}
                >
                  {HERO_PHRASES[phraseIndex]}
                </span>
              </div>
            </h2>

            {/* Subtitle with Inline Monospace Pill for localhost:8080 */}
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl leading-relaxed">
              Token-minimizing coding agent routing through Maxim AI’s Bifrost Gateway at{" "}
              <code className="bg-white/[0.04] border border-white/10 rounded px-1.5 py-0.5 text-slate-200 font-mono text-xs">
                localhost:8080
              </code>{" "}
              with SHA-256 caching and precision slicing.
            </p>
          </div>

          {/* Right: Privacy Routing Info Card (5 cols) */}
          <div
            className={`lg:col-span-5 rounded-xl border border-white/[0.08] hover:border-white/15 bg-[#0f1218] p-4 space-y-2 transition-all duration-[450ms] ease-out delay-100 transform ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
                Privacy routing
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isConfidential
                    ? "bg-rose-950/40 text-rose-300 border-rose-800/60"
                    : "bg-white/[0.04] text-slate-400 border-white/[0.08]"
                }`}
              >
                {isConfidential ? "LOCAL OLLAMA LOCKED" : "CLOUD FALLBACK READY"}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Detects OS-level <code className="text-slate-300 font-mono text-[11px]">.confidential</code> marker file or <code className="text-slate-300 font-mono text-[11px]">CONFIDENTIAL_REPO=true</code> before building requests, physically enforcing local-only Ollama inference and stripping cloud models in Python.
            </p>
          </div>
        </div>

        {/* Sequential Typewriter-Style Routing Pipeline */}
        <RoutingPipeline
          activeModel={activeModel}
          isConfidential={Boolean(isConfidential)}
          cacheHits={cacheHits}
          tokensSaved={tokensSaved}
          budgetCap={budgetCap}
          triggerKey={pipelineTrigger}
        />

        {/* Row 1: KPI Metrics Cards */}
        <MetricsCards telemetry={telemetryData} budgetCap={budgetCap} />

        {/* Row 2: Pre-Call Budget Cap Enforcement Bar */}
        <BudgetBar
          totalSpend={totalSpend}
          budgetCap={budgetCap}
          status={agentStatus}
        />

        {/* Row 3: Side-by-Side Bottom Workspace (Task Console 7 cols, Approval Gate 5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-7">
            <TaskConsole
              isRunning={isRunning}
              logs={logs}
              currentPrompt={currentPrompt}
              onRunTask={handleRunTask}
              onSeedCache={handleSeedCache}
              onSimulateFailover={handleSimulateFailover}
            />
          </div>

          <div className="lg:col-span-5">
            <PendingActions
              actions={pendingActions}
              onApprove={handleApproveAction}
              onDeny={handleDenyAction}
            />
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-white/[0.06] bg-[#090b10] py-3.5 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-mono text-[11px]">
            Built by{" "}
            <a
              href="https://gozepra.tech/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-[#a3e635] underline decoration-white/20 hover:decoration-[#a3e635] transition-colors"
            >
              Team Zepra Tech
            </a>{" "}
            · Global AI Hackathon 2026
          </span>
          <span className="text-[11px]">
            Bifrost Gateway: <code className="text-slate-400 font-mono">http://localhost:8080/openai/v1</code>
          </span>
        </div>
      </footer>
    </div>
  );
}
