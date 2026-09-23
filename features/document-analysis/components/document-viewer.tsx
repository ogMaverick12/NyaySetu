"use client";

import React, { useState, useEffect } from "react";
import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { Button } from "@/ui/button";
import { ChevronLeft, ChevronRight, FileText, Bookmark } from "lucide-react";

interface DocumentViewerProps {
  document: ParsedDocument;
  selectedClause: Clause | null;
}

export function DocumentViewer({ document, selectedClause }: DocumentViewerProps): JSX.Element {
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Auto-navigate to clause page when a clause is selected
  useEffect(() => {
    if (selectedClause) {
      setCurrentPage(selectedClause.page);
    }
  }, [selectedClause]);

  const activePageContent =
    document.pages.find((p) => p.pageNumber === currentPage) || document.pages[0];

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(document.pageCount, prev + 1));
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card shadow-sm">
      {/* Top Document Header & Page Pagination */}
      <div className="flex items-center justify-between border-b border-border/80 bg-parchment/60 px-4 py-3 sm:px-6">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <FileText className="h-4 w-4 shrink-0 text-[#684B1E]" />
          <span className="truncate font-serif text-sm font-semibold text-primary">
            {document.filename}
          </span>
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            ({document.isOcr ? "OCR Document" : "Native PDF"})
          </span>
        </div>

        {/* Page Switcher */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            aria-label="Previous Page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <span className="font-mono text-xs text-muted-foreground">
            Page <span className="font-bold text-primary">{currentPage}</span> of{" "}
            {document.pageCount}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextPage}
            disabled={currentPage >= document.pageCount}
            aria-label="Next Page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Selected Clause Notice Banner */}
      {selectedClause && selectedClause.page === currentPage && (
        <div className="flex items-center justify-between border-b border-[#B08D57]/30 bg-[#FAF4E8] px-4 py-2 text-xs text-[#684B1E]">
          <div className="flex items-center space-x-1.5 truncate">
            <Bookmark className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-semibold">
              Highlighting: {selectedClause.type.replace(/_/g, " ")}
            </span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            ID: {selectedClause.id}
          </span>
        </div>
      )}

      {/* Page Document Paper Canvas */}
      <div className="flex-1 overflow-y-auto bg-[#FDFBF7] p-4 sm:p-6 lg:p-8">
        <div className="shadow-xs relative mx-auto min-h-[480px] max-w-2xl rounded border border-border/70 bg-[#FFFFFF] p-6 sm:p-8">
          {/* Subtle Watermark Stamp */}
          <div className="absolute right-4 top-4 select-none font-mono text-[10px] uppercase text-muted-foreground/40">
            PAGE {currentPage} • ORIGINAL DRAFT
          </div>

          {/* Verbatim Page Text Content */}
          <div className="space-y-4 whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/90 sm:text-sm">
            {activePageContent?.text ? (
              activePageContent.text
            ) : (
              <p className="italic text-muted-foreground">No text recorded on this page.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
