import { type Clause } from "@/features/extraction/types";
import { type ParsedDocument } from "@/features/ingestion/types";

export type ReadingLevel = "plain" | "detailed";

export interface DocumentAnalysisProps {
  document: ParsedDocument;
  clauses: Clause[];
  extractionStatus: "idle" | "extracting" | "success" | "error";
  flaggedForLawyer: Set<string>;
  onToggleFlag: (clauseId: string) => void;
  onProceedToCompare?: () => void;
}
