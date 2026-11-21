"use client";

import React, { useEffect } from "react";
import { X, ExternalLink, Github, Linkedin, Globe, Users } from "lucide-react";

export interface TeamMember {
  name: string;
  role: string;
  initials: string;
  github: string;
  linkedin: string;
  tag?: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Muhammad Daud Ali Lashari",
    role: "Lead AI Architect, LeanCode",
    initials: "DL",
    github: "https://github.com/ecomwithdaud-hub",
    linkedin: "https://www.linkedin.com/in/muhammad-daud-ali-lashari-1302a5337/",
    tag: "Team Lead",
  },
  {
    name: "M. Abdul Rafay",
    role: "Full-Stack & Systems Engineer, LeanCode",
    initials: "AR",
    github: "https://github.com/marafay-web",
    linkedin: "https://www.linkedin.com/in/m-abdul-rafay-0a4156353",
  },
  {
    name: "Noor Ul Saba",
    role: "AI Routing & QA Specialist, LeanCode",
    initials: "NS",
    github: "https://github.com/noorsaba1215",
    linkedin: "https://www.linkedin.com/in/noor-ul-saba-3b2b27385",
  },
  {
    name: "Muhammad Awais Raza",
    role: "Backend & Gateway Integration Engineer, LeanCode",
    initials: "MR",
    github: "https://github.com/mawaisawan2008",
    linkedin: "https://pk.linkedin.com/in/muhammad-awais-raza-88b51544b",
  },
];

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose }) => {
  // Listen for ESC key and manage body overflow
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl rounded-xl border border-white/10 bg-[#0f1218] p-6 shadow-2xl transition-all duration-200 ease-out transform scale-100 space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Top-Right Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="space-y-2 pr-8">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635]"></span>
            <span className="text-[11px] font-mono font-semibold tracking-wider text-[#a3e635] uppercase">
              TEAM ZEPRA TECH
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Built by Team Zepra Tech
          </h3>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
            Engineering high-efficiency agentic workflows, Maxim AI Bifrost routing pipelines, and token-minimized code generation for the Global AI Hackathon 2026.
          </p>

          {/* Clickable Header Link Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href="https://gozepra.tech/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/10 hover:border-[#a3e635]/50 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-[#a3e635]" />
              <span>gozepra.tech</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>

            <a
              href="https://www.linkedin.com/company/zepra-tech-official"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/10 hover:border-[#a3e635]/50 transition-colors"
            >
              <Linkedin className="w-3.5 h-3.5 text-slate-300" />
              <span>Zepra Tech LinkedIn</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
          </div>
        </div>

        {/* Modal Body: Responsive Card Grid (4 Members) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {TEAM_MEMBERS.map((member, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-white/10 bg-[#141821] hover:border-[#a3e635]/40 transition-colors p-4 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Monogram Avatar Badge + Optional Tag */}
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-[#a3e635]/10 border border-[#a3e635]/30 text-[#a3e635] font-mono font-bold flex items-center justify-center text-sm select-none">
                    {member.initials}
                  </div>
                  {member.tag && (
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#a3e635]/10 border border-[#a3e635]/30 text-[#a3e635]">
                      {member.tag}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-100 tracking-tight">
                    {member.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">
                    {member.role}
                  </p>
                </div>
              </div>

              {/* Clickable Social Pills */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                <a
                  href={member.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-mono bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 hover:border-[#a3e635]/40 transition-colors"
                >
                  <Github className="w-3 h-3 text-slate-400" />
                  <span>GitHub</span>
                </a>
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-mono bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 hover:border-[#a3e635]/40 transition-colors"
                >
                  <Linkedin className="w-3 h-3 text-slate-400" />
                  <span>LinkedIn</span>
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer Note */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-white/[0.06]">
          <span>Team Zepra Tech · LeanCode Architecture</span>
          <span>Global AI Hackathon 2026</span>
        </div>
      </div>
    </div>
  );
};
