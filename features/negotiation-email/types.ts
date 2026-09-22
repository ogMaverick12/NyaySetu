import { z } from "zod";
import { type Clause } from "@/features/extraction/types";
import { type DocumentType } from "@/features/extraction";
import { type ComparisonDifference } from "@/features/compare/types";
import { type ExtractionResultMetadata } from "@/lib/llm/types";

/**
 * Zod schema enforcing the exact output shape of the negotiation draft email.
 * Ref: 02-TRD.md & Feature Spec.
 */
export const NegotiationEmailDraftSchema = z.object({
  subject: z.string().min(1, "Subject cannot be empty"),
  body: z.string().min(1, "Email body cannot be empty"),
  citedClauseIds: z.array(z.string()).default([]),
});

export type NegotiationEmailDraft = z.infer<typeof NegotiationEmailDraftSchema>;

export interface NegotiationEmailPromptInput {
  documentType: DocumentType;
  documentFilename: string;
  clauses: Clause[];
  comparisonDifferences?: ComparisonDifference[];
  partiesSummary?: string;
}

export interface NegotiationEmailResponse {
  draft: NegotiationEmailDraft;
  metadata: ExtractionResultMetadata;
}

export interface NegotiationEmailWorkspaceProps {
  documentFilename: string;
  documentType?: DocumentType;
  clauses: Clause[];
  comparisonDifferences?: ComparisonDifference[];
  onClose?: () => void;
  className?: string;
}
