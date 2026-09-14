import { z } from "zod";

export const PageContentSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string(),
  charCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
});

export type PageContent = z.infer<typeof PageContentSchema>;

export const ParsedDocumentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/jpg"]),
  fileSizeBytes: z.number().int().nonnegative(),
  pageCount: z.number().int().positive(),
  pages: z.array(PageContentSchema),
  fullText: z.string(),
  isOcr: z.boolean(),
  createdAt: z.string(),
});

export type ParsedDocument = z.infer<typeof ParsedDocumentSchema>;

export type IngestionStatus = "idle" | "selected" | "uploading" | "scanning" | "ready" | "error";

export interface IngestionProgress {
  status: IngestionStatus;
  progressPercent: number;
  statusMessage: string;
  error?: string | null;
}
