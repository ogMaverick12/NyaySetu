import { z } from "zod";
import { type ExtractionResultMetadata } from "@/lib/llm/types";

export const CitationSchema = z.object({
  page: z.number().int().positive(),
  clauseId: z.string().optional(),
  clauseTitle: z.string().optional(),
  excerpt: z.string().min(1),
});

export type Citation = z.infer<typeof CitationSchema>;
export type QACitation = Citation;

export const QAResponseSchema = z.object({
  answer: z.string().min(1),
  isCovered: z.boolean(),
  citations: z.array(CitationSchema),
  lawyerPrepSuggestion: z.string().optional(),
});

export type QAResponsePayload = z.infer<typeof QAResponseSchema>;

export interface QAResponse extends QAResponsePayload {
  metadata: ExtractionResultMetadata;
}

export interface QAMessage {
  id: string;
  role: "user" | "assistant";
  question?: string;
  answer?: string;
  timestamp: string;
  isCovered?: boolean;
  citations?: Citation[];
  lawyerPrepSuggestion?: string;
  provider?: string;
  isFlaggedForLawyer?: boolean;
}

export interface QATranscriptItem {
  id: string;
  itemNumber: number;
  timestamp: string;
  question: string;
  answer: string;
  isCovered: boolean;
  citations: Citation[];
  lawyerPrepSuggestion?: string;
  provider?: string;
  isFlaggedForLawyer: boolean;
}

export interface DocumentContextChunk {
  id: string;
  page: number;
  clauseId?: string;
  title?: string;
  text: string;
}
