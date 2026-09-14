import { z } from "zod";

export const UserImpactSchema = z.enum(["favorable", "disadvantageous", "neutral"]);
export type UserImpact = z.infer<typeof UserImpactSchema>;

export const ComparisonDifferenceSchema = z.object({
  id: z.string(),
  clauseType: z.string(),
  title: z.string(),
  baseText: z.string(),
  targetText: z.string(),
  impactOnUser: UserImpactSchema,
  explanation: z.string(),
  severity: z.enum(["low", "medium", "high"]),
});

export type ComparisonDifference = z.infer<typeof ComparisonDifferenceSchema>;

export const ComparisonResultSchema = z.object({
  id: z.string(),
  mode: z.enum(["doc_vs_baseline", "doc_vs_doc"]),
  baseName: z.string(),
  targetName: z.string(),
  differences: z.array(ComparisonDifferenceSchema),
  favorableCount: z.number().int().nonnegative(),
  disadvantageousCount: z.number().int().nonnegative(),
  neutralCount: z.number().int().nonnegative(),
  summary: z.string(),
  comparedAt: z.string(),
});

export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;

export type CompareFilter = "all" | UserImpact;
