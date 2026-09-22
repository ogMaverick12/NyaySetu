"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { type Clause, type DocumentType } from "@/features/extraction";
import { type ComparisonDifference } from "@/features/compare/types";
import { NegotiationEmailDraftSchema, type NegotiationEmailDraft } from "../types";
import { negotiationEmailStore } from "../store/negotiation-email-store";
import { sanitizePlainText } from "../services/negotiation-validator";

export interface UseNegotiationEmailDraftOptions {
  documentFilename: string;
  documentType?: DocumentType;
  clauses: Clause[];
  comparisonDifferences?: ComparisonDifference[];
  autoGenerate?: boolean;
}

export type GenerationStatus = "idle" | "generating" | "streaming" | "success" | "error";

export interface UseNegotiationEmailDraftReturn {
  draft: NegotiationEmailDraft | null;
  subject: string;
  body: string;
  citedClauseIds: string[];
  status: GenerationStatus;
  isGenerating: boolean;
  error: string | null;
  streamingBody: string;
  generateDraft: (options?: { forceRegenerate?: boolean }) => Promise<void>;
  updateSubject: (newSubject: string) => void;
  updateBody: (newBody: string) => void;
  reset: () => void;
}

export function useNegotiationEmailDraft({
  documentFilename,
  documentType = "tenancy",
  clauses,
  comparisonDifferences = [],
  autoGenerate = false,
}: UseNegotiationEmailDraftOptions): UseNegotiationEmailDraftReturn {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [citedClauseIds, setCitedClauseIds] = useState<string[]>([]);
  const [streamingBody, setStreamingBody] = useState<string>("");

  // In-flight guard to prevent duplicate concurrent submissions
  const isGeneratingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Subscribe to external store changes
  const cachedDraft = useSyncExternalStore(
    negotiationEmailStore.subscribe,
    () => negotiationEmailStore.getDraft(documentFilename),
    () => null
  );

  // Load from cache if present and idle
  useEffect(() => {
    if (cachedDraft && status === "idle" && !isGeneratingRef.current) {
      setSubject(cachedDraft.subject);
      setBody(cachedDraft.body);
      setCitedClauseIds(cachedDraft.citedClauseIds || []);
      setStatus("success");
    }
  }, [cachedDraft, status]);

  const updateSubject = useCallback(
    (newSubject: string) => {
      setSubject(newSubject);
      // Sync with store if draft is already established
      const existing = negotiationEmailStore.getDraft(documentFilename);
      if (existing) {
        negotiationEmailStore.setDraft(documentFilename, {
          ...existing,
          subject: newSubject,
        });
      }
    },
    [documentFilename]
  );

  const updateBody = useCallback(
    (newBody: string) => {
      setBody(newBody);
      // Sync with store if draft is already established
      const existing = negotiationEmailStore.getDraft(documentFilename);
      if (existing) {
        negotiationEmailStore.setDraft(documentFilename, {
          ...existing,
          body: newBody,
        });
      }
    },
    [documentFilename]
  );

  const generateDraft = useCallback(
    async ({ forceRegenerate = false }: { forceRegenerate?: boolean } = {}) => {
      // 1. Guard against duplicate submissions while request is in flight
      if (isGeneratingRef.current) {
        return;
      }

      // 2. If cached draft exists and not explicitly regenerating, use cache
      if (!forceRegenerate) {
        const stored = negotiationEmailStore.getDraft(documentFilename);
        if (stored) {
          setSubject(stored.subject);
          setBody(stored.body);
          setCitedClauseIds(stored.citedClauseIds || []);
          setStatus("success");
          return;
        }
      }

      // Filter only high-risk and caution clauses
      const targetClauses = clauses.filter(
        (c) => c.riskLevel === "high-risk" || c.riskLevel === "caution"
      );

      // Filter disadvantageous differences
      const targetDiffs = (comparisonDifferences || []).filter(
        (d) => d.impactOnUser === "disadvantageous"
      );

      isGeneratingRef.current = true;
      setStatus("generating");
      setError(null);
      setStreamingBody("");

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/negotiation-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentType,
            documentFilename,
            clauses: targetClauses.length > 0 ? targetClauses : clauses,
            comparisonDifferences: targetDiffs,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errData = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || `Generation failed with status ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";

        // Progressive stream handling
        if (contentType.includes("text/event-stream") && response.body) {
          setStatus("streaming");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulatedBody = "";
          let finalDraft: NegotiationEmailDraft | null = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkStr = decoder.decode(value, { stream: true });
            const lines = chunkStr.split("\n");

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.replace(/^data:\s*/, "").trim();
              if (!jsonStr) continue;

              try {
                const eventData = JSON.parse(jsonStr) as
                  | { type: "start"; subject: string; citedClauseIds: string[] }
                  | { type: "delta"; chunk: string }
                  | { type: "complete"; draft: NegotiationEmailDraft };

                if (eventData.type === "start") {
                  setSubject(sanitizePlainText(eventData.subject));
                  setCitedClauseIds(eventData.citedClauseIds || []);
                } else if (eventData.type === "delta") {
                  accumulatedBody += eventData.chunk;
                  setStreamingBody(accumulatedBody);
                } else if (eventData.type === "complete") {
                  finalDraft = NegotiationEmailDraftSchema.parse(eventData.draft);
                }
              } catch {
                // Ignore chunk parse anomalies
              }
            }
          }

          if (finalDraft) {
            setSubject(finalDraft.subject);
            setBody(finalDraft.body);
            setCitedClauseIds(finalDraft.citedClauseIds);
            negotiationEmailStore.setDraft(documentFilename, finalDraft);
            setStatus("success");
          } else if (accumulatedBody) {
            const fallbackDraft: NegotiationEmailDraft = {
              subject: subject || `Discussion regarding terms for ${documentFilename}`,
              body: sanitizePlainText(accumulatedBody),
              citedClauseIds,
            };
            setBody(fallbackDraft.body);
            negotiationEmailStore.setDraft(documentFilename, fallbackDraft);
            setStatus("success");
          } else {
            throw new Error("Stream closed without producing complete draft content.");
          }
        } else {
          // Standard JSON payload fallback
          const data = (await response.json()) as { draft: NegotiationEmailDraft };
          const validated = NegotiationEmailDraftSchema.parse(data.draft);

          setSubject(validated.subject);
          setBody(validated.body);
          setCitedClauseIds(validated.citedClauseIds);
          negotiationEmailStore.setDraft(documentFilename, validated);
          setStatus("success");
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const errorMsg =
          err instanceof Error ? err.message : "Failed to generate negotiation email.";
        setError(errorMsg);
        setStatus("error");
      } finally {
        isGeneratingRef.current = false;
        setStreamingBody("");
      }
    },
    [documentFilename, documentType, clauses, comparisonDifferences, subject, citedClauseIds]
  );

  // Auto-generate on initial load if requested and no cached draft exists
  useEffect(() => {
    if (autoGenerate && status === "idle" && !cachedDraft && !isGeneratingRef.current) {
      void generateDraft();
    }
  }, [autoGenerate, status, cachedDraft, generateDraft]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isGeneratingRef.current = false;
    setStatus("idle");
    setError(null);
    setSubject("");
    setBody("");
    setCitedClauseIds([]);
    setStreamingBody("");
    negotiationEmailStore.clear();
  }, []);

  const draft: NegotiationEmailDraft | null =
    status === "success" || body
      ? {
          subject,
          body,
          citedClauseIds,
        }
      : null;

  return {
    draft,
    subject,
    body,
    citedClauseIds,
    status,
    isGenerating: isGeneratingRef.current || status === "generating" || status === "streaming",
    error,
    streamingBody,
    generateDraft,
    updateSubject,
    updateBody,
    reset,
  };
}
