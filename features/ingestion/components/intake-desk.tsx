"use client";

import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { useDocumentIngestion } from "../hooks/use-document-ingestion";
import { type ParsedDocument } from "../types";
import { useAccessibility } from "@/features/accessibility";
import { FileText, Upload, CheckCircle2, AlertCircle, RefreshCw, Eye, Shield } from "lucide-react";

interface IntakeDeskProps {
  onDocumentParsed?: (doc: ParsedDocument) => void;
  onProceedToAnalysis?: () => void;
}

export function IntakeDesk({
  onDocumentParsed,
  onProceedToAnalysis,
}: IntakeDeskProps): JSX.Element {
  const { document, status, selectedFile, progress, selectFile, ingestFile, reset } =
    useDocumentIngestion();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const scanLineRef = useRef<HTMLDivElement>(null);
  const deskContainerRef = useRef<HTMLDivElement>(null);
  const scanTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const { prefersReducedMotion, isLowBandwidth } = useAccessibility();

  // GSAP Flagship Animation — strictly scoped to this intake moment, respecting reduced motion and low bandwidth
  useEffect(() => {
    // If reduced motion is requested or low-bandwidth mode is active, completely bypass animations
    if (prefersReducedMotion || isLowBandwidth) {
      if (paperRef.current) {
        gsap.set(paperRef.current, {
          y: 0,
          opacity: 1,
          rotation: 0,
          scale: 1,
        });
      }
      if (scanLineRef.current) {
        gsap.set(scanLineRef.current, { opacity: 0, display: "none" });
      }
      if (scanTimelineRef.current) {
        scanTimelineRef.current.kill();
        scanTimelineRef.current = null;
      }
      return;
    }

    const ctx = gsap.context(() => {
      // 1. Paper Settle Physics on file drop / selection
      if (status === "selected" || status === "uploading") {
        if (paperRef.current) {
          gsap.fromTo(
            paperRef.current,
            {
              y: -35,
              opacity: 0,
              rotation: -2.2,
              scale: 1.04,
            },
            {
              y: 0,
              opacity: 1,
              rotation: -0.4,
              scale: 1,
              duration: 0.55,
              ease: "power2.out",
            }
          );
        }
      }

      // 2. Scan-line sweeping effect during parsing
      if (status === "scanning") {
        if (scanLineRef.current) {
          gsap.set(scanLineRef.current, { opacity: 1, display: "block" });
          scanTimelineRef.current = gsap
            .timeline({ repeat: -1, yoyo: true })
            .fromTo(
              scanLineRef.current,
              { top: "4%", opacity: 0.95 },
              { top: "94%", opacity: 0.95, duration: 1.5, ease: "power1.inOut" }
            );
        }
      } else {
        // Kill scan-line loop when scanning finishes or idles
        if (scanTimelineRef.current) {
          scanTimelineRef.current.kill();
          scanTimelineRef.current = null;
        }
        if (scanLineRef.current) {
          gsap.to(scanLineRef.current, { opacity: 0, duration: 0.25 });
        }
      }

      // 3. Settled Confirmation when ready
      if (status === "ready" && paperRef.current) {
        gsap.to(paperRef.current, {
          rotation: 0,
          scale: 1,
          duration: 0.35,
          ease: "back.out(1.2)",
        });
      }
    }, deskContainerRef);

    return () => ctx.revert();
  }, [status, prefersReducedMotion, isLowBandwidth]);

  // Forward parsed document to parent callback
  useEffect(() => {
    if (status === "ready" && document && onDocumentParsed) {
      onDocumentParsed(document);
    }
  }, [status, document, onDocumentParsed]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      selectFile(droppedFile);
      void ingestFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const pickedFile = e.target.files[0];
      selectFile(pickedFile);
      void ingestFile(pickedFile);
    }
  };

  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      triggerFileDialog();
    }
  };

  return (
    <div ref={deskContainerRef} className="w-full space-y-6">
      {/* Desk Frame (Restrained Case Intake Desk Metaphor) */}
      <div
        className="relative overflow-hidden rounded-lg border-2 border-border/80 bg-parchment p-6 shadow-md sm:p-8"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Subtle Paper-grain Accent Border & Intake Desk Header */}
        <div className="mb-6 flex flex-col justify-between gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary font-serif text-sm font-bold text-primary-foreground shadow-sm">
              §
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold uppercase tracking-wider text-primary">
                Case Intake Desk
              </h2>
              <p className="font-mono text-xs text-muted-foreground">
                SESSION REF: NYAY-{new Date().getFullYear()}-EPHEMERAL
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="brass">
              <Shield className="mr-1 h-3 w-3" />
              Ephemeral &amp; Encrypted
            </Badge>
            {document && (
              <Badge variant="info">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {document.isOcr ? "Visual OCR Parsed" : "Native PDF Anchored"}
              </Badge>
            )}
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="sr-only"
          onChange={handleFileChange}
          aria-label="Upload document for legal analysis"
        />

        {/* Intake Surface / Document Drop Target */}
        {!selectedFile && status === "idle" ? (
          <div
            role="button"
            tabIndex={0}
            onClick={triggerFileDialog}
            onKeyDown={handleKeyDown}
            className="group relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-[#B08D57]/40 bg-card/60 p-8 text-center transition-all hover:border-[#B08D57] hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/80 text-primary shadow-sm transition-transform group-hover:scale-105">
              <Upload className="h-6 w-6 text-[#B08D57]" />
            </div>

            <h3 className="mt-4 font-serif text-lg font-semibold text-primary">
              Place contract or agreement onto intake desk
            </h3>

            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Drop a rental deed, gig agreement, or employment contract here. Accepts native{" "}
              <span className="font-mono font-medium text-primary">PDF</span>, or photographed{" "}
              <span className="font-mono font-medium text-primary">JPG / PNG</span> for OCR.
            </p>

            <div className="mt-5 flex items-center gap-3">
              <Button
                type="button"
                variant="brass"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerFileDialog();
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                Select File from Device
              </Button>
              <span className="font-mono text-xs text-muted-foreground">Max 10 MB</span>
            </div>
          </div>
        ) : (
          /* Document Paper Surface (The GSAP Settling Element) */
          <div
            ref={paperRef}
            className="relative mx-auto max-w-2xl rounded border border-border bg-[#FDFBF7] p-6 shadow-lg transition-colors sm:p-8"
          >
            {/* The GSAP Scan-Line Element */}
            <div
              ref={scanLineRef}
              className="pointer-events-none absolute left-0 right-0 z-20 hidden h-[3px] bg-gradient-to-r from-transparent via-[#B08D57] to-transparent shadow-[0_0_12px_#B08D57]"
              style={{ top: "0%" }}
            />

            {/* Document Header & State */}
            <div className="flex items-start justify-between border-b border-border/60 pb-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-secondary font-mono text-sm font-semibold text-primary">
                  {selectedFile?.name.endsWith(".pdf") ? "PDF" : "IMG"}
                </div>
                <div>
                  <h4 className="line-clamp-1 font-serif text-base font-semibold text-primary">
                    {selectedFile?.name}
                  </h4>
                  <p className="font-mono text-xs text-muted-foreground">
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ""} •{" "}
                    {document ? `${document.pageCount} page(s) mapped` : progress.statusMessage}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {status === "ready" ? (
                  <Button variant="outline" size="sm" onClick={reset}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    New Document
                  </Button>
                ) : status === "error" ? (
                  <Button variant="outline" size="sm" onClick={reset}>
                    Try Again
                  </Button>
                ) : (
                  <div className="flex items-center space-x-2 font-mono text-xs text-[#B08D57]">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ingestion Status Announcements */}
            <div className="mt-4 space-y-3" aria-live="polite">
              {status === "error" && (
                <div className="flex items-center space-x-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{progress.error || "An error occurred during intake."}</span>
                </div>
              )}

              {/* Progress feedback */}
              <div className="space-y-1">
                <div className="flex justify-between font-mono text-xs text-muted-foreground">
                  <span>{progress.statusMessage}</span>
                  <span>{progress.progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-[#B08D57] transition-all duration-300 ease-out"
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Parsed Result Preview */}
              {document && (
                <div className="mt-6 space-y-4 rounded border border-border/80 bg-parchment/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-sm font-semibold text-primary">
                      Page-Anchored Text Representation
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {document.pages.reduce((acc, p) => acc + p.wordCount, 0)} total words
                    </span>
                  </div>

                  <div className="max-h-56 space-y-3 overflow-y-auto pr-2 font-mono text-xs">
                    {document.pages.map((p) => (
                      <div
                        key={p.pageNumber}
                        className="shadow-2xs rounded border border-border/60 bg-card p-3"
                      >
                        <div className="mb-1 flex items-center justify-between font-semibold text-muted-foreground">
                          <span>PAGE {p.pageNumber}</span>
                          <span>{p.wordCount} words</span>
                        </div>
                        <p className="line-clamp-3 whitespace-pre-wrap font-sans text-xs text-muted-foreground">
                          {p.text}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button variant="brass" size="sm" onClick={() => onProceedToAnalysis?.()}>
                      <Eye className="mr-2 h-3.5 w-3.5" />
                      Proceed to Clause Risk Analysis
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
