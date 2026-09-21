import { type Clause } from "@/features/extraction/types";
import { type ComparisonResult } from "@/features/compare/types";

export type FairnessBand = "needs-negotiation" | "caution" | "fair" | "strong";

export interface TopDriver {
  clauseId: string;
  label: string;
  weightApplied: number;
}

export interface FairnessScoreResult {
  score: number;
  band: FairnessBand;
  isPartial: boolean;
  topDrivers: TopDriver[];
}

export interface FairnessScoreCardProps {
  clauses?: Clause[];
  compareResult?: ComparisonResult | null;
  extractionStatus?: "idle" | "extracting" | "success" | "error";
  onProceedToCompare?: () => void;
  className?: string;
}

export interface FairnessMeterProps {
  score: number;
  band: FairnessBand;
  isPartial?: boolean;
  className?: string;
}
