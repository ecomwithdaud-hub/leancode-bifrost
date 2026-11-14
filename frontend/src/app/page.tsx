"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { MetricsCards } from "@/components/MetricsCards";
import { BudgetBar } from "@/components/BudgetBar";
import { PendingActions } from "@/components/PendingActions";
import { TaskConsole } from "@/components/TaskConsole";

const API_BASE = "http://localhost:8000";

export default function Dashboard() {
  const [status, setStatus] = useState<any>(null);
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");

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
    fetchData();
    const interval = setInterval(fetchData, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleRunTask = async (prompt: string) => {
    try {
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
      await fetch(`${API_BASE}/api/demo/seed-cache`, { method: "POST" });
      fetchData();
    } catch (e) {
      console.error("Seed cache error", e);
    }
  };

  const handleSimulateFailover = async () => {
    try {
      await fetch(`${API_BASE}/api/demo/simulate-failover`, { method: "POST" });
      fetchData();
    } catch (e) {
      console.error("Failover simulation error", e);
    }
  };

  const totalSpend = telemetryData?.total_spend_usd || 0;
  const budgetCap = status?.user_budget_usd || 0.25;
  const agentStatus = telemetryData?.status || "INITIALIZED";

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Header with Bifrost status, Model badge & Confidential toggle */}
      <Header
        status={status}
        telemetry={telemetryData}
        onToggleConfidential={handleToggleConfidential}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 space-y-6">
        {/* Row 1: KPI Metrics Cards */}
        <MetricsCards telemetry={telemetryData} budgetCap={budgetCap} />

        {/* Row 2: Pre-Call Budget Cap Enforcement Bar */}
        <BudgetBar
          totalSpend={totalSpend}
          budgetCap={budgetCap}
          status={agentStatus}
        />

        {/* Row 3: Action Approval Gate Cards (Write / Shell) */}
        <PendingActions
          actions={pendingActions}
          onApprove={handleApproveAction}
          onDeny={handleDenyAction}
        />

        {/* Row 4: Task Execution Console & Hackathon Demo Presets */}
        <TaskConsole
          isRunning={isRunning}
          logs={logs}
          currentPrompt={currentPrompt}
          onRunTask={handleRunTask}
          onSeedCache={handleSeedCache}
          onSimulateFailover={handleSimulateFailover}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#070b12] py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Global AI Hackathon 2026 — Problem Statement 01: Token-Minimizing Coding Agent</span>
          <span>Powered by Maxim AI Bifrost Gateway at <code className="text-cyan-400">http://localhost:8080/openai/v1</code></span>
        </div>
      </footer>
    </div>
  );
}
