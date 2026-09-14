import { z } from "zod";

/**
 * ChecklistItem schema per 02-TRD.md Section 3:
 * type ChecklistItem = {
 *   id: string;
 *   text: string;
 *   kind: "action" | "lawyer_question";
 *   sourceClauseId: string | null;
 * };
 */
export const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1, "Item text cannot be empty"),
  kind: z.enum(["action", "lawyer_question"]),
  sourceClauseId: z.string().nullable(),
});

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export interface LegalMemo {
  id: string;
  documentTitle: string;
  documentFilename: string;
  generatedDate: string;
  caseReference: string;
  totalClauses: number;
  highRiskCount: number;
  cautionCount: number;
  actionItems: ChecklistItem[];
  lawyerQuestions: ChecklistItem[];
  statutoryCitations: string[];
}
