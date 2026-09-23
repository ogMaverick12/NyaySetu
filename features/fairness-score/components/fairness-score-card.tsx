"use client";

import React, { useId } from "react";
import { type FairnessScoreCardProps, type FairnessBand } from "../types";
import { useFairnessScore } from "../hooks/use-fairness-score";
import { FairnessMeter } from "./fairness-meter";
import { useSpeechSynthesis } from "@/features/accessibility";
import { Button } from "@/ui/button";
import {
  Scale,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  ArrowRight,
  Info,
} from "lucide-react";

const BAND_METADATA: Record<
  FairnessBand,
  {
    title: string;
    description: string;
    badgeStyle: string;
    icon: React.ComponentType<{ className?: string }>;
    cardBorder: string;
  }
> = {
  strong: {
    title: "Strong Protection",
    description: "Terms strongly favor user protection and reciprocal statutory standards.",
    badgeStyle: "border-[#A5CBB3] bg-[#EAF2EC] text-[#245437]",
    icon: CheckCircle2,
    cardBorder: "border-l-4 border-l-[#3F6C51]",
  },
  fair: {
    title: "Fair / Balanced",
    description: "Operative terms follow typical statutory baselines without severe asymmetries.",
    badgeStyle: "border-[#D8C6A5] bg-[#FAF3E8] text-[#684B1E]",
    icon: Scale,
    cardBorder: "border-l-4 border-l-[#B08D57]",
  },
  caution: {
    title: "Caution Advised",
    description: "Several asymmetrical or restrictive terms require attention before signing.",
    badgeStyle: "border-[#E5C88D] bg-[#FBF4E7] text-[#6B450B]",
    icon: AlertTriangle,
    cardBorder: "border-l-4 border-l-[#C08A2E]",
  },
  "needs-negotiation": {
    title: "Needs Negotiation",
    description: "High-risk liabilities or severe baseline disparities detected.",
    badgeStyle: "border-[#D699A0] bg-[#F7ECEE] text-[#8C2F39]",
    icon: ShieldAlert,
    cardBorder: "border-l-4 border-l-[#8C2F39]",
  },
};

export function FairnessScoreCard({
  clauses = [],
  compareResult,
  extractionStatus = "success",
  onProceedToCompare,
  className = "",
}: FairnessScoreCardProps): JSX.Element | null {
  const headingId = useId();
  const { result, isReady, isPartial } = useFairnessScore({
    clauses,
    compareResult,
    extractionStatus,
  });

  const { speak, cancel, isSpeaking, isSupported: isSpeechSupported } = useSpeechSynthesis();

  // Strict Gating: If extraction is not yet ready or result is null, show NOTHING.
  if (!isReady || !result) {
    return null;
  }

  const bandMeta = BAND_METADATA[result.band];
  const BandIcon = bandMeta.icon;

  const handleToggleAudio = () => {
    if (isSpeaking) {
      cancel();
      return;
    }

    const narrationParts = [
      `Contract Fairness Score: ${result.score} out of 100.`,
      `Classification: ${bandMeta.title}.`,
      isPartial
        ? "Partial score — clause-based only. Run Compare for statutory baseline alignment."
        : "Comprehensive score evaluated against statutory fair practice baselines.",
    ];

    if (result.topDrivers.length > 0) {
      narrationParts.push("Key drivers:");
      result.topDrivers.forEach((driver) => {
        const effect = driver.weightApplied < 0 ? "minus" : "plus";
        narrationParts.push(`${effect} ${Math.abs(driver.weightApplied)} points: ${driver.label}.`);
      });
    }

    speak(narrationParts.join(" "));
  };

  return (
    <div
      role="region"
      aria-labelledby={headingId}
      className={`rounded-lg border border-[#E0D7C6] bg-[#FBF9F4] p-6 shadow-sm transition-all ${bandMeta.cardBorder} ${className}`}
    >
      {/* Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-md border border-[#E0D7C6] bg-[#F7F3EA] p-2 text-[#684B1E]">
            <Scale className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3
                id={headingId}
                className="font-serif text-lg font-semibold tracking-tight text-[#1B2430]"
              >
                Contract Fairness Score
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#684B1E]">
                Deterministic
              </span>
            </div>
            <p className="text-xs text-[#525D6B]">
              Calculated from clause risk levels and statutory baseline alignment
            </p>
          </div>
        </div>

        {/* Audio Narration Trigger */}
        {isSpeechSupported && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleAudio}
            aria-label={
              isSpeaking
                ? "Stop reading fairness score summary"
                : "Read fairness score summary aloud"
            }
            className="flex items-center gap-1.5 border-[#E0D7C6] bg-background text-xs text-[#1B2430] hover:bg-[#F7F3EA]"
          >
            {isSpeaking ? (
              <>
                <VolumeX className="h-3.5 w-3.5 animate-pulse text-[#8C2F39]" />
                <span>Stop Audio</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5 text-[#684B1E]" />
                <span>Read Score</span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Main Score & Band Showcase */}
      <div className="mt-5 grid grid-cols-1 items-center gap-6 sm:grid-cols-12">
        {/* Numerical Score & Band Badge */}
        <div className="flex flex-col items-start gap-2 sm:col-span-4">
          <div className="flex items-baseline gap-1">
            <span
              className="font-serif text-5xl font-bold tracking-tight text-[#1B2430]"
              aria-label={`Score: ${result.score} points`}
            >
              {result.score}
            </span>
            <span className="font-mono text-base text-[#525D6B]">/ 100</span>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold ${bandMeta.badgeStyle}`}
          >
            <BandIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{bandMeta.title}</span>
          </div>
        </div>

        {/* Meter Gauge & Benchmark markers */}
        <div className="space-y-2 sm:col-span-8">
          <FairnessMeter score={result.score} band={result.band} isPartial={isPartial} />
          <p className="text-xs text-[#525D6B]">{bandMeta.description}</p>
        </div>
      </div>

      {/* Partial Score Advisory or Full Baseline Status */}
      <div className="mt-5">
        {isPartial ? (
          <div className="flex flex-col items-start justify-between gap-3 rounded-md border border-[#E5C88D] bg-[#FBF4E7] p-3 text-xs text-[#6B450B] sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-[#6B450B]" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Partial score</strong> — clause-based only. Run
                Compare for the full picture.
              </span>
            </div>
            {onProceedToCompare && (
              <Button
                type="button"
                variant="brass"
                size="sm"
                onClick={onProceedToCompare}
                className="shadow-xs shrink-0 text-xs"
              >
                <span>Run Compare Mode</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-[#A5CBB3] bg-[#EAF2EC] p-2.5 text-xs text-[#245437]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3F6C51]" aria-hidden="true" />
            <span>
              <strong>Comprehensive score</strong> — calibrated against statutory fair-practice
              baseline comparison.
            </span>
          </div>
        )}
      </div>

      {/* Top Drivers Section */}
      <div className="mt-5 space-y-2 border-t border-[#E0D7C6]/80 pt-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-[#684B1E]">
            Key Score Drivers
          </span>
          <span className="text-[11px] text-[#525D6B]">
            {result.topDrivers.length} primary factor{result.topDrivers.length === 1 ? "" : "s"}
          </span>
        </div>

        {result.topDrivers.length === 0 ? (
          <p className="font-serif text-xs italic text-[#525D6B]">
            All extracted clauses adhere to standard risk baselines with no score penalties applied.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {result.topDrivers.map((driver) => {
              const isPenalty = driver.weightApplied < 0;
              return (
                <div
                  key={`${driver.clauseId}-${driver.weightApplied}`}
                  className="shadow-2xs flex flex-col justify-between rounded border border-[#E0D7C6] bg-white/70 p-2.5"
                >
                  <p
                    className="line-clamp-2 text-xs font-medium text-[#1B2430]"
                    title={driver.label}
                  >
                    {driver.label}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${
                        isPenalty ? "bg-[#F7ECEE] text-[#8C2F39]" : "bg-[#EAF2EC] text-[#245437]"
                      }`}
                    >
                      {isPenalty ? `${driver.weightApplied} pts` : `+${driver.weightApplied} pts`}
                    </span>
                    <span className="font-mono text-[10px] text-[#525D6B]">
                      {isPenalty ? "penalty" : "favorable"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
