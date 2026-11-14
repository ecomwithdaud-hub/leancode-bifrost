"use client";

import React from "react";

interface MetricsCardsProps {
  telemetry: any;
  budgetCap: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ telemetry, budgetCap }) => {
  const promptTokens = telemetry?.tokens_prompt || 0;
  const compTokens = telemetry?.tokens_completion || 0;
  const totalTokens = telemetry?.tokens_total || 0;
  const savedTokens = telemetry?.tokens_saved_by_cache || 0;
  const cacheHits = telemetry?.cache_hits || 0;
  const totalSpend = telemetry?.total_spend_usd || 0;

  // Calculate efficiency percentage
  const totalProcessed = totalTokens + savedTokens;
  const efficiency = totalProcessed > 0 ? ((savedTokens / totalProcessed) * 100).toFixed(1) : "0.0";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Tokens Saved by Cache */}
      <div className="rounded-xl border border-white/[0.08] hover:border-white/15 bg-[#0f1218] p-4 flex flex-col justify-between transition-colors">
        <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
          Tokens Saved (Cache)
        </span>
        <div className="my-2.5">
          <span className="text-3xl font-semibold text-slate-100 font-mono tracking-tight tabular-nums">
            +{savedTokens.toLocaleString()}
          </span>
        </div>
        <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 tabular-nums">
          <span className="text-slate-300 font-semibold">{cacheHits}</span>
          <span>cache hits</span>
          <span>·</span>
          <span className="text-slate-400">{efficiency}% saved</span>
        </div>
      </div>

      {/* 2. Tokens Consumed */}
      <div className="rounded-xl border border-white/[0.08] hover:border-white/15 bg-[#0f1218] p-4 flex flex-col justify-between transition-colors">
        <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
          Tokens Consumed
        </span>
        <div className="my-2.5">
          <span className="text-3xl font-semibold text-slate-100 font-mono tracking-tight tabular-nums">
            {totalTokens.toLocaleString()}
          </span>
        </div>
        <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 tabular-nums">
          <span>Prompt: <span className="text-slate-300">{promptTokens.toLocaleString()}</span></span>
          <span>·</span>
          <span>Compl: <span className="text-slate-300">{compTokens.toLocaleString()}</span></span>
        </div>
      </div>

      {/* 3. Spend vs Cap */}
      <div className="rounded-xl border border-white/[0.08] hover:border-white/15 bg-[#0f1218] p-4 flex flex-col justify-between transition-colors">
        <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
          Cumulative Spend
        </span>
        <div className="my-2.5">
          <span className="text-3xl font-semibold text-slate-100 font-mono tracking-tight tabular-nums">
            ${totalSpend.toFixed(5)}
          </span>
        </div>
        <div className="text-xs text-slate-500 font-mono flex items-center justify-between tabular-nums">
          <span>Budget cap:</span>
          <span className="text-slate-300 font-medium">${budgetCap.toFixed(2)} USD</span>
        </div>
      </div>

      {/* 4. Token Reduction Efficiency */}
      <div className="rounded-xl border border-white/[0.08] hover:border-white/15 bg-[#0f1218] p-4 flex flex-col justify-between transition-colors">
        <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
          Token Cost Efficiency
        </span>
        <div className="my-2.5">
          <span className="text-3xl font-semibold text-slate-100 font-mono tracking-tight tabular-nums">
            {efficiency}%
          </span>
        </div>
        <div className="text-xs text-slate-500">
          Line slicing + SHA-256 deduplication
        </div>
      </div>
    </div>
  );
};
