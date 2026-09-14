"use client";

import React from "react";
import { type ComparisonDifference } from "../types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { ShieldAlert, CheckCircle2, HelpCircle, FileMinus, FilePlus } from "lucide-react";

interface RedlineCardProps {
  difference: ComparisonDifference;
}

export function RedlineCard({ difference }: RedlineCardProps): JSX.Element {
  const isFavorable = difference.impactOnUser === "favorable";
  const isDisadvantageous = difference.impactOnUser === "disadvantageous";

  const cardBorderClass = isDisadvantageous
    ? "border-l-4 border-l-[#8C2F39]"
    : isFavorable
      ? "border-l-4 border-l-[#3F6C51]"
      : "border-l-4 border-l-[#B08D57]";

  return (
    <Card className={`overflow-hidden transition-shadow hover:shadow-md ${cardBorderClass}`}>
      <CardHeader className="p-4 pb-2 sm:px-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            § {difference.clauseType.replace(/_/g, " ")}
          </span>

          {/* Accessible Impact Signal (Icon + Label, NOT color alone) */}
          {isDisadvantageous ? (
            <Badge variant="high-risk">
              <ShieldAlert className="mr-1 h-3 w-3" />
              Disadvantages You
              <span className="sr-only"> — This contract change disadvantages the citizen</span>
            </Badge>
          ) : isFavorable ? (
            <Badge variant="info">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Favors You
              <span className="sr-only"> — This contract change favors the citizen</span>
            </Badge>
          ) : (
            <Badge variant="secondary">
              <HelpCircle className="mr-1 h-3 w-3" />
              Neutral / Customary
              <span className="sr-only"> — This contract change is neutral</span>
            </Badge>
          )}
        </div>

        <CardTitle className="mt-1.5 text-base font-semibold text-primary">
          {difference.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-1 sm:px-6">
        {/* Tracked Changes Redline Metaphor (Semantic <del> and <ins>) */}
        <div className="space-y-2 rounded border border-border/80 bg-parchment/40 p-3 font-mono text-xs">
          {/* Base / Original version marked as deleted/replaced */}
          <div className="space-y-1">
            <div className="flex items-center font-sans text-[10px] font-semibold uppercase text-muted-foreground">
              <FileMinus className="mr-1 h-3 w-3 text-[#8C2F39]" aria-hidden="true" />
              Baseline Standard / Original:
            </div>
            <del
              role="deletion"
              aria-label="Original baseline provision replaced"
              className="block rounded bg-[#F7ECEE] p-2 leading-relaxed text-[#8C2F39] line-through decoration-[#8C2F39]/60"
            >
              <span className="sr-only">Original text removed or replaced: </span>
              {difference.baseText}
            </del>
          </div>

          {/* Target / Uploaded version marked as inserted revision */}
          <div className="space-y-1">
            <div className="flex items-center font-sans text-[10px] font-semibold uppercase text-muted-foreground">
              <FilePlus className="mr-1 h-3 w-3 text-[#3F6C51]" aria-hidden="true" />
              Your Document Revision:
            </div>
            <ins
              role="insertion"
              aria-label="Revised provision in your document"
              className="block rounded border-l-2 border-[#3F6C51] bg-[#EAF2EC] p-2 leading-relaxed text-[#3F6C51] no-underline"
            >
              <span className="sr-only">New revised text inserted: </span>
              {difference.targetText}
            </ins>
          </div>
        </div>

        {/* Plain-Language User Impact Assessment */}
        <div className="rounded bg-secondary/50 p-3 text-xs">
          <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-[#684B1E]">
            Why this matters for your rights:
          </span>
          <p className="leading-relaxed text-foreground">{difference.explanation}</p>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border/50 bg-parchment/20 p-2.5 px-4 sm:px-6">
        <span className="font-mono text-[10px] text-muted-foreground">Ref: {difference.id}</span>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">
          Severity: {difference.severity}
        </span>
      </CardFooter>
    </Card>
  );
}
