export { CompareScreen } from "./components/compare-screen";
export { RedlineCard } from "./components/redline-card";
export {
  BASELINE_TEMPLATES,
  type BaselineTemplate,
  type BaselineClause,
} from "./data/baseline-templates";
export {
  buildDeterministicBaselineComparison,
  buildComparePrompt,
  parseLlmComparisonOutput,
} from "./services/compare-service";
export {
  type ComparisonDifference,
  type ComparisonResult,
  type UserImpact,
  type CompareFilter,
  ComparisonDifferenceSchema,
  ComparisonResultSchema,
  UserImpactSchema,
} from "./types";
