"use client";

import { useState, useCallback, useMemo } from "react";
import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause, type ClauseRiskFilter, type ClauseExtractionState } from "../types";
import { type ExtractionResultMetadata } from "@/lib/llm/types";

export interface UseClauseExtractionReturn {
  clauses: Clause[];
  filteredClauses: Clause[];
  highRiskClauses: Clause[];
  state: ClauseExtractionState;
  metadata: ExtractionResultMetadata | null;
  activeFilter: ClauseRiskFilter;
  setActiveFilter: (filter: ClauseRiskFilter) => void;
  flaggedForLawyer: Set<string>;
  toggleFlagForLawyer: (clauseId: string) => void;
  extractClauses: (doc: ParsedDocument) => Promise<Clause[] | null>;
  reset: () => void;
}

export function useClauseExtraction(): UseClauseExtractionReturn {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [metadata, setMetadata] = useState<ExtractionResultMetadata | null>(null);
  const [state, setState] = useState<ClauseExtractionState>({
    status: "idle",
    clauses: [],
    error: null,
  });
  const [activeFilter, setActiveFilter] = useState<ClauseRiskFilter>("all");
  const [flaggedForLawyer, setFlaggedForLawyer] = useState<Set<string>>(new Set());

  const extractClauses = useCallback(async (doc: ParsedDocument): Promise<Clause[] | null> => {
    setState({
      status: "extracting",
      clauses: [],
      error: null,
    });

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ document: doc }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        clauses?: Clause[];
        metadata?: ExtractionResultMetadata;
        error?: string;
      };

      if (!response.ok || !data.clauses) {
        throw new Error(data.error || "Failed to extract clauses from document.");
      }

      setClauses(data.clauses);
      setMetadata(data.metadata || null);

      // Pre-flag all high-risk clauses for lawyer prep automatically
      const highRiskIds = new Set(
        data.clauses.filter((c) => c.riskLevel === "high-risk").map((c) => c.id)
      );
      setFlaggedForLawyer(highRiskIds);

      setState({
        status: "success",
        clauses: data.clauses,
        providerUsed: data.metadata?.provider,
        fallbackTriggered: data.metadata?.fallbackTriggered,
        latencyMs: data.metadata?.latencyMs,
        error: null,
      });

      return data.clauses;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Clause extraction failed";
      setState({
        status: "error",
        clauses: [],
        error: errorMsg,
      });
      return null;
    }
  }, []);

  const toggleFlagForLawyer = useCallback((clauseId: string) => {
    setFlaggedForLawyer((prev) => {
      const next = new Set(prev);
      if (next.has(clauseId)) {
        next.delete(clauseId);
      } else {
        next.add(clauseId);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setClauses([]);
    setMetadata(null);
    setState({
      status: "idle",
      clauses: [],
      error: null,
    });
    setActiveFilter("all");
    setFlaggedForLawyer(new Set());
  }, []);

  const filteredClauses = useMemo(() => {
    if (activeFilter === "all") return clauses;
    return clauses.filter((c) => c.riskLevel === activeFilter);
  }, [clauses, activeFilter]);

  const highRiskClauses = useMemo(() => {
    return clauses.filter((c) => c.riskLevel === "high-risk");
  }, [clauses]);

  return {
    clauses,
    filteredClauses,
    highRiskClauses,
    state,
    metadata,
    activeFilter,
    setActiveFilter,
    flaggedForLawyer,
    toggleFlagForLawyer,
    extractClauses,
    reset,
  };
}
