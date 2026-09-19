"use client";

import React, { useState, useEffect, useCallback } from "react";
import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { type ComparisonResult, type CompareFilter } from "../types";
import { BASELINE_TEMPLATES } from "../data/baseline-templates";
import { RedlineCard } from "./redline-card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import {
  Scale,
  GitCompare,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  HelpCircle,
  FileText,
  Building2,
  Bike,
  Briefcase,
  Info,
} from "lucide-react";

interface CompareScreenProps {
  primaryDocument: ParsedDocument;
  clauses?: Clause[];
  extractionStatus?: "idle" | "extracting" | "success" | "error";
  onRunExtraction?: () => void;
  onBackToAnalysis?: () => void;
}

export function CompareScreen({
  primaryDocument,
  clauses = [],
  extractionStatus = "idle",
  onRunExtraction,
  onBackToAnalysis,
}: CompareScreenProps): JSX.Element {
  const [compareMode, setCompareMode] = useState<"doc_vs_baseline" | "doc_vs_doc">(
    "doc_vs_baseline"
  );
  const [selectedBaselineKey, setSelectedBaselineKey] = useState<string>("residential_tenancy");
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<CompareFilter>("all");

  const isExtractionComplete =
    (extractionStatus === "success" || clauses.length > 0) && extractionStatus !== "extracting";

  const runComparison = useCallback(async () => {
    if (!isExtractionComplete) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: compareMode,
          targetDoc: primaryDocument,
          baselineKey: selectedBaselineKey,
          clauses,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        result?: ComparisonResult;
        error?: string;
      };

      if (data.result) {
        setComparisonResult(data.result);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [compareMode, selectedBaselineKey, primaryDocument, clauses, isExtractionComplete]);

  useEffect(() => {
    if (isExtractionComplete) {
      void runComparison();
    } else {
      setComparisonResult(null);
    }
  }, [isExtractionComplete, runComparison]);

  const activeBaseline =
    BASELINE_TEMPLATES[selectedBaselineKey] || BASELINE_TEMPLATES.residential_tenancy;

  const filteredDiffs =
    comparisonResult?.differences.filter((diff) => {
      if (filter === "all") return true;
      return diff.impactOnUser === filter;
    }) || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col justify-between gap-3 border-b border-border/80 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="font-serif text-xl font-bold text-primary">
              Contract Compare &amp; Redline Tracked Changes
            </h2>
            <Badge variant="brass">
              <GitCompare className="mr-1 h-3 w-3" />
              Redline Metaphor
            </Badge>
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            Evaluating whether revisions FAVOR or DISADVANTAGE the citizen
          </p>
        </div>

        {onBackToAnalysis && (
          <Button variant="outline" size="sm" onClick={onBackToAnalysis}>
            <FileText className="mr-2 h-3.5 w-3.5" />
            Back to Document Analysis
          </Button>
        )}
      </div>

      {/* Target Selector: Baseline Template vs Doc vs Doc */}
      <div className="shadow-xs space-y-4 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <span className="font-serif text-sm font-semibold text-primary">
            Select Comparison Baseline:
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isExtractionComplete}
              onClick={() => setCompareMode("doc_vs_baseline")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                !isExtractionComplete
                  ? "cursor-not-allowed bg-secondary text-muted-foreground opacity-50"
                  : compareMode === "doc_vs_baseline"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Doc vs Sourced Baseline
            </button>
            <button
              type="button"
              disabled={!isExtractionComplete}
              onClick={() => setCompareMode("doc_vs_doc")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                !isExtractionComplete
                  ? "cursor-not-allowed bg-secondary text-muted-foreground opacity-50"
                  : compareMode === "doc_vs_doc"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Doc vs Second Document
            </button>
          </div>
        </div>

        {/* Baseline Template Options */}
        {compareMode === "doc_vs_baseline" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              type="button"
              disabled={!isExtractionComplete}
              onClick={() => setSelectedBaselineKey("residential_tenancy")}
              className={`flex flex-col rounded border p-3 text-left transition-all ${
                !isExtractionComplete
                  ? "cursor-not-allowed border-border bg-card opacity-60"
                  : selectedBaselineKey === "residential_tenancy"
                    ? "shadow-xs border-[#B08D57] bg-[#FAF4E8]"
                    : "border-border bg-card hover:bg-secondary/40"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center text-xs font-semibold text-primary">
                  <Building2 className="mr-1.5 h-3.5 w-3.5 text-[#B08D57]" />
                  Residential Tenancy
                </span>
                <Badge variant="brass" className="text-[10px]">
                  Model Tenancy Act
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Statutory deposit ceilings (2 mo.) &amp; equal 60-day notice rules.
              </p>
            </button>

            <button
              type="button"
              disabled={!isExtractionComplete}
              onClick={() => setSelectedBaselineKey("gig_worker_agreement")}
              className={`flex flex-col rounded border p-3 text-left transition-all ${
                !isExtractionComplete
                  ? "cursor-not-allowed border-border bg-card opacity-60"
                  : selectedBaselineKey === "gig_worker_agreement"
                    ? "shadow-xs border-[#B08D57] bg-[#FAF4E8]"
                    : "border-border bg-card hover:bg-secondary/40"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center text-xs font-semibold text-primary">
                  <Bike className="mr-1.5 h-3.5 w-3.5 text-[#B08D57]" />
                  Gig Delivery Partner
                </span>
                <Badge variant="brass" className="text-[10px]">
                  Fairwork Standards
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Fair deactivation notice (7 days) &amp; capped mutual indemnity.
              </p>
            </button>

            <button
              type="button"
              disabled={!isExtractionComplete}
              onClick={() => setSelectedBaselineKey("employment_offer")}
              className={`flex flex-col rounded border p-3 text-left transition-all ${
                !isExtractionComplete
                  ? "cursor-not-allowed border-border bg-card opacity-60"
                  : selectedBaselineKey === "employment_offer"
                    ? "shadow-xs border-[#B08D57] bg-[#FAF4E8]"
                    : "border-border bg-card hover:bg-secondary/40"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center text-xs font-semibold text-primary">
                  <Briefcase className="mr-1.5 h-3.5 w-3.5 text-[#B08D57]" />
                  Employment Offer
                </span>
                <Badge variant="brass" className="text-[10px]">
                  Contract Act §27
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Void post-termination non-competes &amp; fair mutual notice.
              </p>
            </button>
          </div>
        ) : (
          <div className="rounded border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Comparing uploaded contract with alternative counter-party revision.
          </div>
        )}

        {/* Provenance note & Enforceability Advisory */}
        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
          <div className="flex items-center font-mono text-[11px] text-muted-foreground">
            <Scale className="mr-1.5 h-3.5 w-3.5 shrink-0 text-[#B08D57]" />
            <span>
              Baseline Reference:{" "}
              <span className="font-medium text-primary">{activeBaseline.sourcedReference}</span>{" "}
              (Sourced non-LLM statutory norm)
            </span>
          </div>
          <div className="flex items-center text-xs text-[#684B1E]">
            <Info className="mr-1.5 h-3.5 w-3.5 shrink-0 text-[#B08D57]" />
            <span>
              Note: This baseline is a fair-practice benchmark, not automatically enforceable
              everywhere (confirm your state&apos;s statutory adoption).
            </span>
          </div>
        </div>
      </div>

      {/* Gating: If extraction has not finished, display clear inline prompt instead of negative result */}
      {!isExtractionComplete ? (
        extractionStatus === "extracting" ? (
          <div className="shadow-xs space-y-3 rounded-lg border border-[#B08D57]/40 bg-[#FBF9F4] p-10 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#B08D57]" />
            <h3 className="font-serif text-base font-semibold text-[#1B2430]">
              Extracting Operative Clauses...
            </h3>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-[#525D6B]">
              NyaySetu is actively analyzing clauses from{" "}
              <span className="font-semibold text-primary">{primaryDocument.filename}</span>.
              Contract Compare and redline tracked changes will activate automatically once
              extraction completes to prevent false negative evaluations.
            </p>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border-2 border-[#B08D57]/40 bg-[#FBF9F4] p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#B08D57]/10 text-[#8C6D3B]">
              <Scale className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-serif text-base font-semibold text-[#1B2430]">
                Clause Extraction Required Before Comparison
              </h3>
              <p className="mx-auto max-w-lg text-xs leading-relaxed text-[#525D6B]">
                Contract Compare evaluates your agreement against statutory fair-practice baselines
                (Model Tenancy, Fairwork, Contract Act). To prevent false negatives (such as
                claiming a clause is &ldquo;not explicitly stated&rdquo; when it simply has not been
                extracted yet), please extract and assess clauses first.
              </p>
            </div>
            {onRunExtraction && (
              <Button variant="brass" onClick={onRunExtraction}>
                <Scale className="mr-2 h-4 w-4" />
                Extract Clauses &amp; Assess Risks
              </Button>
            )}
          </div>
        )
      ) : isLoading ? (
        <div className="space-y-3 rounded border border-border bg-card p-12 text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#B08D57]" />
          <p className="font-serif text-sm font-medium text-primary">
            Generating tracked-changes redline comparison against {activeBaseline.title}...
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            Evaluating favorability against fair practice standards
          </p>
        </div>
      ) : comparisonResult ? (
        <div className="space-y-5">
          {/* Baseline Benchmark Notice */}
          <div className="flex items-center gap-2 rounded-md border border-[#B08D57]/30 bg-[#FAF4E8] px-3.5 py-2.5 text-xs text-[#684B1E]">
            <Info className="h-4 w-4 shrink-0 text-[#B08D57]" />
            <p>
              <span className="font-semibold">Benchmark Advisory:</span> This baseline is a
              fair-practice benchmark, not automatically enforceable everywhere. Confirm your
              state&apos;s statutory position.
            </p>
          </div>

          {/* Summary Metric Ribbon */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-md border border-[#8C2F39]/40 bg-[#F7ECEE] p-4">
              <div className="space-y-0.5">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#8C2F39]">
                  Disadvantages You
                </span>
                <div className="font-serif text-2xl font-bold text-[#8C2F39]">
                  {comparisonResult.disadvantageousCount}
                </div>
              </div>
              <ShieldAlert className="h-8 w-8 text-[#8C2F39]/80" />
            </div>

            <div className="flex items-center justify-between rounded-md border border-[#3F6C51]/40 bg-[#EAF2EC] p-4">
              <div className="space-y-0.5">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#3F6C51]">
                  Favors You
                </span>
                <div className="font-serif text-2xl font-bold text-[#3F6C51]">
                  {comparisonResult.favorableCount}
                </div>
              </div>
              <CheckCircle2 className="h-8 w-8 text-[#3F6C51]/80" />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-secondary/50 p-4">
              <div className="space-y-0.5">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Neutral Revisions
                </span>
                <div className="font-serif text-2xl font-bold text-primary">
                  {comparisonResult.neutralCount}
                </div>
              </div>
              <HelpCircle className="h-8 w-8 text-muted-foreground/60" />
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-1.5">
              <span className="mr-2 font-mono text-xs text-muted-foreground">Filter Diffs:</span>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({comparisonResult.differences.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("disadvantageous")}
                className={`flex items-center rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === "disadvantageous"
                    ? "bg-[#8C2F39] text-white"
                    : "bg-[#F7ECEE] text-[#8C2F39]"
                }`}
              >
                <ShieldAlert className="mr-1 h-3 w-3" />
                Disadvantages ({comparisonResult.disadvantageousCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("favorable")}
                className={`flex items-center rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === "favorable" ? "bg-[#3F6C51] text-white" : "bg-[#EAF2EC] text-[#3F6C51]"
                }`}
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Favors ({comparisonResult.favorableCount})
              </button>
            </div>

            <span className="font-mono text-xs text-muted-foreground">
              {filteredDiffs.length} clause comparison(s) shown
            </span>
          </div>

          {/* Redline Cards */}
          <div className="space-y-4">
            {filteredDiffs.map((diff) => (
              <RedlineCard key={diff.id} difference={diff} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
