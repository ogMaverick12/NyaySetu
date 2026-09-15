"use client";

import React, { useState } from "react";
import { type Clause } from "@/features/extraction/types";
import { type DocumentAnalysisProps } from "../types";
import { DocumentViewer } from "./document-viewer";
import { MarginNotesColumn } from "./margin-notes-column";

export function DocumentAnalysisScreen({
  document,
  clauses,
  extractionStatus,
  flaggedForLawyer,
  onToggleFlag,
  onProceedToCompare,
}: DocumentAnalysisProps): JSX.Element {
  const [selectedClause, setSelectedClause] = useState<Clause | null>(
    clauses.length > 0 ? clauses[0] : null
  );

  return (
    <div className="space-y-4">
      {/* Overview Context Bar */}
      <div className="flex flex-col justify-between gap-2 border-b border-border/80 pb-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-serif text-xl font-bold text-primary">
            Document Analysis &amp; Margin Annotations
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            SPLIT VIEW: Original Contract (Left) • Margin Note Annotations (Right)
          </p>
        </div>

        <div className="font-mono text-xs text-muted-foreground">
          {document.pageCount} page(s) mapped • {clauses.length} clauses analyzed
        </div>
      </div>

      {/* Split-View Workspace Container */}
      <div className="grid min-h-[640px] grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Pane: Original Page-Anchored Document (50% on desktop) */}
        <div className="h-[680px] lg:col-span-6">
          <DocumentViewer document={document} selectedClause={selectedClause} />
        </div>

        {/* Right Pane: Margin Notes Column with Reading-Level Toggle (50% on desktop) */}
        <div className="h-[680px] lg:col-span-6">
          <MarginNotesColumn
            clauses={clauses}
            extractionStatus={extractionStatus}
            selectedClause={selectedClause}
            onSelectClause={setSelectedClause}
            flaggedForLawyer={flaggedForLawyer}
            onToggleFlag={onToggleFlag}
            onProceedToCompare={onProceedToCompare}
          />
        </div>
      </div>
    </div>
  );
}
