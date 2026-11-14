"use client";

import React from "react";
import { Shield, ShieldAlert, Cpu, Zap, Radio } from "lucide-react";

interface HeaderProps {
  status: any;
  telemetry: any;
  onToggleConfidential: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  telemetry,
  onToggleConfidential,
}) => {
  const isConfidential = status?.confidential_locked || telemetry?.confidential_locked;
  const activeModel = telemetry?.active_model || status?.candidate_models?.[0] || status?.primary_model || "openai/gpt-4o-mini";
  const hasFailover = (telemetry?.failover_events?.length || 0) > 0;

  return (
    <header className="border-b border-slate-800 bg-[#0c121e]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-[2px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-[#0c121e] rounded-[10px] flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                LeanCode
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>Bifrost Gateway</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-[11px] text-cyan-400/90">http://localhost:8080/openai/v1</span>
            </p>
          </div>
        </div>

        {/* Badges and Indicators */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Active Model & Failover Badge */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Model:</span>
            <span className="font-mono font-medium text-slate-200">
              {activeModel}
            </span>
            {hasFailover && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px] font-semibold animate-pulse">
                FAILOVER ACTIVE
              </span>
            )}
          </div>

          {/* Confidential Lock Indicator */}
          <button
            onClick={onToggleConfidential}
            title="Click to toggle .confidential repository marker"
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
              isConfidential
                ? "bg-rose-950/50 text-rose-300 border-rose-800/80 hover:bg-rose-900/50 shadow-lg shadow-rose-950/30"
                : "bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40"
            }`}
          >
            {isConfidential ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>CONFIDENTIAL LOCK (Local Ollama Only)</span>
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cloud Permitted</span>
              </>
            )}
          </button>

          {/* Gateway Status Pulse */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800/80 px-2.5 py-1.5 rounded-lg text-xs text-slate-300">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono text-emerald-400">Bifrost Online</span>
          </div>
        </div>
      </div>
    </header>
  );
};
