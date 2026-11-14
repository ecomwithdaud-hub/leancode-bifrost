"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, FileCode, Terminal, Clock, ShieldCheck } from "lucide-react";

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

  const hasPending = actions && actions.length > 0;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0f1218] p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Human Approval Gate
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-500">
          {hasPending ? `${actions.length} Pending` : "Queue Clear"}
        </span>
      </div>

      {!hasPending ? (
        <div className="rounded-lg border border-white/[0.04] bg-[#090b10] p-6 text-center">
          <div className="w-8 h-8 rounded-full bg-white/[0.04] mx-auto flex items-center justify-center text-slate-400 mb-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <h4 className="text-xs font-medium text-slate-300">Approval Queue Idle</h4>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            Read-only operations (<code className="text-slate-400">read_file</code>, <code className="text-slate-400">search_code</code>, <code className="text-slate-400">list_files</code>) run freely.
            State mutations (<code className="text-slate-400">write_file</code>, <code className="text-slate-400">run_shell</code>) pause here for confirmation.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((act) => {
            const isLoading = loadingMap[act.action_id];
            const isWrite = act.action_type === "write_file";

            return (
              <div
                key={act.action_id}
                className="rounded-lg border border-white/[0.08] bg-[#090b10] p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-white/[0.05] text-slate-300">
                      {isWrite ? <FileCode className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-200 uppercase tracking-wide">
                      {act.action_type}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      #{act.action_id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Awaiting decision</span>
                  </div>
                </div>

                {/* Details */}
                <div className="text-xs font-mono space-y-1.5">
                  {isWrite ? (
                    <>
                      <div className="text-slate-400 text-[11px]">
                        Target: <span className="text-slate-200 font-semibold">{act.details?.path}</span>{" "}
                        <span className="text-slate-500">({act.details?.bytes} B)</span>
                      </div>
                      {act.details?.content_preview && (
                        <pre className="p-2.5 rounded bg-[#07090e] border border-white/[0.04] max-h-36 overflow-y-auto text-[11px] text-slate-300 whitespace-pre-wrap font-mono">
                          {act.details.content_preview}
                        </pre>
                      )}
                    </>
                  ) : (
                    <div className="text-slate-400 text-[11px]">
                      Command:{" "}
                      <span className="text-slate-200 font-mono bg-[#07090e] border border-white/[0.04] px-1.5 py-0.5 rounded">
                        {act.details?.command}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Decision Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleDecision(act.action_id, false)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-white/[0.04] hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 border border-white/[0.08] transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span>Deny [N]</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleDecision(act.action_id, true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-mono font-semibold bg-[#a3e635] hover:bg-[#bef264] text-[#090b10] transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#090b10]" />
                    <span>Approve [Y]</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
