"use client";

import React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface BudgetBarProps {
  totalSpend: number;
  budgetCap: number;
  status: string;
}

export const BudgetBar: React.FC<BudgetBarProps> = ({ totalSpend, budgetCap, status }) => {
  const percentage = Math.min(100, Math.max(0, (totalSpend / (budgetCap || 0.25)) * 100));
  const isHalted = status === "BUDGET_HALTED";

  // Determine progress color
  let barColor = "bg-[#a3e635]";
  if (percentage >= 90 || isHalted) {
    barColor = "bg-rose-500";
  } else if (percentage >= 60) {
    barColor = "bg-amber-400";
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0f1218] p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          {isHalted ? (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          )}
          <span className="text-xs font-semibold text-slate-200">
            Pre-Call Budget Guard (USER_BUDGET_USD)
          </span>
          {isHalted && (
            <span className="bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-mono px-2 py-0.5 rounded uppercase">
              Execution Halted
            </span>
          )}
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-300">
          <span className="font-semibold text-slate-100">${totalSpend.toFixed(5)}</span>
          <span className="text-slate-500"> / </span>
          <span className="text-slate-400">${budgetCap.toFixed(2)} USD</span>
          <span className="text-slate-500 ml-1.5 font-normal">({percentage.toFixed(1)}%)</span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 rounded-full bg-white/[0.04] overflow-hidden border border-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>$0.00 base</span>
        <span className="hidden sm:inline text-slate-500 font-sans">
          tiktoken pre-call estimation halts before exceeding cap
        </span>
        <span className="text-slate-400">Cap: ${budgetCap.toFixed(2)}</span>
      </div>
    </div>
  );
};
