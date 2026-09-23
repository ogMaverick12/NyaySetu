export { IntakeDesk } from "./components/intake-desk";
export { useDocumentIngestion } from "./hooks/use-document-ingestion";
export {
  normalizeDocument,
  cleanRawText,
  countWords,
  type RawPageInput,
  type BuildParsedDocumentParams,
} from "./services/normalizer";
// NOTE: server-only extractor (unpdf + tesseract.js) is intentionally NOT
// re-exported here. Import it directly via
// "@/features/ingestion/services/extractor" from API routes only, so the
// heavy native-PDF/OCR stack never enters the client first-paint bundle.
export {
  type ParsedDocument,
  type PageContent,
  type IngestionStatus,
  type IngestionProgress,
  ParsedDocumentSchema,
  PageContentSchema,
} from "./types";
