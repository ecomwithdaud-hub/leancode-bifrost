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
  let barColor = "bg-emerald-500";
  if (percentage >= 90 || isHalted) {
    barColor = "bg-rose-500";
  } else if (percentage >= 60) {
    barColor = "bg-amber-500";
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {isHalted ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          )}
          <span className="text-sm font-semibold text-slate-200">
            Pre-Call Budget Guard (USER_BUDGET_USD)
          </span>
          {isHalted && (
            <span className="bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
              Execution Halted
            </span>
          )}
        </div>
        <div className="text-xs font-mono">
          <span className="text-slate-300 font-bold">${totalSpend.toFixed(5)}</span>
          <span className="text-slate-500"> / </span>
          <span className="text-slate-400 font-semibold">${budgetCap.toFixed(2)} USD</span>
          <span className="text-slate-500 ml-2 font-medium">({percentage.toFixed(1)}%)</span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-800 p-[1px]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
        <span>$0.00 (Zero base)</span>
        <span className="text-center text-slate-500">
          Tiktoken pre-call estimation halts cleanly BEFORE provider call
        </span>
        <span className="font-semibold text-slate-300">Cap: ${budgetCap.toFixed(2)}</span>
      </div>
    </div>
  );
};
