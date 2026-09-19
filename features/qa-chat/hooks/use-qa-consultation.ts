"use client";

import { useState, useCallback } from "react";
import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { type QACitation, type QAResponse, type QATranscriptItem } from "../types";
import { lawyerChecklistStore } from "@/features/checklist-export";

export type { QATranscriptItem };

export type OnFlagForLawyerCallback = (
  questionText: string,
  rationale?: string,
  isFlagged?: boolean
) => void;

export function useQAConsultation(
  activeDoc: ParsedDocument,
  clauses?: Clause[],
  onFlagForLawyer?: OnFlagForLawyerCallback
) {
  const [transcript, setTranscript] = useState<QATranscriptItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<QACitation | null>(null);

  const askQuestion = useCallback(
    async (queryText: string) => {
      const trimmed = queryText.trim();
      if (!trimmed) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const res = await fetch("/api/qa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doc: activeDoc,
            question: trimmed,
            clauses,
          }),
        });

        if (!res.ok) {
          const errData = (await res.json()) as { error?: string };
          throw new Error(errData.error || `Request failed with status ${res.status}`);
        }

        const data = (await res.json()) as { success: boolean; result: QAResponse };
        const result = data.result;

        const newItem: QATranscriptItem = {
          id: `item_${Date.now()}_${transcript.length + 1}`,
          itemNumber: transcript.length + 1,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          question: trimmed,
          answer: result.answer,
          isCovered: result.isCovered,
          citations: result.citations || [],
          lawyerPrepSuggestion: result.lawyerPrepSuggestion,
          provider: result.metadata?.provider,
          isFlaggedForLawyer: lawyerChecklistStore.hasQuestion(trimmed),
        };

        setTranscript((prev) => [...prev, newItem]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to answer query";
        setError(msg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeDoc, clauses, transcript.length]
  );

  const toggleFlagForLawyer = useCallback(
    (itemId: string) => {
      setTranscript((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            const nextState = !item.isFlaggedForLawyer;
            // Persist to the shared lawyerChecklistStore
            lawyerChecklistStore.toggleQuestion(item.question, nextState);

            if (onFlagForLawyer) {
              onFlagForLawyer(item.question, item.lawyerPrepSuggestion || item.answer);
            }
            return { ...item, isFlaggedForLawyer: nextState };
          }
          return item;
        })
      );
    },
    [onFlagForLawyer]
  );

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    setError(null);
  }, []);

  return {
    transcript,
    isSubmitting,
    error,
    activeCitation,
    setActiveCitation,
    askQuestion,
    toggleFlagForLawyer,
    clearTranscript,
  };
}
