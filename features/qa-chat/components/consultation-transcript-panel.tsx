"use client";

import { useState } from "react";
import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { useQAConsultation } from "../hooks/use-qa-consultation";
import { TranscriptEntry } from "./transcript-entry";
import { useSpeechRecognition } from "@/features/accessibility";
import { Button } from "@/ui/button";
import {
  Send,
  FileText,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Mic,
  MicOff,
  Scale,
  Lock,
} from "lucide-react";

interface ConsultationTranscriptPanelProps {
  doc: ParsedDocument;
  clauses?: Clause[];
  extractionStatus?: "idle" | "extracting" | "success" | "error";
  onRunExtraction?: () => void;
  onFlagForLawyer?: (questionText: string, rationale?: string, isFlagged?: boolean) => void;
  onJumpToPage?: (page: number) => void;
}

export function ConsultationTranscriptPanel({
  doc,
  clauses = [],
  extractionStatus = "idle",
  onRunExtraction,
  onFlagForLawyer,
  onJumpToPage,
}: ConsultationTranscriptPanelProps): JSX.Element {
  const [inputQuery, setInputQuery] = useState("");
  const { transcript, isSubmitting, error, askQuestion, toggleFlagForLawyer, clearTranscript } =
    useQAConsultation(doc, clauses, onFlagForLawyer);

  const isExtractionComplete =
    (extractionStatus === "success" || clauses.length > 0) && extractionStatus !== "extracting";

  const {
    isListening,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition((transcriptText: string) => {
    setInputQuery((prev) => (prev ? `${prev} ${transcriptText}` : transcriptText));
  });

  const toggleListening = () => {
    if (!isExtractionComplete) return;
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isExtractionComplete || !inputQuery.trim() || isSubmitting) return;

    void askQuestion(inputQuery);
    setInputQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Determine suggested inquiries based on document keywords
  const isTenancy = /tenan|rent|lease|landlord/i.test(doc.fullText);
  const isGig = /partner|platform|delivery|gig|driver/i.test(doc.fullText);

  const suggestedQueries = isTenancy
    ? [
        "What is the security deposit amount and refund terms?",
        "What are the notice period requirements for termination?",
        "Who is responsible for property maintenance and repairs?",
      ]
    : isGig
      ? [
          "Under what conditions can the platform deactivate my account?",
          "Is advance notice required prior to account suspension?",
          "What dispute resolution and arbitration provisions apply?",
        ]
      : [
          "Does this agreement contain a post-termination non-compete clause?",
          "What are the indemnification liabilities placed on me?",
          "What are the grounds and notice required for termination?",
        ];

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col space-y-6">
      {/* Header Banner */}
      <header className="flex flex-col gap-3 rounded-lg border border-[#E0D7C6] bg-[#FBF9F4] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-xl text-[#1B2430]">Document Consultation Transcript</h2>
            <span className="rounded border border-[#B08D57]/30 bg-[#B08D57]/10 px-2 py-0.5 font-mono text-[11px] font-medium text-[#684B1E]">
              PRD F5 Scoped RAG
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 font-sans text-xs text-[#525D6B]">
            <FileText className="h-3.5 w-3.5 text-[#684B1E]" />
            Consultation bounded strictly to:{" "}
            <span className="font-mono font-semibold text-[#1B2430]">{doc.filename}</span> (
            {doc.pageCount} pages)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {transcript.length > 0 && (
            <button
              type="button"
              onClick={clearTranscript}
              className="rounded border border-[#E0D7C6] bg-white px-3 py-1.5 font-mono text-xs text-[#525D6B] transition-colors hover:bg-[#F7F3EA] hover:text-[#1B2430]"
            >
              Clear Session
            </button>
          )}
        </div>
      </header>

      {/* Gating: Clear inline prompt if extraction has not finished */}
      {!isExtractionComplete && (
        <div className="rounded-lg border-2 border-[#B08D57]/40 bg-[#FBF9F4] p-6 shadow-sm">
          {extractionStatus === "extracting" ? (
            <div className="flex flex-col items-center space-y-3 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-[#B08D57]" />
              <h3 className="font-serif text-base font-semibold text-[#1B2430]">
                Indexing Document Clauses for Consultation...
              </h3>
              <p className="max-w-md text-xs leading-relaxed text-[#525D6B]">
                NyaySetu is currently reading and extracting clauses from{" "}
                <span className="font-semibold text-primary">{doc.filename}</span>. Consultation
                Q&amp;A will unlock automatically once extraction completes to prevent false
                negative answers (&ldquo;topic not covered&rdquo;).
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#B08D57]/10 text-[#8C6D3B]">
                <Scale className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-base font-semibold text-[#1B2430]">
                  Clause Extraction Required Before Consultation
                </h3>
                <p className="max-w-lg text-xs leading-relaxed text-[#525D6B]">
                  To prevent false negative responses (such as erroneously claiming a covered
                  provision is &ldquo;not covered in the provided document&rdquo;), NyaySetu
                  requires operative clause extraction to complete before accepting queries.
                </p>
              </div>
              {onRunExtraction && (
                <Button variant="brass" size="sm" onClick={onRunExtraction}>
                  <Scale className="mr-2 h-3.5 w-3.5" />
                  Extract Clauses &amp; Assess Risks
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Suggested Inquiries Chip Ribbon */}
      <section className="space-y-2" aria-labelledby="suggested-queries-heading">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#684B1E]">
          <Sparkles className="h-3.5 w-3.5" />
          <span id="suggested-queries-heading">Recommended Inquiries for this Document Type:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestedQueries.map((sq, idx) => (
            <button
              key={idx}
              type="button"
              disabled={!isExtractionComplete || isSubmitting}
              onClick={() => {
                if (!isExtractionComplete) return;
                setInputQuery(sq);
              }}
              className={`rounded-full border border-[#E0D7C6] bg-[#FBF9F4] px-3 py-1 font-sans text-xs transition-colors ${
                !isExtractionComplete
                  ? "cursor-not-allowed text-[#8A94A1] opacity-50"
                  : "text-[#1B2430] hover:border-[#684B1E] hover:bg-[#F7F3EA] focus:outline-none focus:ring-2 focus:ring-[#684B1E]/30"
              }`}
            >
              &ldquo;{sq}&rdquo;
            </button>
          ))}
        </div>
      </section>

      {/* Transcript Log Area */}
      <section
        className="flex-1 space-y-4"
        aria-label="Consultation inquiries log"
        aria-live="polite"
      >
        {transcript.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#E0D7C6] bg-[#FDFBF7] p-12 text-center">
            <FileText className="mb-2 h-8 w-8 text-[#8A94A1]" />
            <h3 className="font-serif text-sm font-semibold text-[#1B2430]">
              No Inquiries Submitted Yet
            </h3>
            <p className="mt-1 max-w-sm text-xs text-[#525D6B]">
              Ask a question about rights, obligations, deposit caps, or termination terms in this
              agreement. Every response includes verifiable page citations.
            </p>
          </div>
        ) : (
          transcript.map((item) => (
            <TranscriptEntry
              key={item.id}
              item={item}
              onToggleFlag={toggleFlagForLawyer}
              onToggleFlagLawyer={toggleFlagForLawyer}
              onJumpToPage={onJumpToPage}
            />
          ))
        )}

        {/* Live Submission Spinner */}
        {isSubmitting && (
          <div className="flex items-center gap-3 rounded-lg border border-[#E0D7C6] bg-[#FBF9F4] p-4 text-xs text-[#684B1E]">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="font-mono">
              Retrieving grounded citations and formulating legal analysis...
            </span>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-[#8C2F39]/30 bg-[#F7ECEE] p-3 text-xs text-[#8C2F39]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Query Input Box */}
      <form
        onSubmit={handleSubmit}
        className={`rounded-lg border bg-[#FBF9F4] p-3 shadow-sm transition-opacity ${
          !isExtractionComplete ? "border-[#E0D7C6]/60 opacity-75" : "border-[#E0D7C6]"
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !isExtractionComplete
                ? "Clause extraction required before consultation. Please run extraction above."
                : "Submit an inquiry regarding the provisions in this document (e.g., 'What happens on termination?')..."
            }
            rows={2}
            className={`flex-1 resize-none rounded border border-[#E0D7C6] p-3 font-sans text-sm text-[#1B2430] placeholder:text-[#8A94A1] focus:outline-none focus:ring-2 focus:ring-[#684B1E]/40 ${
              !isExtractionComplete ? "cursor-not-allowed bg-secondary/30" : "bg-[#FDFBF7]"
            }`}
            disabled={!isExtractionComplete || isSubmitting}
            aria-label="Document inquiry input"
          />
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isSpeechSupported && (
              <button
                type="button"
                disabled={!isExtractionComplete}
                onClick={toggleListening}
                className={`inline-flex items-center gap-1.5 rounded border px-3 py-2 font-mono text-xs font-medium transition-colors ${
                  !isExtractionComplete
                    ? "cursor-not-allowed border-[#E0D7C6] bg-white text-[#8A94A1] opacity-50"
                    : isListening
                      ? "animate-pulse border-[#8C2F39] bg-[#8C2F39] text-white"
                      : "border-[#E0D7C6] bg-white text-[#684B1E] hover:bg-[#F7F3EA] focus:outline-none focus:ring-2 focus:ring-[#684B1E]/40"
                }`}
                aria-label={
                  isListening ? "Stop voice dictation" : "Dictate inquiry using microphone"
                }
                title={isListening ? "Listening... click to stop" : "Click to speak inquiry"}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" />
                    <span>Listening...</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5 text-[#684B1E]" />
                    <span>Dictate</span>
                  </>
                )}
              </button>
            )}
            <button
              type="submit"
              disabled={!isExtractionComplete || isSubmitting || !inputQuery.trim()}
              className="inline-flex items-center gap-1.5 rounded bg-[#1B2430] px-4 py-2 font-mono text-xs font-medium text-[#F7F3EA] transition-colors hover:bg-[#111822] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Submit inquiry"
            >
              {!isExtractionComplete ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Locked</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Consult</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between px-1 font-mono text-[11px] text-[#525D6B]">
          <span>
            {!isExtractionComplete
              ? "Gated behind clause extraction to prevent false negative answers"
              : "Press Enter to consult · Shift+Enter for new line"}
          </span>
          <span>Strictly Grounded RAG</span>
        </div>
      </form>
    </div>
  );
}
