"use client";

import { motion } from "framer-motion";
import { type QATranscriptItem } from "../hooks/use-qa-consultation";
import { ReferenceChip } from "./reference-chip";
import { ShieldAlert, CheckCircle2, BookmarkPlus, Check, HelpCircle } from "lucide-react";
import { slideUp } from "@/motion-variants";

interface TranscriptEntryProps {
  item: QATranscriptItem;
  onToggleFlagLawyer?: (itemId: string) => void;
  onToggleFlag?: (itemId: string) => void;
  onJumpToPage?: (page: number) => void;
}

export function TranscriptEntry({
  item,
  onToggleFlagLawyer,
  onToggleFlag,
  onJumpToPage,
}: TranscriptEntryProps): JSX.Element {
  const formattedNumber = String(item.itemNumber).padStart(2, "0");

  const handleToggle = () => {
    if (onToggleFlagLawyer) {
      onToggleFlagLawyer(item.id);
    } else if (onToggleFlag) {
      onToggleFlag(item.id);
    }
  };

  return (
    <motion.article
      variants={slideUp}
      initial="hidden"
      animate="visible"
      className="rounded-lg border border-[#E0D7C6] bg-[#FBF9F4] p-5 shadow-sm transition-all"
    >
      {/* Transcript Item Meta Header */}
      <div className="flex items-center justify-between border-b border-[#E0D7C6]/60 pb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold uppercase tracking-wider text-[#B08D57]">
            CONSULTATION RECORD · ENTRY #{formattedNumber}
          </span>
          <span className="text-[#8A94A1]">|</span>
          <span className="font-mono text-[#525D6B]">{item.timestamp}</span>
        </div>

        {/* Scope status */}
        <div className="flex items-center gap-1.5">
          {item.isCovered ? (
            <span className="inline-flex items-center gap-1 rounded border border-[#3F6C51]/20 bg-[#3F6C51]/10 px-2 py-0.5 font-mono text-[11px] text-[#3F6C51]">
              <CheckCircle2 className="h-3 w-3" />
              Document Grounded
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded border border-[#8C2F39]/20 bg-[#8C2F39]/10 px-2 py-0.5 font-mono text-[11px] text-[#8C2F39]">
              <ShieldAlert className="h-3 w-3" />
              Not Covered in Document
            </span>
          )}
        </div>
      </div>

      {/* 1. YOU ASKED Section */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-2">
          <HelpCircle className="h-3.5 w-3.5 text-[#525D6B]" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#525D6B]">
            You Asked:
          </span>
        </div>
        <div className="pl-5 text-sm font-medium leading-relaxed text-[#1B2430]">
          &ldquo;{item.question}&rdquo;
        </div>
      </div>

      {/* 2. THE DOCUMENT SAYS Section */}
      <div className="mt-4 border-t border-[#E0D7C6]/40 pt-3">
        <span className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#525D6B]">
          The Document Says:
        </span>
        <div className="pl-5 text-sm leading-relaxed text-[#1B2430]">{item.answer}</div>
      </div>

      {/* 3. Citations Chips Row (If in-scope) */}
      {item.isCovered && item.citations && item.citations.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E0D7C6]/40 pt-3">
          <span className="mr-1 font-mono text-xs text-[#525D6B]">Citations:</span>
          {item.citations.map((cit, idx) => (
            <ReferenceChip
              key={`${item.id}_cit_${idx}`}
              citation={cit}
              onJumpToPage={onJumpToPage}
            />
          ))}
        </div>
      )}

      {/* 4. Out-of-Scope Warning & Lawyer-Prep Checklist Escalation */}
      {!item.isCovered && (
        <div className="mt-4 rounded border border-[#8C2F39]/20 bg-[#8C2F39]/5 p-3.5">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#8C2F39]" />
            <div className="space-y-2 text-xs">
              <p className="font-medium leading-relaxed text-[#8C2F39]">
                {item.lawyerPrepSuggestion ||
                  "This inquiry falls outside the four corners of the uploaded agreement. NyaySetu provides grounded contract reading rather than unrestricted legal advice."}
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleToggle}
                  className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                    item.isFlaggedForLawyer
                      ? "border-[#3F6C51] bg-[#3F6C51] text-white"
                      : "border-[#8C2F39]/40 bg-[#FDFBF7] text-[#8C2F39] hover:bg-[#8C2F39]/10"
                  }`}
                  aria-label="Add question to lawyer prep checklist"
                >
                  {item.isFlaggedForLawyer ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Added to Lawyer Checklist
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      Add to Lawyer-Prep Checklist
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.article>
  );
}
