"use client";

import { useState } from "react";
import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { useQAConsultation } from "../hooks/use-qa-consultation";
import { TranscriptEntry } from "./transcript-entry";
import { useSpeechRecognition } from "@/features/accessibility";
import { Send, FileText, Sparkles, RefreshCw, AlertCircle, Mic, MicOff } from "lucide-react";

interface ConsultationTranscriptPanelProps {
  doc: ParsedDocument;
  clauses?: Clause[];
  onFlagForLawyer?: (questionText: string, rationale?: string) => void;
  onJumpToPage?: (page: number) => void;
}

export function ConsultationTranscriptPanel({
  doc,
  clauses,
  onFlagForLawyer,
  onJumpToPage,
}: ConsultationTranscriptPanelProps): JSX.Element {
  const [inputQuery, setInputQuery] = useState("");
  const { transcript, isSubmitting, error, askQuestion, toggleFlagForLawyer, clearTranscript } =
    useQAConsultation(doc, clauses, onFlagForLawyer);

  const {
    isListening,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition((transcriptText: string) => {
    setInputQuery((prev) => (prev ? `${prev} ${transcriptText}` : transcriptText));
  });

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputQuery.trim() || isSubmitting) return;

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

        {transcript.length > 0 && (
          <button
            type="button"
            onClick={clearTranscript}
            className="inline-flex items-center gap-1 self-start rounded border border-[#E0D7C6] px-2.5 py-1 font-mono text-xs text-[#525D6B] transition-colors hover:bg-[#EFE8DC] hover:text-[#1B2430] sm:self-center"
            aria-label="Clear transcript record"
          >
            <RefreshCw className="h-3 w-3" />
            Reset Transcript
          </button>
        )}
      </header>

      {/* Suggested Inquiries */}
      <div className="rounded-lg border border-[#E0D7C6]/70 bg-[#FDFBF7] p-4">
        <div className="mb-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-[#684B1E]">
          <Sparkles className="h-3.5 w-3.5 text-[#684B1E]" />
          <span>Recommended Inquiry Prompts</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestedQueries.map((queryText, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputQuery(queryText);
              }}
              className="rounded-full border border-[#E0D7C6] bg-white px-3 py-1.5 text-left text-xs text-[#1B2430] transition-all hover:border-[#B08D57] hover:bg-[#FBF9F4] focus:outline-none focus:ring-1 focus:ring-[#B08D57]"
            >
              &ldquo;{queryText}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* Transcript Log */}
      <div className="min-h-[300px] flex-1 space-y-4">
        {transcript.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E0D7C6] bg-[#FDFBF7]/70 p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#B08D57]/10 text-[#B08D57]">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="mb-1 font-serif text-base text-[#1B2430]">Consultation Desk Ready</h3>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-[#525D6B]">
              Inquiries submitted here are matched strictly against the four corners of{" "}
              <strong>{doc.filename}</strong>. Answers provide exact page and clause citations.
              Inquiries outside the contract are safely flagged for your lawyer consultation memo.
            </p>
          </div>
        ) : (
          transcript.map((item) => (
            <TranscriptEntry
              key={item.id}
              item={item}
              onToggleFlagLawyer={toggleFlagForLawyer}
              onJumpToPage={onJumpToPage}
            />
          ))
        )}

        {isSubmitting && (
          <div className="flex animate-pulse items-center gap-3 rounded-lg border border-[#E0D7C6] bg-[#FBF9F4] p-4 font-mono text-xs text-[#525D6B]">
            <RefreshCw className="h-4 w-4 animate-spin text-[#B08D57]" />
            <span>Consulting document index and verifying page citations...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-[#8C2F39]/30 bg-[#8C2F39]/5 p-4 text-xs text-[#8C2F39]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Query Input Console */}
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-4 space-y-2 rounded-lg border border-[#E0D7C6] bg-[#FBF9F4] p-4 shadow-md"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Submit an inquiry regarding the provisions in this document (e.g., 'What happens on termination?')..."
            rows={2}
            className="flex-1 resize-none rounded border border-[#E0D7C6] bg-[#FDFBF7] p-3 font-sans text-sm text-[#1B2430] placeholder:text-[#8A94A1] focus:outline-none focus:ring-2 focus:ring-[#684B1E]/40"
            disabled={isSubmitting}
            aria-label="Document inquiry input"
          />
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isSpeechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`inline-flex items-center gap-1.5 rounded border px-3 py-2 font-mono text-xs font-medium transition-colors ${
                  isListening
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
              disabled={isSubmitting || !inputQuery.trim()}
              className="inline-flex items-center gap-1.5 rounded bg-[#1B2430] px-4 py-2 font-mono text-xs font-medium text-[#F7F3EA] transition-colors hover:bg-[#111822] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Submit inquiry"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Consult</span>
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between px-1 font-mono text-[11px] text-[#525D6B]">
          <span>Press Enter to consult · Shift+Enter for new line</span>
          <span>Strictly Grounded RAG</span>
        </div>
      </form>
    </div>
  );
}
