"use client";

import React from "react";
import { Shield, ShieldAlert, Cpu } from "lucide-react";

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
  const activeModel =
    telemetry?.active_model ||
    status?.candidate_models?.[0] ||
    status?.primary_model ||
    "openai/gpt-4o-mini";
  const hasFailover = (telemetry?.failover_events?.length || 0) > 0;

  return (
    <header className="border-b border-white/[0.08] bg-[#090b10]/95 backdrop-blur-md sticky top-0 z-30 px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Brand: Left compact L square badge + LeanCode (AI coding agent · control room) */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-[#a3e635] text-[#090b10] font-mono font-bold flex items-center justify-center text-sm tracking-tight select-none">
            L
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-100 tracking-tight">
              LeanCode
            </span>
            <span className="text-xs text-slate-500 font-normal">
              AI coding agent · control room
            </span>
          </div>
        </div>

        {/* Right side: Active model, Failover, Confidential toggle, Bifrost Online pill */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Model Indicator */}
          <div className="flex items-center gap-1.5 bg-[#0f1218] border border-white/[0.08] rounded-md px-2.5 py-1 text-xs">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 text-[11px]">Model:</span>
            <span className="font-mono text-slate-200 text-xs">
              {activeModel}
            </span>
            {hasFailover && (
              <span className="ml-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded text-[10px] font-mono">
                FAILOVER
              </span>
            )}
          </div>

          {/* Interactive Cloud Permitted / Confidential toggle button */}
          <button
            onClick={onToggleConfidential}
            title="Click to toggle .confidential repository marker"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors border ${
              isConfidential
                ? "bg-rose-950/30 text-rose-300 border-rose-800/50 hover:bg-rose-900/40"
                : "bg-[#0f1218] text-slate-300 border-white/[0.08] hover:bg-white/[0.04]"
            }`}
          >
            {isConfidential ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-mono">Confidential (Local-only)</span>
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>Cloud Permitted</span>
              </>
            )}
          </button>

          {/* Live Status Pill: Bifrost Online */}
          <div className="flex items-center gap-2 bg-[#0f1218] border border-white/[0.08] px-2.5 py-1 rounded-md text-xs text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635]"></span>
            <span className="font-mono text-[11px] text-slate-300">Bifrost Online</span>
          </div>
        </div>
      </div>
    </header>
  );
};
