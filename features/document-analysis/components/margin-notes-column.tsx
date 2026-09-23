"use client";

import React, { useState } from "react";
import { type Clause, type ClauseRiskFilter } from "@/features/extraction/types";
import { type ReadingLevel } from "../types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { useSpeechSynthesis } from "@/features/accessibility";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  BookmarkCheck,
  Scale,
  Sparkles,
  BookOpen,
  Volume2,
  VolumeX,
  RefreshCw,
  FileSearch,
} from "lucide-react";

interface MarginNotesColumnProps {
  clauses: Clause[];
  extractionStatus: "idle" | "extracting" | "success" | "error";
  selectedClause: Clause | null;
  onSelectClause: (clause: Clause) => void;
  flaggedForLawyer: Set<string>;
  onToggleFlag: (clauseId: string) => void;
  onProceedToCompare?: () => void;
}

export function MarginNotesColumn({
  clauses,
  extractionStatus,
  selectedClause,
  onSelectClause,
  flaggedForLawyer,
  onToggleFlag,
  onProceedToCompare,
}: MarginNotesColumnProps): JSX.Element {
  // Reading-level state (F3: toggles local rendering without re-running extraction)
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>("plain");
  const [activeFilter, setActiveFilter] = useState<ClauseRiskFilter>("all");

  // Speech synthesis for plain-language accessibility
  const { speak, cancel, isSpeaking, isSupported: isTtsSupported } = useSpeechSynthesis();
  const [speakingClauseId, setSpeakingClauseId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isSpeaking) {
      setSpeakingClauseId(null);
    }
  }, [isSpeaking]);

  const handleToggleSpeak = (clause: Clause) => {
    if (isSpeaking && speakingClauseId === clause.id) {
      cancel();
      setSpeakingClauseId(null);
    } else {
      cancel();
      setSpeakingClauseId(clause.id);
      speak(clause.plainSummary);
    }
  };

  const counts = {
    total: clauses.length,
    info: clauses.filter((c) => c.riskLevel === "info").length,
    caution: clauses.filter((c) => c.riskLevel === "caution").length,
    highRisk: clauses.filter((c) => c.riskLevel === "high-risk").length,
  };

  const filteredClauses =
    activeFilter === "all" ? clauses : clauses.filter((c) => c.riskLevel === activeFilter);

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card shadow-sm">
      {/* Column Header with Reading-Level Switcher (F3) */}
      <div className="flex flex-col space-y-3 border-b border-border/80 bg-parchment/60 p-4 sm:px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-primary">
              Legal Margin Notes
            </h3>
            <p className="font-mono text-xs text-muted-foreground">
              {counts.total} operative annotations • Anchored to source
            </p>
          </div>

          {/* Reading-Level Toggle (Plain Language vs Detailed Legal) */}
          <div
            className="inline-flex rounded-md border border-border bg-secondary/80 p-0.5"
            role="group"
            aria-label="Reading register mode"
          >
            <button
              type="button"
              onClick={() => setReadingLevel("plain")}
              className={`flex items-center rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                readingLevel === "plain"
                  ? "shadow-xs bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={readingLevel === "plain"}
            >
              <Sparkles className="mr-1.5 h-3 w-3 text-[#684B1E]" />
              Plain Language
            </button>
            <button
              type="button"
              onClick={() => setReadingLevel("detailed")}
              className={`flex items-center rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                readingLevel === "detailed"
                  ? "shadow-xs bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={readingLevel === "detailed"}
            >
              <BookOpen className="mr-1.5 h-3 w-3 text-[#684B1E]" />
              Detailed Register
            </button>
          </div>
        </div>

        {/* Risk Filter Chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("info")}
            className={`flex items-center rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeFilter === "info" ? "bg-[#3F6C51] text-white" : "bg-[#EAF2EC] text-[#3F6C51]"
            }`}
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Standard ({counts.info})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("caution")}
            className={`flex items-center rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeFilter === "caution" ? "bg-[#6B450B] text-white" : "bg-[#FBF4E7] text-[#6B450B]"
            }`}
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            Caution ({counts.caution})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("high-risk")}
            className={`flex items-center rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeFilter === "high-risk"
                ? "bg-[#8C2F39] text-white"
                : "bg-[#F7ECEE] text-[#8C2F39]"
            }`}
          >
            <ShieldAlert className="mr-1 h-3 w-3" />
            Risk ({counts.highRisk})
          </button>
        </div>
      </div>

      {/* Margin Notes List — or loading / empty state */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
        {/* ── Loading state: extraction is running ── */}
        {extractionStatus === "extracting" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#B08D57]/10">
              <RefreshCw className="h-6 w-6 animate-spin text-[#684B1E]" />
            </div>
            <div className="space-y-1">
              <p className="font-serif text-sm font-semibold text-primary">
                AI is reading the contract…
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                Analysing clauses, risk levels, and rationale. This takes 10–20 s.
              </p>
            </div>
          </div>
        )}

        {/* ── Empty state: no clauses yet and not currently extracting ── */}
        {extractionStatus !== "extracting" && clauses.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <FileSearch className="h-6 w-6 text-[#684B1E]" />
            </div>
            <div className="space-y-1">
              <p className="font-serif text-sm font-semibold text-primary">No margin notes yet</p>
              <p className="max-w-xs font-mono text-xs text-muted-foreground">
                {extractionStatus === "error"
                  ? "Extraction failed. Go back to the Intake Desk and retry."
                  : 'Return to the Intake Desk and click "Extract Clauses & Assess Risks" to generate AI annotations.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Clause notes list: only when extraction succeeded ── */}
        {clauses.length > 0 &&
          filteredClauses.map((clause) => {
            const isSelected = selectedClause?.id === clause.id;
            const isHighRisk = clause.riskLevel === "high-risk";
            const isCaution = clause.riskLevel === "caution";
            const isFlagged = flaggedForLawyer.has(clause.id);

            return (
              <div
                key={clause.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectClause(clause)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectClause(clause);
                  }
                }}
                aria-label={`Inspect clause ${clause.type} on page ${clause.page}`}
                className={`cursor-pointer rounded-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F421A] ${
                  isSelected ? "scale-[1.01]" : ""
                }`}
              >
                <Card
                  riskLevel={clause.riskLevel}
                  className={`transition-all ${
                    isSelected
                      ? "bg-[#FAF7F0] shadow-md ring-2 ring-[#5F421A]"
                      : "hover:border-[#B08D57]/60"
                  }`}
                >
                  <CardHeader className="p-3.5 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] uppercase text-muted-foreground">
                        § PAGE {clause.page} • {clause.type.replace(/_/g, " ")}
                      </span>

                      {/* Non-color signal (icon + text badge) for WCAG AA compliance */}
                      {isHighRisk ? (
                        <Badge variant="high-risk">
                          <ShieldAlert className="mr-1 h-3 w-3" />
                          Legal Risk
                        </Badge>
                      ) : isCaution ? (
                        <Badge variant="caution">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Caution
                        </Badge>
                      ) : (
                        <Badge variant="info">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Standard
                        </Badge>
                      )}
                    </div>

                    {/* Dynamic Content based on ReadingLevel (F3) */}
                    {readingLevel === "plain" ? (
                      <div className="mt-1.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#684B1E]">
                            Plain Meaning:
                          </span>
                          {isTtsSupported && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSpeak(clause);
                              }}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[#684B1E] transition-colors hover:bg-[#684B1E]/10 focus:outline-none focus:ring-1 focus:ring-[#684B1E]"
                              aria-label={
                                speakingClauseId === clause.id
                                  ? `Stop reading plain summary of clause ${clause.type}`
                                  : `Read plain summary of clause ${clause.type} aloud`
                              }
                              title={
                                speakingClauseId === clause.id
                                  ? "Stop voice playback"
                                  : "Read aloud with voice synthesis"
                              }
                            >
                              {speakingClauseId === clause.id ? (
                                <>
                                  <VolumeX className="h-3 w-3 animate-pulse text-[#8C2F39]" />
                                  <span className="font-mono text-[10px] text-[#8C2F39]">Stop</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="h-3 w-3 text-[#684B1E]" />
                                  <span className="font-mono text-[10px] text-[#684B1E]">Read</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {clause.plainSummary}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-1.5 space-y-1.5">
                        <CardTitle className="text-sm font-semibold text-primary">
                          {clause.plainSummary}
                        </CardTitle>
                        <div className="rounded border border-border/70 bg-secondary/40 p-2 font-mono text-[11px] text-muted-foreground">
                          <p className="line-clamp-3 italic">&ldquo;{clause.sourceText}&rdquo;</p>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          <span className="mr-1 font-mono uppercase text-[#684B1E]">
                            Rationale:
                          </span>
                          {clause.rationale}
                        </div>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="p-3.5 pt-0">
                    {readingLevel === "plain" && (
                      <div className="rounded bg-secondary/30 p-2 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">Why it matters: </span>
                        {clause.rationale}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="flex items-center justify-between border-t border-border/50 p-2.5 px-3.5">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Click to inspect page
                    </span>

                    {/* F2 Acceptance Requirement: Every high-risk clause surfaces lawyer escalation */}
                    {isHighRisk ? (
                      <Button
                        variant={isFlagged ? "default" : "destructive"}
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFlag(clause.id);
                        }}
                      >
                        {isFlagged ? (
                          <>
                            <BookmarkCheck className="mr-1 h-3 w-3" />
                            Flagged
                          </>
                        ) : (
                          <>
                            <Scale className="mr-1 h-3 w-3" />
                            Flag for Lawyer
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFlag(clause.id);
                        }}
                      >
                        {isFlagged ? (
                          <>
                            <BookmarkCheck className="mr-1 h-3 w-3 text-[#684B1E]" />
                            In Memo
                          </>
                        ) : (
                          <>+ Flag</>
                        )}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </div>
            );
          })}
      </div>

      {/* Footer Navigation */}
      {onProceedToCompare && (
        <div className="flex justify-end border-t border-border bg-parchment/60 p-3 px-4">
          <Button variant="brass" size="sm" onClick={onProceedToCompare}>
            Proceed to Contract Compare
          </Button>
        </div>
      )}
    </div>
  );
}
