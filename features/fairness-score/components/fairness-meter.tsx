"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { tokens } from "@/tokens";
import { standardTransition } from "@/motion-variants";
import { type FairnessMeterProps, type FairnessBand } from "../types";

const BAND_COLORS: Record<FairnessBand, { bar: string; glow: string; label: string }> = {
  strong: {
    bar: tokens.colors.risk.low.DEFAULT,
    glow: "rgba(63, 108, 81, 0.2)",
    label: "Strong statutory & reciprocal balance",
  },
  fair: {
    bar: tokens.colors.brass.DEFAULT,
    glow: "rgba(176, 141, 87, 0.2)",
    label: "Fair terms with standard provisions",
  },
  caution: {
    bar: tokens.colors.risk.caution.DEFAULT,
    glow: "rgba(192, 138, 46, 0.2)",
    label: "Caution advised — asymmetric clauses identified",
  },
  "needs-negotiation": {
    bar: tokens.colors.risk.high.DEFAULT,
    glow: "rgba(140, 47, 57, 0.2)",
    label: "Significant risks — contract requires negotiation",
  },
};

export function FairnessMeter({
  score,
  band,
  isPartial = false,
  className = "",
}: FairnessMeterProps): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const bandInfo = BAND_COLORS[band];

  // Clamp width percentage strictly between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Screen reader live text */}
      <span className="sr-only">
        {`Contract Fairness Score: ${clampedScore} out of 100. Classification: ${band}. ${
          isPartial ? "Note: Partial score pending statutory baseline comparison." : ""
        }`}
      </span>

      {/* Meter Bar Container */}
      <div
        role="meter"
        aria-valuenow={clampedScore}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${clampedScore} out of 100 (${bandInfo.label})`}
        aria-label="Contract Fairness Score Gauge"
        className="relative h-4 w-full overflow-hidden rounded-full border border-[#E0D7C6] bg-[#EFE8DC]"
      >
        {/* Fill Bar */}
        <motion.div
          className="h-full rounded-full transition-colors duration-200"
          style={{
            backgroundColor: bandInfo.bar,
            boxShadow: `0 0 8px ${bandInfo.glow}`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${clampedScore}%` }}
          transition={prefersReducedMotion ? { duration: 0 } : standardTransition}
        />

        {/* Milestone Threshold Ticks (40, 60, 80) */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-between px-1"
          aria-hidden="true"
        >
          <div className="absolute left-[40%] h-2 w-[1px] -translate-x-1/2 bg-[#1B2430]/20" />
          <div className="absolute left-[60%] h-2 w-[1px] -translate-x-1/2 bg-[#1B2430]/20" />
          <div className="absolute left-[80%] h-2 w-[1px] -translate-x-1/2 bg-[#1B2430]/20" />
        </div>
      </div>

      {/* Milestone Legend */}
      <div
        className="flex items-center justify-between font-mono text-[10px] text-[#525D6B]"
        aria-hidden="true"
      >
        <span className="text-left font-medium">0 Needs Negotiation</span>
        <span className="text-center">40 Caution</span>
        <span className="text-center">60 Fair</span>
        <span className="text-right font-medium">80+ Strong</span>
      </div>
    </div>
  );
}
