"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, XCircle, FileCode, Terminal, Clock } from "lucide-react";

interface PendingAction {
  action_id: string;
  action_type: string;
  details: any;
  status: string;
  created_at: number;
}

interface PendingActionsProps {
  actions: PendingAction[];
  onApprove: (actionId: string) => Promise<void>;
  onDeny: (actionId: string, reason?: string) => Promise<void>;
}

export const PendingActions: React.FC<PendingActionsProps> = ({
  actions,
  onApprove,
  onDeny,
}) => {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const handleDecision = async (actionId: string, approved: boolean) => {
    setLoadingMap((prev) => ({ ...prev, [actionId]: true }));
    try {
      if (approved) {
        await onApprove(actionId);
      } else {
        await onDeny(actionId, "User rejected via Dashboard Control");
      }
    } finally {
      setLoadingMap((prev) => ({ ...prev, [actionId]: false }));
    }
  };

  if (!actions || actions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400 mb-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <h4 className="text-sm font-semibold text-slate-300">Human Approval Gate Clear</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Read operations (<code className="text-cyan-400">read_file</code>, <code className="text-cyan-400">search_code</code>, <code className="text-cyan-400">list_files</code>) run freely.
          Sensitive operations (<code className="text-rose-400">write_file</code>, <code className="text-rose-400">run_shell</code>) will pause here for explicit human approval.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-amber-400 animate-pulse" />
        <h3 className="text-base font-bold text-slate-100">
          Action Approval Required ({actions.length} Pending)
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {actions.map((act) => {
          const isLoading = loadingMap[act.action_id];
          const isWrite = act.action_type === "write_file";

          return (
            <div
              key={act.action_id}
              className="rounded-xl border-2 border-amber-500/50 bg-[#131b2c] p-5 shadow-xl shadow-amber-950/20"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${isWrite ? "bg-cyan-500/20 text-cyan-400" : "bg-purple-500/20 text-purple-400"}`}>
                    {isWrite ? <FileCode className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold text-amber-400 uppercase tracking-wide">
                      {act.action_type}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">ID: {act.action_id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>Awaiting human decision</span>
                </div>
              </div>

              {/* Action Details */}
              <div className="space-y-2 mb-4 text-xs font-mono">
                {isWrite ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Target Path:</span>
                      <span className="text-cyan-300 font-semibold">{act.details?.path}</span>
                      <span className="text-slate-500">({act.details?.bytes} bytes)</span>
                    </div>
                    {act.details?.content_preview && (
                      <div className="mt-2 p-3 rounded-lg bg-[#090d16] border border-slate-800 max-h-48 overflow-y-auto font-mono text-[11px] text-slate-300">
                        <pre className="whitespace-pre-wrap">{act.details.content_preview}</pre>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Shell Command:</span>
                      <span className="text-purple-300 font-bold bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        {act.details?.command}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Timeout: {act.details?.timeout_seconds || 30}s
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  disabled={isLoading}
                  onClick={() => handleDecision(act.action_id, false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>Deny [N]</span>
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => handleDecision(act.action_id, true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Approve & Execute [Y]</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
