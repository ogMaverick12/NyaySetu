"use client";

import { useState } from "react";
import { type ChecklistItem } from "../types";
import { Scale, Copy, Check, ShieldAlert } from "lucide-react";

interface LawyerQuestionsCardProps {
  questions: ChecklistItem[];
}

export function LawyerQuestionsCard({ questions }: LawyerQuestionsCardProps): JSX.Element {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section
      className="space-y-4 rounded-lg border-2 border-[#B08D57]/40 bg-[#FBF9F4] p-6 shadow-sm"
      aria-labelledby="lawyer-questions-heading"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-[#E0D7C6] pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded bg-[#B08D57]/10 p-1.5 text-[#8C6D3B]">
            <Scale className="h-4 w-4" />
          </div>
          <div>
            <h3
              id="lawyer-questions-heading"
              className="font-serif text-base font-semibold text-[#1B2430]"
            >
              Questions for Your Legal Advisor / Advocate
            </h3>
            <p className="text-xs text-[#525D6B]">
              Seeded directly from high-risk provisions detected in your contract
            </p>
          </div>
        </div>

        <span className="rounded border border-[#8C2F39]/20 bg-[#8C2F39]/10 px-2 py-0.5 font-mono text-xs font-medium text-[#8C2F39]">
          {questions.length} Question{questions.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Question Items List */}
      <div className="space-y-3">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="group flex items-start justify-between gap-3 rounded border border-[#E0D7C6] bg-white p-3.5 transition-colors hover:border-[#B08D57]/60"
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-[#8C6D3B]">
                Q{idx + 1}.
              </span>
              <div className="space-y-1">
                <p className="text-xs font-medium leading-relaxed text-[#1B2430]">{q.text}</p>
                {q.sourceClauseId && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#525D6B]">
                    <ShieldAlert className="h-2.5 w-2.5 text-[#8C2F39]" />
                    Seeded from clause {q.sourceClauseId}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(q.id, q.text)}
              className="shrink-0 rounded p-1.5 text-xs text-[#525D6B] opacity-60 transition-opacity hover:bg-[#F7F3EA] hover:text-[#1B2430] group-hover:opacity-100"
              aria-label={`Copy question ${idx + 1}`}
            >
              {copiedId === q.id ? (
                <Check className="h-3.5 w-3.5 text-[#3F6C51]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
