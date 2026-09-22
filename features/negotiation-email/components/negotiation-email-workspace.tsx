"use client";

import React, { useState, useId } from "react";
import { useReducedMotion } from "framer-motion";
import { type NegotiationEmailWorkspaceProps } from "../types";
import { useNegotiationEmailDraft } from "../hooks/use-negotiation-email-draft";
import { useSpeechSynthesis } from "@/features/accessibility";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import {
  Mail,
  Copy,
  Check,
  RefreshCw,
  Volume2,
  VolumeX,
  ExternalLink,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export function NegotiationEmailWorkspace({
  documentFilename,
  documentType = "tenancy",
  clauses,
  comparisonDifferences = [],
  onClose,
  className = "",
}: NegotiationEmailWorkspaceProps): JSX.Element {
  const subjectId = useId();
  const bodyId = useId();
  const prefersReducedMotion = useReducedMotion();

  const [copied, setCopied] = useState(false);

  const {
    subject,
    body,
    citedClauseIds,
    status,
    isGenerating,
    error,
    streamingBody,
    generateDraft,
    updateSubject,
    updateBody,
  } = useNegotiationEmailDraft({
    documentFilename,
    documentType,
    clauses,
    comparisonDifferences,
    autoGenerate: true,
  });

  const { speak, cancel, isSpeaking, isSupported: isSpeechSupported } = useSpeechSynthesis();

  const handleCopy = async () => {
    if (!body) return;
    const fullContent = `Subject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(fullContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleVoice = () => {
    if (isSpeaking) {
      cancel();
      return;
    }

    if (!body) return;
    const narration = `Subject: ${subject}. Message body: ${body}`;
    speak(narration);
  };

  // Safe client-side mailto trigger — strictly requires explicit user click
  const mailtoUri = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div
      role="region"
      aria-label="Negotiation Email Drafting Workspace"
      className={`rounded-lg border border-[#E0D7C6] bg-[#FDFBF7] p-5 shadow-sm sm:p-6 ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-col gap-3 border-b border-[#E0D7C6]/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-[#D8C6A5] bg-[#FAF3E8] p-2 text-[#684B1E]">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg font-semibold tracking-tight text-[#1B2430]">
                Draft a Negotiation Email
              </h3>
              <Badge variant="brass" className="text-[10px] uppercase tracking-wider">
                Export Action
              </Badge>
            </div>
            <p className="text-xs text-[#525D6B]">
              Polite, non-accusatory amendment request targeting high-risk and caution provisions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSpeechSupported && (status === "success" || body) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleVoice}
              aria-label={isSpeaking ? "Stop reading draft email aloud" : "Read draft email aloud"}
              className="flex items-center gap-1.5 border-[#E0D7C6] bg-white text-xs text-[#1B2430] hover:bg-[#F7F3EA]"
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="h-3.5 w-3.5 animate-pulse text-[#8C2F39]" />
                  <span>Stop Audio</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-[#684B1E]" />
                  <span>Read Draft</span>
                </>
              )}
            </Button>
          )}

          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close negotiation email draft"
              className="h-8 w-8 p-0 text-[#525D6B] hover:text-[#1B2430]"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Safety & User Control Advisory */}
      <div className="mt-4 flex items-center gap-2 rounded-md border border-[#D8C6A5]/60 bg-[#FAF3E8] p-2.5 text-xs text-[#684B1E]">
        <Info className="h-4 w-4 shrink-0 text-[#B08D57]" aria-hidden="true" />
        <p>
          <strong>Fully Editable &amp; Private:</strong> NyaySetu never sends emails autonomously.
          You can edit any line directly below before copying or opening in your mail app.
        </p>
      </div>

      {/* Error state */}
      {status === "error" && error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-[#D699A0] bg-[#F7ECEE] p-3 text-xs text-[#8C2F39]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Failed to generate email draft</p>
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void generateDraft({ forceRegenerate: true })}
              className="mt-2 border-[#D699A0] bg-white text-xs text-[#8C2F39] hover:bg-[#F7ECEE]"
            >
              <RefreshCw className="mr-1.5 h-3 w-3" />
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Generating / Streaming State */}
      {isGenerating && (
        <div className="mt-6 space-y-3 rounded-lg border border-[#E0D7C6] bg-white/70 p-6 text-center">
          <RefreshCw
            className={`mx-auto h-6 w-6 text-[#B08D57] ${
              prefersReducedMotion ? "" : "animate-spin"
            }`}
            aria-hidden="true"
          />
          <div className="space-y-1">
            <h4 className="font-serif text-sm font-semibold text-[#1B2430]">
              {status === "streaming"
                ? "Synthesizing Negotiation Clauses..."
                : "Analyzing Risk Hierarchy & Drafting Request..."}
            </h4>
            <p className="text-xs text-[#525D6B]">
              Formulating a collaborative, non-accusatory amendment proposal using document-specific
              vocabulary.
            </p>
          </div>

          {status === "streaming" && streamingBody && (
            <div className="mt-4 max-h-36 overflow-y-auto rounded border border-[#E0D7C6] bg-[#F7F3EA]/60 p-3 text-left font-mono text-xs text-[#525D6B]">
              <pre className="whitespace-pre-wrap font-sans">{streamingBody}</pre>
            </div>
          )}
        </div>
      )}

      {/* Editable Form Area */}
      {!isGenerating && (status === "success" || body) && (
        <div className="mt-5 space-y-4">
          {/* Subject Field */}
          <div className="space-y-1.5">
            <label
              htmlFor={subjectId}
              className="block font-mono text-xs font-semibold uppercase tracking-wider text-[#684B1E]"
            >
              Email Subject
            </label>
            <input
              id={subjectId}
              type="text"
              value={subject}
              onChange={(e) => updateSubject(e.target.value)}
              placeholder="e.g. Clarification and proposed adjustments for lease agreement"
              className="w-full rounded-md border border-[#E0D7C6] bg-white px-3 py-2 text-xs font-medium text-[#1B2430] placeholder:text-[#525D6B]/60 focus:border-[#B08D57] focus:outline-none focus:ring-1 focus:ring-[#B08D57]"
            />
          </div>

          {/* Body Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor={bodyId}
                className="block font-mono text-xs font-semibold uppercase tracking-wider text-[#684B1E]"
              >
                Message Body (Keyboard-Editable)
              </label>
              <span className="text-[11px] text-[#525D6B]">
                {body.length} character{body.length === 1 ? "" : "s"}
              </span>
            </div>
            <textarea
              id={bodyId}
              rows={12}
              value={body}
              onChange={(e) => updateBody(e.target.value)}
              aria-label="Editable negotiation email message body"
              className="w-full rounded-md border border-[#E0D7C6] bg-white p-3 font-sans text-xs leading-relaxed text-[#1B2430] placeholder:text-[#525D6B]/60 focus:border-[#B08D57] focus:outline-none focus:ring-1 focus:ring-[#B08D57]"
            />
          </div>

          {/* Cited clauses tags */}
          {citedClauseIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="font-mono text-[11px] text-[#525D6B]">Clauses Addressed:</span>
              {citedClauseIds.map((id) => (
                <span
                  key={id}
                  className="rounded border border-[#E0D7C6] bg-[#FAF3E8] px-2 py-0.5 font-mono text-[10px] text-[#684B1E]"
                >
                  § {id}
                </span>
              ))}
            </div>
          )}

          {/* Bottom Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E0D7C6]/80 pt-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isGenerating}
                onClick={() => void generateDraft({ forceRegenerate: true })}
                className="flex items-center gap-1.5 border-[#E0D7C6] bg-white text-xs text-[#1B2430] hover:bg-[#F7F3EA] disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#684B1E]" />
                <span>Regenerate Draft</span>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleCopy();
                }}
                className="flex items-center gap-1.5 border-[#E0D7C6] bg-white text-xs text-[#1B2430] hover:bg-[#F7F3EA]"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#3F6C51]" />
                    <span className="font-semibold text-[#3F6C51]">Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-[#525D6B]" />
                    <span>Copy Email Text</span>
                  </>
                )}
              </Button>

              <a
                href={mailtoUri}
                target="_blank"
                rel="noopener noreferrer"
                className="shadow-xs inline-flex items-center gap-1.5 rounded-md bg-[#B08D57] px-3.5 py-2 font-mono text-xs font-semibold text-[#FAF8F3] transition-colors hover:bg-[#9C7945] focus:outline-none focus:ring-2 focus:ring-[#B08D57] focus:ring-offset-2"
                aria-label="Open draft in default mail client"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in Mail Client</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
