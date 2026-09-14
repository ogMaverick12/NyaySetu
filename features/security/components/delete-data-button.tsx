"use client";

import React, { useState } from "react";
import { Trash2, AlertTriangle, ShieldCheck, X } from "lucide-react";
import { Button } from "@/ui/button";

interface DeleteDataButtonProps {
  onDataDeleted?: () => void;
  className?: string;
  variant?: "ghost" | "destructive" | "outline";
}

export function DeleteDataButton({
  onDataDeleted,
  className = "",
  variant = "ghost",
}: DeleteDataButtonProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      // 1. Call server-side purge endpoint
      await fetch("/api/session", {
        method: "DELETE",
      }).catch(() => {
        // Silently ignore network failures on client purge
      });

      // 2. Wipe client-side storage
      if (typeof window !== "undefined") {
        try {
          sessionStorage.clear();
          localStorage.removeItem("nyaysetu_active_doc");
          localStorage.removeItem("nyaysetu_active_clauses");
        } catch {
          // Ignore storage access errors
        }
      }

      // 3. Trigger callback to reset React state in parent app
      if (onDataDeleted) {
        onDataDeleted();
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsOpen(false);
      }, 2000);
    } finally {
      setIsDeleting(false);
    }
  };

  const variantStyles = {
    ghost: "text-[#8C2F39] hover:bg-[#8C2F39]/10 focus:ring-[#8C2F39]",
    destructive: "bg-[#8C2F39] text-white hover:bg-[#72262E] focus:ring-[#8C2F39]",
    outline: "border border-[#8C2F39]/40 text-[#8C2F39] hover:bg-[#8C2F39]/10 focus:ring-[#8C2F39]",
  }[variant];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 ${variantStyles} ${className}`}
        aria-label="Delete my case data permanently"
        title="Wipe active document, clauses, and consultation transcript"
      >
        <Trash2 className="h-3 w-3" aria-hidden="true" />
        <span>Delete My Data</span>
      </button>

      {/* Confirmation Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-data-title"
          aria-describedby="delete-data-desc"
          className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="relative w-full max-w-md rounded-lg border border-[#E0D7C6] bg-[#FDFBF7] p-6 shadow-xl animate-in fade-in zoom-in-95">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isDeleting}
              className="absolute right-3.5 top-3.5 rounded p-1 text-[#525D6B] hover:bg-[#EFE8DC] focus:outline-none focus:ring-1 focus:ring-[#684B1E]"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>

            {isSuccess ? (
              <div className="space-y-3 py-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#3F6C51]/10 text-[#3F6C51]">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-[#1B2430]">
                  Case Data Permanently Deleted
                </h3>
                <p className="text-xs text-[#525D6B]">
                  All documents, clauses, and transcripts have been completely wiped from your
                  browser and server memory.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8C2F39]/10 text-[#8C2F39]">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3
                      id="delete-data-title"
                      className="font-serif text-base font-semibold text-[#1B2430]"
                    >
                      Permanently Delete Case Data?
                    </h3>
                    <p
                      id="delete-data-desc"
                      className="mt-1 text-xs leading-relaxed text-[#525D6B]"
                    >
                      This will permanently wipe your uploaded contract, operative margin notes,
                      Q&amp;A consultation transcript, and comparison drafts from server memory and
                      your current browser session. This action cannot be reversed.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[#E0D7C6]/60 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      void handleDeleteConfirm();
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Erasing..." : "Yes, Permanently Delete"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
