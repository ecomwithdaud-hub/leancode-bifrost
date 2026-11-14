"""
LeanCode FastAPI Server
Provides REST endpoints and live telemetry for the LeanCode Dashboard.
Runs on http://localhost:8000
"""

import os
import time
import uuid
import threading
from pathlib import Path
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from leancode import (
    LeanCodeEngine,
    LeanCodeConfig,
    Telemetry,
    BudgetExceededError,
    BifrostPaymentRequiredError,
    ActionDeniedError,
)

app = FastAPI(
    title="LeanCode Bifrost Controller",
    description="Backend API for LeanCode Token-Optimized Coding Agent",
    version="1.0.0"
)

# Enable CORS for Next.js frontend on http://localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# SERVER STATE & ACTION GATE
# ==========================================

class ActionRequest:
    def __init__(self, action_id: str, action_type: str, details: Dict[str, Any]):
        self.action_id = action_id
        self.action_type = action_type
        self.details = details
        self.status = "PENDING"  # PENDING, APPROVED, DENIED
        self.created_at = time.time()
        self.event = threading.Event()
        self.result: bool = False


class ServerState:
    def __init__(self):
        self.config = LeanCodeConfig()
        self.engine: Optional[LeanCodeEngine] = None
        self.current_task_id: Optional[str] = None
        self.current_prompt: str = ""
        self.task_thread: Optional[threading.Thread] = None
        self.pending_actions: Dict[str, ActionRequest] = {}
        self.task_history: List[Dict[str, Any]] = []
        self.logs: List[Dict[str, Any]] = []
        self.init_engine()

    def init_engine(self):
        self.engine = LeanCodeEngine(
            config=self.config,
            approval_handler=self.server_approval_handler
        )

    def server_approval_handler(self, action_type: str, details: Dict[str, Any]) -> bool:
        """Blocks execution until approved or denied via dashboard API."""
        act_id = f"act_{uuid.uuid4().hex[:8]}"
        req = ActionRequest(act_id, action_type, details)
        self.pending_actions[act_id] = req

        self.log(f"Action approval required: {action_type} (ID: {act_id})", level="WARNING")

        # Wait up to 5 minutes for human decision
        timeout_occurred = not req.event.wait(timeout=300)
        if timeout_occurred:
            req.status = "TIMEOUT"
            req.result = False
            self.log(f"Action {act_id} timed out. Defaulting to DENIED.", level="ERROR")

        return req.result

    def log(self, message: str, level: str = "INFO"):
        entry = {
            "timestamp": time.time(),
            "time_str": time.strftime("%H:%M:%S"),
            "level": level,
            "message": message
        }
        self.logs.append(entry)
        if len(self.logs) > 200:
            self.logs.pop(0)


state = ServerState()


# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class TaskRequest(BaseModel):
    prompt: str
    confidential: Optional[bool] = None
    budget: Optional[float] = None
    model: Optional[str] = None


class ActionDecision(BaseModel):
    action_id: str
    reason: Optional[str] = None


class ToggleConfidentialRequest(BaseModel):
    enable: Optional[bool] = None


# ==========================================
# WEB DASHBOARD (STANDALONE ZERO-DEPENDENCY UI)
# ==========================================

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LeanCode | Bifrost Live Control Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: "#090d16",
            surface: "#0f172a",
            card: "#182234",
            border: "#1f2d42"
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #090d16; }
    ::-webkit-scrollbar-thumb { background: #1f2d42; border-radius: 3px; }
  </style>
</head>
<body class="text-slate-100 min-h-screen flex flex-col">
  <!-- Header -->
  <header class="border-b border-slate-800 bg-[#0c121e]/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-[2px] shadow-lg shadow-cyan-500/20">
          <div class="w-full h-full bg-[#0c121e] rounded-[10px] flex items-center justify-center font-bold text-cyan-400 text-lg">⚡</div>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">LeanCode</h1>
            <span class="text-xs px-2 py-0.5 rounded-full font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">v1.0</span>
          </div>
          <p class="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
            <span>Bifrost Gateway</span>
            <span class="text-slate-600">•</span>
            <span class="font-mono text-[11px] text-cyan-400">http://localhost:8080/openai/v1</span>
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
          <span class="text-slate-400">Model:</span>
          <span id="active-model-badge" class="font-mono font-medium text-slate-200">openai/gpt-4o-mini</span>
          <span id="failover-badge" class="hidden bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px] font-semibold animate-pulse">FAILOVER ACTIVE</span>
        </div>

        <button id="confidential-btn" onclick="toggleConfidential()" class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40">
          <span id="confidential-icon">🛡️</span>
          <span id="confidential-text">Cloud Permitted</span>
        </button>

        <div class="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800/80 px-2.5 py-1.5 rounded-lg text-xs">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span class="text-[11px] font-mono text-emerald-400">Bifrost Online</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-7xl mx-auto w-full px-6 py-6 flex-1 space-y-6">
    <!-- Row 1: KPI Metrics Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900/60 to-slate-900/90 p-5 shadow-lg shadow-emerald-950/20">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-emerald-400 uppercase tracking-wider">Tokens Saved (Cache)</span>
          <span class="text-emerald-400 text-lg">✨</span>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span id="kpi-tokens-saved" class="text-3xl font-extrabold text-white font-mono tracking-tight">+0</span>
          <span class="text-xs text-emerald-400 font-medium">tokens avoided</span>
        </div>
        <div class="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
          <span id="kpi-cache-hits" class="font-mono font-medium text-emerald-400">0</span>
          <span>SHA-256 cache hit(s)</span>
          <span class="text-slate-600">•</span>
          <span id="kpi-efficiency-pct" class="text-emerald-400/80 font-mono font-medium">0.0% saved</span>
        </div>
      </div>

      <div class="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Tokens Consumed</span>
          <span class="text-cyan-400 text-lg">📊</span>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span id="kpi-tokens-total" class="text-3xl font-extrabold text-white font-mono tracking-tight">0</span>
          <span class="text-xs text-slate-400">total</span>
        </div>
        <div class="mt-2 text-xs text-slate-400 flex items-center gap-2">
          <span>Prompt: <b id="kpi-tokens-prompt" class="font-mono text-slate-200">0</b></span>
          <span class="text-slate-600">•</span>
          <span>Compl: <b id="kpi-tokens-compl" class="font-mono text-slate-200">0</b></span>
        </div>
      </div>

      <div class="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Cumulative Spend</span>
          <span class="text-amber-400 text-lg">💰</span>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span id="kpi-spend-usd" class="text-3xl font-extrabold text-white font-mono tracking-tight">$0.00000</span>
        </div>
        <div class="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>Budget Cap:</span>
          <span id="kpi-budget-cap" class="font-mono font-semibold text-emerald-400">$0.25 USD</span>
        </div>
      </div>

      <div class="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Token Efficiency</span>
          <span class="text-purple-400 text-lg">🎯</span>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span id="kpi-overhead-reduced" class="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">0.0%</span>
          <span class="text-xs text-slate-400">overhead cut</span>
        </div>
        <div class="mt-2 text-xs text-slate-400">
          Line slicing + SHA-256 deduplication
        </div>
      </div>
    </div>

    <!-- Row 2: Spend vs Budget Cap Bar -->
    <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-2">
          <span id="budget-icon">🛡️</span>
          <span class="text-sm font-semibold text-slate-200">Pre-Call Budget Guard (USER_BUDGET_USD)</span>
          <span id="budget-halt-badge" class="hidden bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Execution Halted</span>
        </div>
        <div class="text-xs font-mono">
          <span id="budget-bar-spend" class="text-slate-300 font-bold">$0.00000</span>
          <span class="text-slate-500"> / </span>
          <span id="budget-bar-cap" class="text-slate-400 font-semibold">$0.25 USD</span>
          <span id="budget-bar-pct" class="text-slate-500 ml-2 font-medium">(0.0%)</span>
        </div>
      </div>
      <div class="w-full h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-800 p-[1px]">
        <div id="budget-progress" class="h-full rounded-full transition-all duration-500 bg-emerald-500" style="width: 0%"></div>
      </div>
      <div class="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
        <span>$0.00 (Zero base)</span>
        <span class="text-slate-500">Tiktoken pre-call estimation halts cleanly BEFORE provider call</span>
        <span id="budget-bottom-cap" class="font-semibold text-slate-300">Cap: $0.25</span>
      </div>
    </div>

    <!-- Row 3: Action Approval Gate Cards -->
    <div id="pending-actions-section" class="space-y-4">
      <div id="no-pending-actions" class="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
        <div class="w-10 h-10 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400 mb-2">✅</div>
        <h4 class="text-sm font-semibold text-slate-300">Human Approval Gate Clear</h4>
        <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Read operations (<code class="text-cyan-400">read_file</code>, <code class="text-cyan-400">search_code</code>, <code class="text-cyan-400">list_files</code>) run freely.
          Sensitive operations (<code class="text-rose-400">write_file</code>, <code class="text-rose-400">run_shell</code>) pause here for human approval.
        </p>
      </div>
      <div id="pending-cards-list" class="space-y-4"></div>
    </div>

    <!-- Row 4: Task Execution Console & Hackathon Demo Presets -->
    <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg space-y-4">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="text-cyan-400 font-bold">💻</span>
          <h3 class="text-base font-bold text-slate-100">Live Agent Execution Console</h3>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="seedDemoCache()" class="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900/60 transition-colors">
            <span>✨</span><span>Judge Demo: Cache Hit</span>
          </button>
          <button onclick="simulateFailover()" class="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-950/60 text-amber-300 border border-amber-800/80 hover:bg-amber-900/60 transition-colors">
            <span>🔄</span><span>Judge Demo: Failover</span>
          </button>
        </div>
      </div>

      <div id="toast-banner" class="hidden p-3 rounded-lg bg-cyan-950/40 border border-cyan-800 text-xs text-cyan-300 flex items-center gap-2">
        <span id="toast-msg"></span>
      </div>

      <form onsubmit="submitTask(event)" class="flex gap-2">
        <input id="prompt-input" type="text" placeholder="E.g., Locate the tax calculation function, optimize it, and add tests..." class="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono">
        <button id="dispatch-btn" type="submit" class="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 transition-all">
          <span>▶</span><span>Dispatch Task</span>
        </button>
      </form>

      <div class="rounded-lg bg-[#070b12] border border-slate-800 p-4 font-mono text-xs">
        <div class="flex items-center justify-between text-slate-500 border-b border-slate-800/80 pb-2 mb-2 text-[11px]">
          <span>AGENT LOG STREAM</span>
          <span>BIFROST GATEWAY (localhost:8080)</span>
        </div>
        <div id="log-stream" class="h-64 overflow-y-auto space-y-1.5 pr-2">
          <div class="text-slate-600 text-center py-10 font-sans text-xs">No tasks currently running. Enter a coding task above or click a Judge Demo button.</div>
        </div>
      </div>
    </div>
  </main>

  <footer class="border-t border-slate-900 bg-[#070b12] py-4 px-6 text-center text-xs text-slate-500">
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
      <span>Global AI Hackathon 2026 — Problem Statement 01: Token-Minimizing Coding Agent</span>
      <span>Powered by Maxim AI Bifrost Gateway at <code class="text-cyan-400">http://localhost:8080/openai/v1</code></span>
    </div>
  </footer>

  <script>
    let isConfidential = false;

    async function pollState() {
      try {
        const sRes = await fetch('/api/status');
        const sData = await sRes.json();
        
        isConfidential = sData.confidential_locked;
        updateConfidentialUI(isConfidential);
        document.getElementById('active-model-badge').textContent = sData.candidate_models?.[0] || sData.primary_model;

        const tRes = await fetch('/api/telemetry');
        const tData = await tRes.json();
        const telem = tData.telemetry || {};

        // Metrics
        const saved = telem.tokens_saved_by_cache || 0;
        const total = telem.tokens_total || 0;
        const hits = telem.cache_hits || 0;
        const spend = telem.total_spend_usd || 0;
        const cap = sData.user_budget_usd || 0.25;
        const allProcessed = total + saved;
        const effPct = allProcessed > 0 ? ((saved / allProcessed) * 100).toFixed(1) : "0.0";

        document.getElementById('kpi-tokens-saved').textContent = '+' + saved.toLocaleString();
        document.getElementById('kpi-cache-hits').textContent = hits;
        document.getElementById('kpi-efficiency-pct').textContent = effPct + '% saved';
        document.getElementById('kpi-tokens-total').textContent = total.toLocaleString();
        document.getElementById('kpi-tokens-prompt').textContent = (telem.tokens_prompt || 0).toLocaleString();
        document.getElementById('kpi-tokens-compl').textContent = (telem.tokens_completion || 0).toLocaleString();
        document.getElementById('kpi-spend-usd').textContent = '$' + spend.toFixed(5);
        document.getElementById('kpi-budget-cap').textContent = '$' + cap.toFixed(2) + ' USD';
        document.getElementById('kpi-overhead-reduced').textContent = effPct + '%';

        // Budget Bar
        const pct = Math.min(100, Math.max(0, (spend / cap) * 100));
        document.getElementById('budget-bar-spend').textContent = '$' + spend.toFixed(5);
        document.getElementById('budget-bar-cap').textContent = '$' + cap.toFixed(2) + ' USD';
        document.getElementById('budget-bar-pct').textContent = '(' + pct.toFixed(1) + '%)';
        document.getElementById('budget-bottom-cap').textContent = 'Cap: $' + cap.toFixed(2);
        
        const prog = document.getElementById('budget-progress');
        prog.style.width = pct + '%';
        if (pct >= 90 || telem.status === 'BUDGET_HALTED') {
          prog.className = 'h-full rounded-full transition-all duration-500 bg-rose-500';
          document.getElementById('budget-halt-badge').classList.remove('hidden');
        } else if (pct >= 60) {
          prog.className = 'h-full rounded-full transition-all duration-500 bg-amber-500';
          document.getElementById('budget-halt-badge').classList.add('hidden');
        } else {
          prog.className = 'h-full rounded-full transition-all duration-500 bg-emerald-500';
          document.getElementById('budget-halt-badge').classList.add('hidden');
        }

        // Failover badge
        if (telem.failover_events && telem.failover_events.length > 0) {
          document.getElementById('failover-badge').classList.remove('hidden');
        } else {
          document.getElementById('failover-badge').classList.add('hidden');
        }

        // Pending Actions
        renderPendingActions(tData.pending_actions || []);

        // Logs
        renderLogs(tData.logs || []);

      } catch(e) {
        console.error(e);
      }
    }

    function updateConfidentialUI(isConf) {
      const btn = document.getElementById('confidential-btn');
      const icon = document.getElementById('confidential-icon');
      const text = document.getElementById('confidential-text');

      if (isConf) {
        btn.className = "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border bg-rose-950/60 text-rose-300 border-rose-800 shadow-lg shadow-rose-950/30";
        icon.textContent = "🔒";
        text.textContent = "CONFIDENTIAL LOCK (Local Ollama Only)";
      } else {
        btn.className = "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40";
        icon.textContent = "🛡️";
        text.textContent = "Cloud Permitted";
      }
    }

    function renderPendingActions(actions) {
      const emptyDiv = document.getElementById('no-pending-actions');
      const listDiv = document.getElementById('pending-cards-list');

      if (!actions || actions.length === 0) {
        emptyDiv.classList.remove('hidden');
        listDiv.innerHTML = '';
        return;
      }

      emptyDiv.classList.add('hidden');
      listDiv.innerHTML = actions.map(act => `
        <div class="rounded-xl border-2 border-amber-500/50 bg-[#131b2c] p-5 shadow-xl shadow-amber-950/20">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div class="flex items-center gap-2">
              <span class="p-2 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs uppercase">${act.action_type}</span>
              <span class="text-xs text-slate-400">ID: ${act.action_id}</span>
            </div>
            <span class="text-[11px] text-amber-400 font-semibold animate-pulse">⏳ Human Decision Required</span>
          </div>
          <div class="space-y-2 mb-4 text-xs font-mono">
            ${act.action_type === 'write_file' ? `
              <div class="text-slate-300">Target Path: <b class="text-cyan-300">${act.details?.path}</b> (${act.details?.bytes} bytes)</div>
              ${act.details?.content_preview ? `<pre class="mt-2 p-3 rounded-lg bg-[#090d16] border border-slate-800 max-h-40 overflow-y-auto text-[11px] text-slate-300 whitespace-pre-wrap">${act.details.content_preview}</pre>` : ''}
            ` : `
              <div class="text-slate-300">Command: <b class="text-purple-300 bg-slate-950 px-2 py-1 rounded border border-slate-800">${act.details?.command}</b></div>
            `}
          </div>
          <div class="flex items-center justify-end gap-3 pt-2">
            <button onclick="denyAction('${act.action_id}')" class="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 transition-colors">
              ✖ Deny [N]
            </button>
            <button onclick="approveAction('${act.action_id}')" class="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all">
              ✔ Approve & Execute [Y]
            </button>
          </div>
        </div>
      `).join('');
    }

    function renderLogs(logs) {
      const stream = document.getElementById('log-stream');
      if (!logs || logs.length === 0) return;
      stream.innerHTML = logs.map(l => {
        let col = "text-slate-400";
        if (l.level === "WARNING") col = "text-amber-400";
        if (l.level === "ERROR") col = "text-rose-400";
        if (l.level === "SUCCESS") col = "text-emerald-400";
        return `<div class="flex items-start gap-2 text-slate-300 leading-relaxed"><span class="text-slate-600 shrink-0 text-[10px]">${l.time_str || "NOW"}</span><span class="shrink-0 font-bold text-[10px] ${col}">[${l.level}]</span><span class="text-slate-200 break-words">${l.message}</span></div>`;
      }).join('');
    }

    function showToast(msg) {
      const toast = document.getElementById('toast-banner');
      document.getElementById('toast-msg').textContent = msg;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 4000);
    }

    async function submitTask(e) {
      e.preventDefault();
      const input = document.getElementById('prompt-input');
      const val = input.value.trim();
      if (!val) return;
      input.value = '';
      showToast("Dispatching task to LeanCode engine...");
      await fetch('/api/task', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt: val})
      });
      pollState();
    }

    async function approveAction(actId) {
      await fetch('/api/action/approve', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action_id: actId})
      });
      pollState();
    }

    async function denyAction(actId) {
      await fetch('/api/action/deny', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action_id: actId, reason: "Rejected via Dashboard"})
      });
      pollState();
    }

    async function toggleConfidential() {
      await fetch('/api/confidential/toggle', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({})
      });
      showToast("Toggled .confidential repository marker!");
      pollState();
    }

    async function seedDemoCache() {
      showToast("Seeding demo files and priming SHA-256 cache...");
      await fetch('/api/demo/seed-cache', {method: 'POST'});
      showToast("SHA-256 Cache primed! Watch 'Tokens Saved' increment.");
      pollState();
    }

    async function simulateFailover() {
      showToast("Simulating 429 Provider Rate Limit on primary model...");
      await fetch('/api/demo/simulate-failover', {method: 'POST'});
      showToast("Failover triggered! Switched to fallback model.");
      pollState();
    }

    setInterval(pollState, 1500);
    pollState();
  </script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def get_dashboard():
    """Serve the complete dark-mode Live Control Dashboard."""
    return HTMLResponse(content=DASHBOARD_HTML)


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "LeanCode Bifrost Controller"}


@app.get("/api/status")
def get_status():
    """Returns gateway configuration, model chain, and privacy lock status."""
    confidential_marker = (state.config.workspace_root / ".confidential").exists()
    is_conf = state.config.is_confidential()
    candidate_models = state.engine.get_candidate_models() if state.engine else []

    return {
        "bifrost_base_url": state.config.bifrost_base_url,
        "confidential_marker_file_present": confidential_marker,
        "confidential_locked": is_conf,
        "primary_model": state.config.primary_model,
        "fallback_models": state.config.fallback_models,
        "local_confidential_model": state.config.local_confidential_model,
        "candidate_models": candidate_models,
        "user_budget_usd": state.config.user_budget_usd,
        "workspace_root": str(state.config.workspace_root),
        "active_task": state.current_task_id,
        "task_running": state.task_thread is not None and state.task_thread.is_alive()
    }


@app.get("/api/telemetry")
def get_telemetry():
    """Fetch live telemetry, cache savings, spend vs budget, and logs."""
    engine_telem = state.engine.telemetry.to_dict() if state.engine else {}
    pending_list = [
        {
            "action_id": req.action_id,
            "action_type": req.action_type,
            "details": req.details,
            "status": req.status,
            "created_at": req.created_at
        }
        for req in state.pending_actions.values()
        if req.status == "PENDING"
    ]

    return {
        "telemetry": engine_telem,
        "pending_actions": pending_list,
        "logs": state.logs[-50:],
        "current_prompt": state.current_prompt,
        "active_task_id": state.current_task_id,
        "is_running": state.task_thread is not None and state.task_thread.is_alive()
    }


@app.post("/api/task")
def submit_task(req: TaskRequest, bg: BackgroundTasks):
    """Submit a coding task to the LeanCode agent."""
    if state.task_thread is not None and state.task_thread.is_alive():
        raise HTTPException(status_code=400, detail="A task is already running. Please wait for completion.")

    # Re-initialize engine with updated parameters if supplied
    if req.confidential is not None:
        state.config.confidential_override = req.confidential
    if req.budget is not None:
        state.config.user_budget_usd = req.budget
    if req.model:
        state.config.primary_model = req.model

    state.init_engine()
    state.current_prompt = req.prompt
    task_id = state.engine.telemetry.task_id
    state.current_task_id = task_id

    state.log(f"Starting task '{task_id}': {req.prompt[:60]}...", level="INFO")

    def run_worker():
        try:
            res = state.engine.run_task(req.prompt)
            state.task_history.append({
                "task_id": task_id,
                "prompt": req.prompt,
                "result": res,
                "completed_at": time.time()
            })
            state.log(f"Task '{task_id}' concluded with status: {res['status']}", level="INFO")
        except Exception as e:
            state.log(f"Task '{task_id}' error: {str(e)}", level="ERROR")

    t = threading.Thread(target=run_worker, daemon=True)
    state.task_thread = t
    t.start()

    return {
        "status": "ACCEPTED",
        "task_id": task_id,
        "prompt": req.prompt,
        "candidate_models": state.engine.get_candidate_models(),
        "confidential_locked": state.engine.telemetry.confidential_locked
    }


@app.get("/api/actions/pending")
def get_pending_actions():
    """List all actions awaiting human approval."""
    return [
        {
            "action_id": req.action_id,
            "action_type": req.action_type,
            "details": req.details,
            "status": req.status,
            "created_at": req.created_at
        }
        for req in state.pending_actions.values()
        if req.status == "PENDING"
    ]


@app.post("/api/action/approve")
def approve_action(decision: ActionDecision):
    """Human approval gate: Approve a pending write_file or run_shell action."""
    req = state.pending_actions.get(decision.action_id)
    if not req:
        raise HTTPException(status_code=404, detail="Action ID not found.")
    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Action is already {req.status}.")

    req.status = "APPROVED"
    req.result = True
    req.event.set()
    state.log(f"Action {decision.action_id} ({req.action_type}) APPROVED by user.", level="SUCCESS")
    return {"status": "APPROVED", "action_id": decision.action_id}


@app.post("/api/action/deny")
def deny_action(decision: ActionDecision):
    """Human approval gate: Deny a pending write_file or run_shell action."""
    req = state.pending_actions.get(decision.action_id)
    if not req:
        raise HTTPException(status_code=404, detail="Action ID not found.")
    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Action is already {req.status}.")

    req.status = "DENIED"
    req.result = False
    req.event.set()
    state.log(f"Action {decision.action_id} ({req.action_type}) DENIED by user: {decision.reason or 'User rejected'}", level="WARNING")
    return {"status": "DENIED", "action_id": decision.action_id}


@app.post("/api/confidential/toggle")
def toggle_confidential(req: ToggleConfidentialRequest):
    """
    Toggle OS-level .confidential marker file in workspace root.
    Allows live demonstration of prompt-injection immune model lock.
    """
    marker = state.config.workspace_root / ".confidential"
    currently_exists = marker.exists()

    should_enable = req.enable if req.enable is not None else (not currently_exists)

    if should_enable:
        marker.write_text("CONFIDENTIAL REPOSITORY - RESTRICTED TO LOCAL OLLAMA MODELS ONLY\n", encoding="utf-8")
        state.config.confidential_override = None
        state.log("OS-level '.confidential' marker created. Cloud models stripped.", level="WARNING")
    else:
        if marker.exists():
            marker.unlink()
        state.config.confidential_override = False
        state.log("OS-level '.confidential' marker removed. Cloud routing restored.", level="INFO")

    state.init_engine()
    return {
        "confidential_marker_present": marker.exists(),
        "confidential_locked": state.config.is_confidential(),
        "candidate_models": state.engine.get_candidate_models()
    }


@app.post("/api/demo/simulate-failover")
def simulate_failover():
    """Simulate a provider failover event for live hackathon demonstration."""
    if not state.engine:
        state.init_engine()

    event = {
        "failed_model": state.config.primary_model,
        "error": "RateLimitError: 429 Too Many Requests - Provider capacity exceeded",
        "next_model": state.config.fallback_models[0] if state.config.fallback_models else "ollama/qwen2.5-coder:7b",
        "timestamp": time.time()
    }
    state.engine.telemetry.failover_events.append(event)
    state.engine.telemetry.active_model = event["next_model"]
    state.log(
        f"[DEMO FAILOVER] Primary '{event['failed_model']}' failed (429 RateLimit). Failing over to '{event['next_model']}' via Bifrost.",
        level="WARNING"
    )
    return {"status": "SIMULATED", "event": event}


@app.post("/api/demo/seed-cache")
def seed_cache_demo():
    """Seed cache with sample files so judges can immediately see SHA-256 cache hits."""
    sample_file = state.config.workspace_root / "example_module.py"
    sample_code = (
        "# Example Module for Hackathon Demo\n"
        "def compute_tax(subtotal: float, rate: float = 0.08) -> float:\n"
        "    \"\"\"Calculates sales tax.\"\"\"\n"
        "    return round(subtotal * rate, 2)\n\n"
        "def format_currency(amount: float) -> str:\n"
        "    return f'${amount:,.2f}'\n"
    )
    sample_file.write_text(sample_code, encoding="utf-8")

    # Read once to prime cache
    res1 = state.engine.tool_read_file("example_module.py")
    # Read again to trigger cache hit
    res2 = state.engine.tool_read_file("example_module.py")

    state.log("Seeded demo file 'example_module.py' and triggered SHA-256 cache hit!", level="SUCCESS")
    return {
        "first_read_preview": res1[:100],
        "second_read_result": res2,
        "tokens_saved": state.engine.telemetry.tokens_saved_by_cache,
        "cache_hits": state.engine.telemetry.cache_hits
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
