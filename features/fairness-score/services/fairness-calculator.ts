import { type Clause } from "@/features/extraction/types";
import { type ComparisonResult } from "@/features/compare/types";
import { type FairnessBand, type FairnessScoreResult, type TopDriver } from "../types";

/**
 * Maps a numeric score (0-100) to its standardized fairness band.
 */
export function getFairnessBand(score: number): FairnessBand {
  if (score >= 80) return "strong";
  if (score >= 60) return "fair";
  if (score >= 40) return "caution";
  return "needs-negotiation";
}

/**
 * Deterministic, pure scoring function with zero UI or side effects.
 *
 * Formula:
 * - Start at 100.
 * - Subtract 15 per high-risk clause.
 * - Subtract 5 per caution clause.
 * - If Compare has run:
 *   - Subtract 10 per "disadvantages you" item.
 *   - Add 5 per "favors you" item.
 * - Clamp between 0 and 100 (floor at 0).
 *
 * topDrivers returns the 2-3 highest-weight contributors, sorted descending by absolute impact.
 */
export function computeFairnessScore(
  clauses: Clause[] = [],
  compareResult?: ComparisonResult | null
): FairnessScoreResult {
  let score = 100;
  const drivers: TopDriver[] = [];

  // 1. Clause risk scoring
  for (const clause of clauses) {
    if (clause.riskLevel === "high-risk") {
      score -= 15;
      drivers.push({
        clauseId: clause.id,
        label: clause.plainSummary?.trim() || clause.type.replace(/_/g, " "),
        weightApplied: -15,
      });
    } else if (clause.riskLevel === "caution") {
      score -= 5;
      drivers.push({
        clauseId: clause.id,
        label: clause.plainSummary?.trim() || clause.type.replace(/_/g, " "),
        weightApplied: -5,
      });
    }
  }

  // 2. Compare result scoring (only if compareResult is provided and not null)
  const isPartial = compareResult === undefined || compareResult === null;

  if (!isPartial && compareResult?.differences) {
    for (const diff of compareResult.differences) {
      if (diff.impactOnUser === "disadvantageous") {
        score -= 10;
        drivers.push({
          clauseId: diff.id,
          label: diff.title?.trim() || diff.explanation?.trim() || "Baseline disparity",
          weightApplied: -10,
        });
      } else if (diff.impactOnUser === "favorable") {
        score += 5;
        drivers.push({
          clauseId: diff.id,
          label: diff.title?.trim() || diff.explanation?.trim() || "Statutory protection advantage",
          weightApplied: 5,
        });
      }
    }
  }

  // 3. Clamping: Floor at 0, ceiling at 100
  const finalScore = Math.min(100, Math.max(0, score));

  // 4. Sort drivers by absolute magnitude descending (penalties first on tie)
  drivers.sort((a, b) => {
    const magA = Math.abs(a.weightApplied);
    const magB = Math.abs(b.weightApplied);
    if (magB !== magA) {
      return magB - magA;
    }
    return a.weightApplied - b.weightApplied;
  });

  // Top 2-3 contributors
  const topDrivers = drivers.slice(0, 3);

  return {
    score: finalScore,
    band: getFairnessBand(finalScore),
    isPartial,
    topDrivers,
  };
}
