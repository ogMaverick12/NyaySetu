"use client";

import React from "react";
import { motion } from "framer-motion";
import { type Clause, type ClauseRiskFilter } from "../types";
import { type ExtractionResultMetadata } from "@/lib/llm/types";
import { ClauseCard } from "./clause-card";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { clauseContainer, clauseCardReveal } from "@/motion-variants";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Cpu,
  ArrowRight,
} from "lucide-react";

interface ClausePanelProps {
  clauses: Clause[];
  metadata: ExtractionResultMetadata | null;
  activeFilter: ClauseRiskFilter;
  onFilterChange: (filter: ClauseRiskFilter) => void;
  flaggedForLawyer: Set<string>;
  onToggleFlag: (clauseId: string) => void;
  onProceedToCompare?: () => void;
}

export function ClausePanel({
  clauses,
  metadata,
  activeFilter,
  onFilterChange,
  flaggedForLawyer,
  onToggleFlag,
  onProceedToCompare,
}: ClausePanelProps): JSX.Element {
  const counts = {
    total: clauses.length,
    info: clauses.filter((c) => c.riskLevel === "info").length,
    caution: clauses.filter((c) => c.riskLevel === "caution").length,
    highRisk: clauses.filter((c) => c.riskLevel === "high-risk").length,
  };

  const visibleClauses =
    activeFilter === "all" ? clauses : clauses.filter((c) => c.riskLevel === activeFilter);

  return (
    <div className="space-y-6">
      {/* Risk Summary Metrics Bar */}
      <div className="shadow-xs flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-4 sm:p-5 md:flex-row md:items-center">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h3 className="font-serif text-lg font-bold text-primary">
              Operative Clauses &amp; Risk Register
            </h3>
            {metadata && (
              <Badge variant="brass" className="font-mono text-xs">
                <Cpu className="mr-1 h-3 w-3" />
                {metadata.provider === "gemini"
                  ? "Gemini 1.5 Flash"
                  : `OpenRouter (${metadata.model})`}
                {metadata.fallbackTriggered ? " (Fallback)" : ""}
              </Badge>
            )}
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {counts.total} clauses extracted in one structured audit call
            {metadata?.latencyMs ? ` • ${(metadata.latencyMs / 1000).toFixed(2)}s` : ""}
          </p>
        </div>

        {/* Counter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/70 text-foreground hover:bg-secondary"
            }`}
          >
            All ({counts.total})
          </button>

          <button
            type="button"
            onClick={() => onFilterChange("info")}
            className={`flex items-center rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === "info"
                ? "bg-[#3F6C51] text-white"
                : "bg-[#EAF2EC] text-[#3F6C51] hover:bg-[#D9EADF]"
            }`}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Standard ({counts.info})
          </button>

          <button
            type="button"
            onClick={() => onFilterChange("caution")}
            className={`flex items-center rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === "caution"
                ? "bg-[#C08A2E] text-white"
                : "bg-[#FBF4E7] text-[#C08A2E] hover:bg-[#F4E8D1]"
            }`}
          >
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
            Caution ({counts.caution})
          </button>

          <button
            type="button"
            onClick={() => onFilterChange("high-risk")}
            className={`flex items-center rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === "high-risk"
                ? "bg-[#8C2F39] text-white"
                : "bg-[#F7ECEE] text-[#8C2F39] hover:bg-[#EED8DC]"
            }`}
          >
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
            High Risk ({counts.highRisk})
          </button>
        </div>
      </div>

      {/* Flagged for Lawyer Banner */}
      {flaggedForLawyer.size > 0 && (
        <div className="flex flex-col items-start justify-between gap-3 rounded border border-[#8C2F39]/40 bg-[#F7ECEE] p-4 text-xs text-[#8C2F39] sm:flex-row sm:items-center">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="font-semibold">
              {flaggedForLawyer.size} clause(s) flagged for lawyer preparation memo.
            </span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            Automatic escalation seeded from high-risk findings
          </span>
        </div>
      )}

      {/* Staggered Clause Grid / Margin Notes */}
      {visibleClauses.length === 0 ? (
        <div className="rounded border border-dashed border-border p-8 text-center text-muted-foreground">
          <FileCheck2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
          <p className="font-serif text-sm">No clauses found matching this filter.</p>
        </div>
      ) : (
        <motion.div
          variants={clauseContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-5 md:grid-cols-2"
        >
          {visibleClauses.map((clause) => (
            <motion.div key={clause.id} variants={clauseCardReveal}>
              <ClauseCard
                clause={clause}
                isFlaggedForLawyer={flaggedForLawyer.has(clause.id)}
                onToggleFlagForLawyer={() => onToggleFlag(clause.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Next Step Transition */}
      {onProceedToCompare && (
        <div className="flex justify-end pt-4">
          <Button variant="brass" onClick={onProceedToCompare}>
            Proceed to Contract Compare Mode
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
