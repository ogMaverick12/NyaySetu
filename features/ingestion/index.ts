export { IntakeDesk } from "./components/intake-desk";
export { useDocumentIngestion } from "./hooks/use-document-ingestion";
export {
  normalizeDocument,
  cleanRawText,
  countWords,
  type RawPageInput,
  type BuildParsedDocumentParams,
} from "./services/normalizer";
export {
  extractDocumentContent,
  extractTextFromPdf,
  extractTextFromImage,
  type ExtractionResult,
} from "./services/extractor";
export {
  type ParsedDocument,
  type PageContent,
  type IngestionStatus,
  type IngestionProgress,
  ParsedDocumentSchema,
  PageContentSchema,
} from "./types";
