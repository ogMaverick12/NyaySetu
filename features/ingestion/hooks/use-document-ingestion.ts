"use client";

import { useState, useCallback } from "react";
import { type ParsedDocument, type IngestionStatus, type IngestionProgress } from "../types";

export interface UseDocumentIngestionReturn {
  document: ParsedDocument | null;
  status: IngestionStatus;
  selectedFile: File | null;
  progress: IngestionProgress;
  selectFile: (file: File) => void;
  ingestFile: (file?: File) => Promise<ParsedDocument | null>;
  reset: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

export function useDocumentIngestion(): UseDocumentIngestionReturn {
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<IngestionStatus>("idle");
  const [progress, setProgress] = useState<IngestionProgress>({
    status: "idle",
    progressPercent: 0,
    statusMessage: "Ready for document intake",
    error: null,
  });

  const selectFile = useCallback((file: File) => {
    const isExtensionValid = ACCEPTED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!isExtensionValid) {
      setProgress({
        status: "error",
        progressPercent: 0,
        statusMessage: "Unsupported file type",
        error: "Please select a PDF or image file (JPG, PNG).",
      });
      setStatus("error");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setProgress({
        status: "error",
        progressPercent: 0,
        statusMessage: "File too large",
        error: "Maximum document size is 10MB.",
      });
      setStatus("error");
      return;
    }

    setSelectedFile(file);
    setStatus("selected");
    setProgress({
      status: "selected",
      progressPercent: 10,
      statusMessage: `Document ready: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      error: null,
    });
  }, []);

  const ingestFile = useCallback(
    async (fileToIngest?: File): Promise<ParsedDocument | null> => {
      const targetFile = fileToIngest || selectedFile;
      if (!targetFile) {
        setProgress({
          status: "error",
          progressPercent: 0,
          statusMessage: "No document selected",
          error: "Please provide a document to process.",
        });
        setStatus("error");
        return null;
      }

      try {
        setStatus("uploading");
        setProgress({
          status: "uploading",
          progressPercent: 30,
          statusMessage: "Securing case document on intake desk...",
          error: null,
        });

        const formData = new FormData();
        formData.append("file", targetFile);

        setStatus("scanning");
        setProgress({
          status: "scanning",
          progressPercent: 60,
          statusMessage: targetFile.name.endsWith(".pdf")
            ? "Extracting page-anchored legal text..."
            : "Running OCR visual text extraction...",
          error: null,
        });

        const response = await fetch("/api/ingest", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json()) as {
          success?: boolean;
          document?: ParsedDocument;
          error?: string;
        };

        if (!response.ok || !data.document) {
          throw new Error(data.error || "Failed to parse document");
        }

        setDocument(data.document);
        setStatus("ready");
        setProgress({
          status: "ready",
          progressPercent: 100,
          statusMessage: `Parsed ${data.document.pageCount} page(s) successfully (${data.document.pages.reduce((acc, p) => acc + p.wordCount, 0)} words).`,
          error: null,
        });

        return data.document;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Ingestion failed";
        setStatus("error");
        setProgress({
          status: "error",
          progressPercent: 0,
          statusMessage: "Intake error",
          error: errorMsg,
        });
        return null;
      }
    },
    [selectedFile]
  );

  const reset = useCallback(() => {
    setDocument(null);
    setSelectedFile(null);
    setStatus("idle");
    setProgress({
      status: "idle",
      progressPercent: 0,
      statusMessage: "Ready for document intake",
      error: null,
    });
  }, []);

  return {
    document,
    status,
    selectedFile,
    progress,
    selectFile,
    ingestFile,
    reset,
  };
}
