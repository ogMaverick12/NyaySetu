"use client";

import { useState } from "react";
import { type Citation } from "../types";
import { BookOpen, X } from "lucide-react";

interface ReferenceChipProps {
  citation: Citation;
  onJumpToPage?: (page: number) => void;
}

export function ReferenceChip({ citation, onJumpToPage }: ReferenceChipProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  const label = citation.clauseTitle
    ? `p. ${citation.page} § ${citation.clauseTitle}`
    : `p. ${citation.page} § Ref`;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (onJumpToPage) onJumpToPage(citation.page);
        }}
        className="inline-flex items-center gap-1.5 rounded border border-[#B08D57]/30 bg-[#B08D57]/10 px-2.5 py-1 font-mono text-xs text-[#8C6D3B] transition-colors hover:border-[#B08D57]/50 hover:bg-[#B08D57]/20 focus:outline-none focus:ring-2 focus:ring-[#B08D57]/30"
        aria-expanded={isOpen}
        aria-label={`Citation: Page ${citation.page}, ${citation.clauseTitle || "clause excerpt"}`}
      >
        <BookOpen className="h-3 w-3 text-[#B08D57]" aria-hidden="true" />
        <span>[{label}]</span>
      </button>

      {isOpen && (
        <div
          role="region"
          aria-label={`Citation details for page ${citation.page}`}
          className="absolute bottom-full left-0 z-20 mb-2 w-80 max-w-[90vw] rounded border border-[#E0D7C6] bg-[#FDFBF7] p-3 font-sans text-xs text-[#1B2430] shadow-lg"
        >
          <div className="mb-1.5 flex items-center justify-between border-b border-[#E0D7C6] pb-1.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#8C6D3B]">
              Verbatim Excerpt · Page {citation.page}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded p-0.5 text-[#525D6B] hover:text-[#1B2430]"
              aria-label="Close excerpt preview"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="rounded border border-[#E0D7C6]/60 bg-[#F7F3EA] p-2 font-mono text-[11px] italic leading-relaxed text-[#1B2430]">
            &ldquo;{citation.excerpt}&rdquo;
          </p>
          {citation.clauseTitle && (
            <div className="mt-2 flex items-center justify-between text-[10px] text-[#525D6B]">
              <span>
                Section: <strong>{citation.clauseTitle}</strong>
              </span>
              {citation.clauseId && <span className="font-mono">ID: {citation.clauseId}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
