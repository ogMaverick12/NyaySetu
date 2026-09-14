"use client";

import React from "react";
import { type Clause } from "../types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ShieldAlert, AlertTriangle, CheckCircle2, BookmarkCheck, Scale } from "lucide-react";

interface ClauseCardProps {
  clause: Clause;
  isFlaggedForLawyer: boolean;
  onToggleFlagForLawyer: () => void;
}

export function ClauseCard({
  clause,
  isFlaggedForLawyer,
  onToggleFlagForLawyer,
}: ClauseCardProps): JSX.Element {
  const isHighRisk = clause.riskLevel === "high-risk";
  const isCaution = clause.riskLevel === "caution";

  return (
    <Card
      riskLevel={clause.riskLevel}
      className="flex flex-col justify-between transition-shadow hover:shadow-md"
    >
      <CardHeader className="pb-3">
        {/* Monospace Reference Anchor & Risk Badge */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            § P.{clause.page} • {clause.type.replace(/_/g, " ")}
          </span>

          {isHighRisk ? (
            <Badge variant="high-risk">
              <ShieldAlert className="mr-1 h-3 w-3" />
              High Risk
            </Badge>
          ) : isCaution ? (
            <Badge variant="caution">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Caution
            </Badge>
          ) : (
            <Badge variant="info">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Standard
            </Badge>
          )}
        </div>

        {/* Plain Language Summary Headline */}
        <CardTitle className="mt-2 text-base font-semibold text-primary">
          {clause.plainSummary}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Legal Margin Note: Verbatim Source Excerpt */}
        <div className="rounded border border-border/70 bg-secondary/40 p-3 font-mono text-xs text-muted-foreground">
          <p className="line-clamp-4 italic">&ldquo;{clause.sourceText}&rdquo;</p>
        </div>

        {/* Analytical Rationale */}
        <div className="space-y-1 text-xs">
          <span className="font-mono uppercase tracking-wider text-[#B08D57]">Legal Context:</span>
          <p className="leading-relaxed text-muted-foreground">{clause.rationale}</p>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch justify-between gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center">
        <span className="font-mono text-xs text-muted-foreground">ID: {clause.id}</span>

        {/* F2 Acceptance Requirement: Every high-risk clause surfaces lawyer-escalation prompt */}
        {isHighRisk ? (
          <Button
            variant={isFlaggedForLawyer ? "default" : "destructive"}
            size="sm"
            onClick={onToggleFlagForLawyer}
            className="text-xs"
          >
            {isFlaggedForLawyer ? (
              <>
                <BookmarkCheck className="mr-1.5 h-3.5 w-3.5" />
                Added to Lawyer Memo
              </>
            ) : (
              <>
                <Scale className="mr-1.5 h-3.5 w-3.5" />
                Escalate to Lawyer Prep
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFlagForLawyer}
            className="text-xs text-muted-foreground hover:text-primary"
          >
            {isFlaggedForLawyer ? (
              <>
                <BookmarkCheck className="mr-1.5 h-3.5 w-3.5 text-[#B08D57]" />
                In Lawyer Memo
              </>
            ) : (
              <>+ Note for Lawyer</>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
