import { z } from "zod";
import { type LLMProviderName } from "@/lib/llm/types";

export const ClauseRiskLevelSchema = z.enum(["info", "caution", "high-risk"]);
export type ClauseRiskLevel = z.infer<typeof ClauseRiskLevelSchema>;

export const ClauseSchema = z.object({
  id: z.string(),
  page: z.number().int().positive(),
  sourceText: z.string().min(1),
  type: z.string().min(1),
  plainSummary: z.string().min(1),
  riskLevel: ClauseRiskLevelSchema,
  rationale: z.string().min(1),
});

export type Clause = z.infer<typeof ClauseSchema>;

export const ClauseExtractionOutputSchema = z.object({
  clauses: z.array(ClauseSchema),
});

export type ClauseExtractionOutput = z.infer<typeof ClauseExtractionOutputSchema>;

export type ClauseRiskFilter = "all" | ClauseRiskLevel;

export interface ClauseExtractionState {
  status: "idle" | "extracting" | "success" | "error";
  clauses: Clause[];
  providerUsed?: LLMProviderName;
  fallbackTriggered?: boolean;
  latencyMs?: number;
  error?: string | null;
}
