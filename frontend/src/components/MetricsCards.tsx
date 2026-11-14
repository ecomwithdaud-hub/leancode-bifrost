"use client";

import React from "react";
import { Sparkles, Database, Coins, ArrowDownRight, Layers } from "lucide-react";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Tokens Saved by Cache */}
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900/60 to-slate-900/90 p-5 shadow-lg shadow-emerald-950/20">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
            Tokens Saved (Cache)
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
            +{savedTokens.toLocaleString()}
          </span>
          <span className="text-xs text-emerald-400 font-medium">tokens avoided</span>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
          <span className="font-mono font-medium text-emerald-400">{cacheHits}</span>
          <span>SHA-256 cache hit(s)</span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400/80 font-mono font-medium">{efficiency}% saved</span>
        </div>
      </div>

      {/* 2. Tokens Consumed */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Tokens Consumed
          </span>
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
            {totalTokens.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400">total</span>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
          <span>Prompt: <b className="font-mono text-slate-200">{promptTokens.toLocaleString()}</b></span>
          <span className="text-slate-600">•</span>
          <span>Compl: <b className="font-mono text-slate-200">{compTokens.toLocaleString()}</b></span>
        </div>
      </div>

      {/* 3. Spend vs Cap */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Cumulative Spend
          </span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Coins className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
            ${totalSpend.toFixed(5)}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>Budget Cap:</span>
          <span className="font-mono font-semibold text-emerald-400">${budgetCap.toFixed(2)} USD</span>
        </div>
      </div>

      {/* 4. Token Reduction Efficiency */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Token Cost Efficiency
          </span>
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
            {efficiency}%
          </span>
          <span className="text-xs text-slate-400">overhead reduced</span>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Line slicing + SHA-256 deduplication
        </div>
      </div>
    </div>
  );
};
