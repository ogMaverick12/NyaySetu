"use client";

import { useState, useCallback } from "react";
import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { type Citation, type QAResponse } from "../types";

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

export function useQAConsultation(
  activeDoc: ParsedDocument | null,
  clauses?: Clause[],
  onFlagForLawyer?: (questionText: string, rationale?: string) => void
) {
  const [transcript, setTranscript] = useState<QATranscriptItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  const askQuestion = useCallback(
    async (queryText: string) => {
      const trimmed = queryText.trim();
      if (!trimmed || !activeDoc) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const res = await fetch("/api/qa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doc: activeDoc,
            question: trimmed,
            clauses: clauses || [],
          }),
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || `Consultation request failed with HTTP ${res.status}`);
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
          isFlaggedForLawyer: false,
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
            if (nextState && onFlagForLawyer) {
              onFlagForLawyer(
                `Question: ${item.question}`,
                item.lawyerPrepSuggestion || item.answer
              );
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
