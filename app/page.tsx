"use client";

import { LazyMotion, m } from "framer-motion";

// domAnimations (~90 KB) loads in a separate async chunk, absent from initial bundle.
// Before features arrive, m.* components render with animate values applied immediately
// so the hero header text is never invisible during first paint (no LCP delay).
const loadFramerFeatures = () => import("./framer-features").then((res) => res.default);
import { Button } from "@/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { fadeIn, slideUp, clauseContainer, clauseCardReveal } from "@/motion-variants";
import { ShieldAlert, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { NyaySetuLogo } from "@/components/nyaysetu-logo";

import dynamic from "next/dynamic";
// Direct deep imports only — feature barrel index files re-export server-only
// and below-fold modules (zod schemas, memo screen, workspace components) that
// would otherwise ride into the initial first-paint bundle. Every binding below
// resolves to the smallest module that provides it.
import { IntakeDesk } from "@/features/ingestion/components/intake-desk";
import { type ParsedDocument } from "@/features/ingestion/types";
import { useClauseExtraction } from "@/features/extraction/hooks/use-clause-extraction";
// ClausePanel + FairnessScoreCard render only after extraction succeeds, so
// they stream in on demand like the tab views — the intake first paint keeps
// hero + desk + static demo cards only.
const ClausePanel = dynamic(
  () => import("@/features/extraction/components/clause-panel").then((mod) => mod.ClausePanel),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Loading clause analysis…
      </div>
    ),
  }
);
const FairnessScoreCard = dynamic(
  () =>
    import("@/features/fairness-score/components/fairness-score-card").then(
      (mod) => mod.FairnessScoreCard
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Loading fairness score…
      </div>
    ),
  }
);
// Below-fold workflow views are code-split so they never enter the initial
// first-paint bundle (hero + intake desk only). Each loads on tab activation.
// jspdf (via ChecklistMemoScreen) and compare/QA stacks therefore stay out of
// vendor.js / page.js until actually needed.
const DocumentAnalysisScreen = dynamic(
  () => import("@/features/document-analysis").then((mod) => mod.DocumentAnalysisScreen),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Loading split-view analysis…
      </div>
    ),
  }
);
const CompareScreen = dynamic(() => import("@/features/compare").then((mod) => mod.CompareScreen), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
      Loading compare mode…
    </div>
  ),
});
const ConsultationTranscriptPanel = dynamic(
  () => import("@/features/qa-chat").then((mod) => mod.ConsultationTranscriptPanel),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Loading consultation…
      </div>
    ),
  }
);
const ChecklistMemoScreen = dynamic(
  () => import("@/features/checklist-export").then((mod) => mod.ChecklistMemoScreen),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Loading legal memo…
      </div>
    ),
  }
);
import { lawyerChecklistStore } from "@/features/checklist-export/store/lawyer-checklist-store";
import { fairnessStore } from "@/features/fairness-score/store/fairness-store";
import { negotiationEmailStore } from "@/features/negotiation-email/store/negotiation-email-store";
import {
  AccessibilityProvider,
  AccessibilityBar,
  useAccessibility,
} from "@/features/accessibility";
import { DeleteDataButton } from "@/features/security";
import { useState } from "react";
import {
  Scale,
  RefreshCw,
  GitCompare,
  Columns,
  LayoutDashboard,
  MessageSquareText,
  FileCheck,
} from "lucide-react";

export type ActiveAppView = "intake" | "analysis" | "compare" | "qa" | "export";

export default function HomePage(): JSX.Element {
  return (
    <AccessibilityProvider>
      <NyaySetuApp />
    </AccessibilityProvider>
  );
}

function NyaySetuApp(): JSX.Element {
  const { t, isLowBandwidth } = useAccessibility();
  const [activeView, setActiveView] = useState<ActiveAppView>("intake");
  const [activeDoc, setActiveDoc] = useState<ParsedDocument | null>(null);
  // Bumping this key forces IntakeDesk to remount and clear its internal state
  const [intakeDeskKey, setIntakeDeskKey] = useState(0);
  // QA questions explicitly flagged for lawyer — stores the question TEXT, not an ID
  const [flaggedQAQuestions, setFlaggedQAQuestions] = useState<string[]>([]);

  const {
    clauses,
    state: extractionState,
    metadata,
    activeFilter,
    setActiveFilter,
    flaggedForLawyer,
    toggleFlagForLawyer,
    extractClauses,
    reset: resetClauses,
  } = useClauseExtraction();

  const handleDocumentParsed = (doc: ParsedDocument) => {
    setActiveDoc(doc);
  };

  const handleTriggerExtraction = () => {
    if (activeDoc) {
      void extractClauses(activeDoc);
    }
  };

  // Called by the "Proceed to Clause Risk Analysis" button inside IntakeDesk
  const handleProceedToAnalysis = () => {
    if (activeDoc) {
      void extractClauses(activeDoc);
      setActiveView("analysis");
    }
  };

  // Stores the actual question text (not an ID) into the lawyer-prep list
  const handleFlagQAForLawyer = (questionText: string, isFlagged?: boolean) => {
    const clean = questionText.replace(/^Question:\s*/i, "").trim();
    if (!clean) return;

    if (isFlagged === false) {
      setFlaggedQAQuestions((prev) => prev.filter((q) => q !== clean));
      lawyerChecklistStore.removeQuestion(clean);
    } else {
      setFlaggedQAQuestions((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
      lawyerChecklistStore.addQuestion(clean);
    }
  };

  const handleDataDeleted = () => {
    setActiveDoc(null);
    resetClauses();
    setActiveView("intake");
    setFlaggedQAQuestions([]);
    lawyerChecklistStore.clear();
    fairnessStore.clear();
    negotiationEmailStore.clear();
    // Force IntakeDesk remount to clear its internal document/status state
    setIntakeDeskKey((k) => k + 1);
  };

  return (
    <LazyMotion features={loadFramerFeatures} strict>
      <div className={`min-h-screen bg-background ${isLowBandwidth ? "low-bandwidth-active" : ""}`}>
        {/* Skip-to-content accessibility bar, language controls, & data purge */}
        <AccessibilityBar onDataDeleted={handleDataDeleted} />

        <main id="main-content" className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-8">
            {/* Header Banner */}
            <m.header
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-4 border-b border-border pb-6 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <span className="font-mono text-xs uppercase tracking-widest text-[#684B1E]">
                    {t.appSubtitle}
                  </span>
                  <span className="text-border">•</span>
                  <Badge variant="brass">Gemini Antigravity</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <NyaySetuLogo size={56} className="flex-shrink-0" />
                  <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
                    {t.appName}
                  </h1>
                </div>
                <p className="max-w-2xl text-base text-muted-foreground">{t.appDescription}</p>
              </div>

              {/* Mode Switcher Tabs */}
              <div
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/70 p-1 sm:justify-end"
                role="tablist"
                aria-label="Workflow views"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeView === "intake"}
                  onClick={() => setActiveView("intake")}
                  className={`flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeView === "intake"
                      ? "shadow-xs bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutDashboard className="mr-1.5 h-3.5 w-3.5 text-[#684B1E]" />
                  {t.nav.intake}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeView === "analysis"}
                  onClick={() => setActiveView("analysis")}
                  className={`flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeView === "analysis"
                      ? "shadow-xs bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Columns className="mr-1.5 h-3.5 w-3.5 text-[#684B1E]" />
                  {t.nav.analysis}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeView === "compare"}
                  onClick={() => setActiveView("compare")}
                  className={`flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeView === "compare"
                      ? "shadow-xs bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <GitCompare className="mr-1.5 h-3.5 w-3.5 text-[#684B1E]" />
                  {t.nav.compare}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeView === "qa"}
                  onClick={() => setActiveView("qa")}
                  className={`flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeView === "qa"
                      ? "shadow-xs bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageSquareText className="mr-1.5 h-3.5 w-3.5 text-[#684B1E]" />
                  {t.nav.qa}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeView === "export"}
                  onClick={() => setActiveView("export")}
                  className={`flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeView === "export"
                      ? "shadow-xs bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileCheck className="mr-1.5 h-3.5 w-3.5 text-[#684B1E]" />
                  {t.nav.export}
                </button>
              </div>
            </m.header>

            {/* View 1: Intake & Extraction Overview */}
            {activeView === "intake" && (
              <div className="space-y-8">
                {/* Feature F1: Case Intake Desk (Flagship GSAP Moment) */}
                <m.section
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  <IntakeDesk
                    key={intakeDeskKey}
                    onDocumentParsed={handleDocumentParsed}
                    onProceedToAnalysis={handleProceedToAnalysis}
                  />

                  {activeDoc && (
                    <div className="flex flex-col items-start justify-between gap-3 rounded border border-[#684B1E]/40 bg-card p-4 shadow-sm sm:flex-row sm:items-center">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs uppercase tracking-wider text-[#684B1E]">
                          Case File Active
                        </span>
                        <h3 className="font-serif text-base font-semibold text-primary">
                          {activeDoc.filename}
                        </h3>
                        <p className="font-mono text-xs text-muted-foreground">
                          {activeDoc.pageCount} page(s) mapped •{" "}
                          {activeDoc.pages.reduce((acc, p) => acc + p.wordCount, 0)} words •{" "}
                          {activeDoc.isOcr ? "Visual OCR extracted" : "Native PDF text extracted"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {extractionState.status === "extracting" ? (
                          <Button variant="outline" size="sm" disabled>
                            <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin text-[#684B1E]" />
                            Analyzing Operative Clauses...
                          </Button>
                        ) : clauses.length > 0 ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveView("analysis")}
                            >
                              <Columns className="mr-2 h-3.5 w-3.5" />
                              Open Split View (F3)
                            </Button>
                            <Button
                              variant="brass"
                              size="sm"
                              onClick={() => setActiveView("compare")}
                            >
                              <GitCompare className="mr-2 h-3.5 w-3.5" />
                              Compare Mode (F4)
                            </Button>
                          </>
                        ) : (
                          <Button variant="brass" size="sm" onClick={handleTriggerExtraction}>
                            <Scale className="mr-2 h-4 w-4" />
                            Extract Clauses &amp; Assess Risks
                          </Button>
                        )}

                        <span className="hidden text-border sm:inline">|</span>
                        <DeleteDataButton onDataDeleted={handleDataDeleted} />
                      </div>
                    </div>
                  )}

                  {extractionState.error && (
                    <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                      {extractionState.error}
                    </div>
                  )}
                </m.section>

                {/* Feature F2: Live Extracted Clauses OR Baseline Demo Cards */}
                {clauses.length > 0 ? (
                  <m.section
                    variants={slideUp}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                  >
                    {/* Fairness Score Assessment */}
                    <FairnessScoreCard
                      clauses={clauses}
                      extractionStatus={extractionState.status}
                      onProceedToCompare={() => setActiveView("compare")}
                    />

                    <ClausePanel
                      clauses={clauses}
                      metadata={metadata}
                      activeFilter={activeFilter}
                      onFilterChange={setActiveFilter}
                      flaggedForLawyer={flaggedForLawyer}
                      onToggleFlag={toggleFlagForLawyer}
                      onProceedToCompare={() => setActiveView("compare")}
                    />
                  </m.section>
                ) : (
                  /* Brand System Demo & Margin Note Previews */
                  <m.section
                    variants={slideUp}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                  >
                    <div className="space-y-1">
                      <h2 className="text-2xl font-semibold">Margin-Note Risk Tagging</h2>
                      <p className="text-sm text-muted-foreground">
                        Lawyer-style document annotations with restrained semantic indicators.
                      </p>
                    </div>

                    <m.div
                      variants={clauseContainer}
                      initial="hidden"
                      animate="visible"
                      className="grid grid-cols-1 gap-6 md:grid-cols-3"
                    >
                      {/* Low Risk Card */}
                      <m.div variants={clauseCardReveal}>
                        <Card riskLevel="info" className="flex h-full flex-col justify-between">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs text-muted-foreground">
                                § 4.1 DEPOSIT
                              </span>
                              <Badge variant="info">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Low Risk
                              </Badge>
                            </div>
                            <CardTitle className="mt-2 text-base">
                              Security Deposit Refund
                            </CardTitle>
                            <CardDescription>
                              Standard 30-day refundable deposit cycle adhering to model tenancy
                              acts.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="mx-6 rounded bg-secondary/30 p-3 font-mono text-xs text-muted-foreground">
                            &ldquo;The security deposit shall be refunded in full within 30 days of
                            vacating...&rdquo;
                          </CardContent>
                          <CardFooter className="pt-4">
                            <span className="text-xs text-muted-foreground">
                              Source: Page 2, Paragraph 3
                            </span>
                          </CardFooter>
                        </Card>
                      </m.div>

                      {/* Caution Card */}
                      <m.div variants={clauseCardReveal}>
                        <Card riskLevel="caution" className="flex h-full flex-col justify-between">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs text-muted-foreground">
                                § 8.3 NOTICE
                              </span>
                              <Badge variant="caution">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                Requires Review
                              </Badge>
                            </div>
                            <CardTitle className="mt-2 text-base">
                              Notice Period Disparity
                            </CardTitle>
                            <CardDescription>
                              Requires 60 days notice from tenant but only 15 days from the
                              landlord.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="mx-6 rounded bg-secondary/30 p-3 font-mono text-xs text-muted-foreground">
                            &ldquo;Lessor may terminate with 15 days notice; Lessee must provide 60
                            days...&rdquo;
                          </CardContent>
                          <CardFooter className="pt-4">
                            <span className="text-xs text-muted-foreground">
                              Source: Page 4, Paragraph 1
                            </span>
                          </CardFooter>
                        </Card>
                      </m.div>

                      {/* High Risk Card */}
                      <m.div variants={clauseCardReveal}>
                        <Card
                          riskLevel="high-risk"
                          className="flex h-full flex-col justify-between"
                        >
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs text-muted-foreground">
                                § 14.2 INDEMNITY
                              </span>
                              <Badge variant="high-risk">
                                <ShieldAlert className="mr-1 h-3 w-3" />
                                Legal Risk
                              </Badge>
                            </div>
                            <CardTitle className="mt-2 text-base">
                              Uncapped Partner Liability
                            </CardTitle>
                            <CardDescription>
                              Worker holds platform harmless for third-party claims without
                              reciprocal obligation.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="mx-6 rounded bg-secondary/30 p-3 font-mono text-xs text-muted-foreground">
                            &ldquo;Partner shall indemnify and hold harmless Company from any
                            third-party claim...&rdquo;
                          </CardContent>
                          <CardFooter className="flex items-center justify-between pt-4">
                            <span className="text-xs text-muted-foreground">
                              Source: Page 7, Paragraph 5
                            </span>
                            <Button variant="destructive" size="sm">
                              Flag for Lawyer
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          </CardFooter>
                        </Card>
                      </m.div>
                    </m.div>
                  </m.section>
                )}
              </div>
            )}

            {/* View 2: Split-View Document Analysis (Feature F3) */}
            {activeView === "analysis" && (
              <div>
                {activeDoc ? (
                  <DocumentAnalysisScreen
                    document={activeDoc}
                    clauses={clauses}
                    extractionStatus={extractionState.status}
                    flaggedForLawyer={flaggedForLawyer}
                    onToggleFlag={toggleFlagForLawyer}
                    onProceedToCompare={() => setActiveView("compare")}
                  />
                ) : (
                  <div className="space-y-4 rounded-lg border border-dashed border-border bg-card p-12 text-center">
                    <Columns className="mx-auto h-10 w-10 text-[#684B1E]" />
                    <h3 className="font-serif text-lg font-semibold text-primary">
                      No Document Loaded on Intake Desk
                    </h3>
                    <p className="mx-auto max-w-md text-sm text-muted-foreground">
                      Please upload a rental deed, gig agreement, or contract onto the Case Intake
                      Desk to explore the split-view document reader and margin annotations.
                    </p>
                    <Button variant="brass" onClick={() => setActiveView("intake")}>
                      Go to Intake Desk
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* View 3: Contract Compare Mode with Tracked Changes Redline (Feature F4) */}
            {activeView === "compare" && (
              <div>
                {activeDoc ? (
                  <CompareScreen
                    primaryDocument={activeDoc}
                    clauses={clauses}
                    extractionStatus={extractionState.status}
                    onRunExtraction={handleTriggerExtraction}
                    onBackToAnalysis={() => setActiveView("analysis")}
                  />
                ) : (
                  <div className="space-y-4 rounded-lg border border-dashed border-border bg-card p-12 text-center">
                    <GitCompare className="mx-auto h-10 w-10 text-[#684B1E]" />
                    <h3 className="font-serif text-lg font-semibold text-primary">
                      Upload a Contract to Compare
                    </h3>
                    <p className="mx-auto max-w-md text-sm text-muted-foreground">
                      To evaluate clauses against statutory fair-practice baselines (Model Tenancy,
                      Fairwork, Labor Norms) or another contract, please place a document on the
                      intake desk first.
                    </p>
                    <Button variant="brass" onClick={() => setActiveView("intake")}>
                      Go to Intake Desk
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* View 4: Grounded Document Consultation Q&A (Feature F5) */}
            {activeView === "qa" && (
              <div>
                {activeDoc ? (
                  <ConsultationTranscriptPanel
                    doc={activeDoc}
                    clauses={clauses}
                    extractionStatus={extractionState.status}
                    onRunExtraction={handleTriggerExtraction}
                    onFlagForLawyer={(questionText, _rationale, isFlagged) => {
                      handleFlagQAForLawyer(questionText, isFlagged);
                    }}
                  />
                ) : (
                  <div className="space-y-4 rounded-lg border border-dashed border-border bg-card p-12 text-center">
                    <MessageSquareText className="mx-auto h-10 w-10 text-[#684B1E]" />
                    <h3 className="font-serif text-lg font-semibold text-primary">
                      No Document Loaded for Consultation
                    </h3>
                    <p className="mx-auto max-w-md text-sm text-muted-foreground">
                      NyaySetu Q&amp;A operates on a strictly grounded document scope. Please upload
                      a rental deed, platform agreement, or contract onto the Case Intake Desk to
                      begin an inquiry with citation anchors.
                    </p>
                    <Button variant="brass" onClick={() => setActiveView("intake")}>
                      Go to Intake Desk
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* View 5: Action Checklist & Lawyer Memo Export (Feature F6) */}
            {activeView === "export" && (
              <div>
                {activeDoc ? (
                  <ChecklistMemoScreen
                    doc={activeDoc}
                    clauses={clauses}
                    extractionStatus={extractionState.status}
                    onRunExtraction={handleTriggerExtraction}
                    bookmarkedQuestions={[...flaggedQAQuestions, ...Array.from(flaggedForLawyer)]}
                  />
                ) : (
                  <div className="space-y-4 rounded-lg border border-dashed border-border bg-card p-12 text-center">
                    <FileCheck className="mx-auto h-10 w-10 text-[#684B1E]" />
                    <h3 className="font-serif text-lg font-semibold text-primary">
                      No Document Loaded for Legal Memo Export
                    </h3>
                    <p className="mx-auto max-w-md text-sm text-muted-foreground">
                      NyaySetu compiles executive action items and questions for your lawyer
                      automatically from high-risk clauses. Please place a document on the intake
                      desk first.
                    </p>
                    <Button variant="brass" onClick={() => setActiveView("intake")}>
                      Go to Intake Desk
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        <footer className="border-t border-border px-4 py-5 sm:px-6 lg:px-8">
          <p className="mx-auto max-w-6xl text-center text-xs leading-relaxed text-muted-foreground">
            NyaySetu provides legal information and lawyer-prep assistance grounded in your document
            — it does not replace professional legal advice or create an attorney-client
            relationship. For binding decisions, consult a qualified advocate or legal-aid clinic.
          </p>
        </footer>
      </div>
    </LazyMotion>
  );
}
