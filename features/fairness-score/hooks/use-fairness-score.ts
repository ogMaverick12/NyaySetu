"use client";

import { useMemo, useSyncExternalStore } from "react";
import { type Clause } from "@/features/extraction/types";
import { type ComparisonResult } from "@/features/compare/types";
import { computeFairnessScore } from "../services/fairness-calculator";
import { fairnessStore } from "../store/fairness-store";
import { type FairnessScoreResult } from "../types";

export interface UseFairnessScoreOptions {
  clauses?: Clause[];
  compareResult?: ComparisonResult | null;
  extractionStatus?: "idle" | "extracting" | "success" | "error";
}

export interface UseFairnessScoreReturn {
  result: FairnessScoreResult | null;
  isReady: boolean;
  isPartial: boolean;
}

/**
 * React hook to compute and observe the Contract Fairness Score.
 *
 * Strict Gating:
 * - If extraction is not yet complete (status !== "success" or clauses empty): returns null (isReady: false).
 * - If extraction is done but Compare has not run: returns partial score (isPartial: true).
 * - When Compare completes (either passed via prop or intercepted by fairnessStore):
 *   seamlessly recomputes to the comprehensive score without full-page re-renders.
 */
export function useFairnessScore({
  clauses = [],
  compareResult,
  extractionStatus = "success",
}: UseFairnessScoreOptions = {}): UseFairnessScoreReturn {
  // Subscribe to background/client compare store updates
  const storeCompareResult = useSyncExternalStore(
    fairnessStore.subscribe,
    fairnessStore.getSnapshot,
    () => null
  );

  // If compareResult is explicitly passed as prop (non-null), prefer it;
  // otherwise fallback to the singleton fairnessStore snapshot.
  const effectiveCompareResult = compareResult !== undefined ? compareResult : storeCompareResult;

  const result = useMemo(() => {
    // 1. Strict gating: Never render if extraction is in-flight, failed, or idle
    if (extractionStatus !== "success") {
      return null;
    }

    // 2. No clauses present yet
    if (!clauses || clauses.length === 0) {
      return null;
    }

    return computeFairnessScore(clauses, effectiveCompareResult);
  }, [clauses, effectiveCompareResult, extractionStatus]);

  return {
    result,
    isReady: result !== null,
    isPartial: result?.isPartial ?? true,
  };
}
