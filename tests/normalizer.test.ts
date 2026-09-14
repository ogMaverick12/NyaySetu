import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  cleanRawText,
  countWords,
  normalizeDocument,
} from "@/features/ingestion/services/normalizer";

describe("Document Ingestion Normalizer", () => {
  const nativeFixturePath = path.resolve(__dirname, "./fixtures/sample-native-contract.txt");
  const ocrFixturePath = path.resolve(__dirname, "./fixtures/sample-scanned-ocr.txt");

  const nativeContent = fs.readFileSync(nativeFixturePath, "utf-8");
  const ocrContent = fs.readFileSync(ocrFixturePath, "utf-8");

  describe("cleanRawText", () => {
    it("should heal broken words split across line breaks by OCR hyphens", () => {
      const raw = "termi-\nnation of this agree-\nment and lia-\nbility";
      const cleaned = cleanRawText(raw);
      expect(cleaned).toBe("termination of this agreement and liability");
    });

    it("should normalize multiple consecutive newlines and horizontal spaces", () => {
      const raw = "Paragraph one.   \t\n\n\n\n   Paragraph two with    spaces.";
      const cleaned = cleanRawText(raw);
      expect(cleaned).toBe("Paragraph one.\n\nParagraph two with spaces.");
    });

    it("should strip non-printable control characters", () => {
      const raw = "Legal\u0000 Clause\u0007 Header";
      const cleaned = cleanRawText(raw);
      expect(cleaned).toBe("Legal Clause Header");
    });
  });

  describe("countWords", () => {
    it("should count words accurately across whitespace variations", () => {
      expect(countWords("")).toBe(0);
      expect(countWords("   ")).toBe(0);
      expect(countWords("Three words here")).toBe(3);
      expect(countWords("  Five   words   spaced   unevenly   here. ")).toBe(5);
    });
  });

  describe("normalizeDocument with Native PDF Fixture", () => {
    it("should parse native multi-page contract into page-anchored ParsedDocument", () => {
      // Split fixture on page markers
      const rawPageTexts = nativeContent
        .split(/--- PAGE \d+ ---/g)
        .filter((t) => t.trim().length > 0);

      const parsed = normalizeDocument({
        filename: "residential-lease-2026.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 24500,
        rawPages: rawPageTexts.map((text, idx) => ({
          pageNumber: idx + 1,
          text,
        })),
        isOcr: false,
      });

      expect(parsed.filename).toBe("residential-lease-2026.pdf");
      expect(parsed.mimeType).toBe("application/pdf");
      expect(parsed.isOcr).toBe(false);
      expect(parsed.pageCount).toBe(2);
      expect(parsed.pages.length).toBe(2);

      // Verify Page 1
      expect(parsed.pages[0].pageNumber).toBe(1);
      expect(parsed.pages[0].text).toContain("RESIDENTIAL LEASE AND TENANCY AGREEMENT");
      expect(parsed.pages[0].text).toContain("Arvind Sharma");
      expect(parsed.pages[0].wordCount).toBeGreaterThan(50);
      expect(parsed.pages[0].charCount).toBe(parsed.pages[0].text.length);

      // Verify Page 2
      expect(parsed.pages[1].pageNumber).toBe(2);
      expect(parsed.pages[1].text).toContain("SECURITY DEPOSIT");
      expect(parsed.pages[1].text).toContain("INR 96,000");

      // Verify full text contains page anchors
      expect(parsed.fullText).toContain("--- [Page 1] ---");
      expect(parsed.fullText).toContain("--- [Page 2] ---");
    });
  });

  describe("normalizeDocument with Scanned / Photographed OCR Fixture", () => {
    it("should parse and heal scanned OCR text with isOcr flag set", () => {
      const parsed = normalizeDocument({
        filename: "gig-partner-scan.png",
        mimeType: "image/png",
        fileSizeBytes: 182000,
        rawPages: [
          {
            pageNumber: 1,
            text: ocrContent,
          },
        ],
        isOcr: true,
      });

      expect(parsed.filename).toBe("gig-partner-scan.png");
      expect(parsed.mimeType).toBe("image/png");
      expect(parsed.isOcr).toBe(true);
      expect(parsed.pageCount).toBe(1);

      const pageText = parsed.pages[0].text;
      // Confirm broken hyphenations were healed
      expect(pageText).toContain("AGREEMENT");
      expect(pageText).toContain("TERMINATION");
      expect(pageText).toContain("permanently");
      expect(pageText).toContain("indemnify");
      expect(pageText).toContain("LIABILITY");

      expect(parsed.fullText).toContain("--- [Page 1] ---");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty raw pages gracefully with default empty page", () => {
      const parsed = normalizeDocument({
        filename: "empty-doc.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 0,
        rawPages: [],
        isOcr: false,
      });

      expect(parsed.pageCount).toBe(1);
      expect(parsed.pages[0].pageNumber).toBe(1);
      expect(parsed.pages[0].text).toBe("");
      expect(parsed.pages[0].wordCount).toBe(0);
    });
  });
});
