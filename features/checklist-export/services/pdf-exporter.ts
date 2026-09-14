import { jsPDF } from "jspdf";
import { type LegalMemo } from "../types";

/**
 * Builds and exports an official legal preparation memorandum PDF.
 * Styled per 03-UIUX-BRIEF.md with official letterhead, numbered action items,
 * and a distinct bordered section for questions to legal counsel.
 */
export function buildLegalMemoPdf(memo: LegalMemo): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // 1. Top Letterhead Banner
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setTextColor(176, 141, 87); // Brass #B08D57
  doc.text("NYAYSETU · CITIZEN LEGAL ACCESS & CONSULTATION PREPARATION", margin, y);
  y += 5;

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(27, 36, 48); // Ink navy #1B2430
  doc.text("LEGAL PREPARATION MEMORANDUM", margin, y);
  y += 3;

  // Thin brass divider line
  doc.setDrawColor(176, 141, 87);
  doc.setLineWidth(0.6);
  doc.line(margin, y, margin + contentWidth, y);
  y += 7;

  // 2. Metadata Box
  doc.setFillColor(247, 243, 234); // Parchment #F7F3EA
  doc.setDrawColor(224, 215, 198); // Border #E0D7C6
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 24, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(82, 93, 107); // Muted ink
  doc.text("CASE REFERENCE:", margin + 4, y + 6);
  doc.text("DOCUMENT FILE:", margin + 4, y + 12);
  doc.text("DATE GENERATED:", margin + 4, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(27, 36, 48);
  doc.text(memo.caseReference, margin + 40, y + 6);
  doc.text(memo.documentFilename, margin + 40, y + 12);
  doc.text(memo.generatedDate, margin + 40, y + 18);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(82, 93, 107);
  doc.text("RISK PROFILE:", margin + 110, y + 6);
  doc.text("TOTAL CLAUSES:", margin + 110, y + 12);

  doc.setFont("helvetica", "normal");
  if (memo.highRiskCount > 0) {
    doc.setTextColor(140, 47, 57); // Muted burgundy #8C2F39
    doc.text(`${memo.highRiskCount} High-Risk Provision(s)`, margin + 140, y + 6);
  } else {
    doc.setTextColor(63, 108, 81); // Sage green #3F6C51
    doc.text("Standard Terms", margin + 140, y + 6);
  }

  doc.setTextColor(27, 36, 48);
  doc.text(`${memo.totalClauses} analyzed`, margin + 140, y + 12);
  y += 32;

  // 3. Section 1: Executive Action Checklist
  checkPageBreak(25);
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(27, 36, 48);
  doc.text("1. EXECUTIVE ACTION CHECKLIST (BEFORE SIGNING)", margin, y);
  y += 2;

  doc.setDrawColor(224, 215, 198);
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(27, 36, 48);

  memo.actionItems.forEach((action, idx) => {
    checkPageBreak(14);
    // Draw checkbox square
    doc.setDrawColor(138, 148, 161);
    doc.setLineWidth(0.3);
    doc.rect(margin, y - 2.8, 3.5, 3.5);

    const itemText = `${idx + 1}.  ${action.text}`;
    const rawLines: unknown = doc.splitTextToSize(itemText, contentWidth - 8);
    const wrappedLines: string[] = Array.isArray(rawLines)
      ? (rawLines as string[])
      : [String(rawLines)];
    doc.text(wrappedLines, margin + 6, y);
    y += wrappedLines.length * 4.2 + 3;
  });

  y += 6;

  // 4. Section 2: Questions for Your Lawyer (Set Apart in Bordered Card)
  checkPageBreak(40);
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(27, 36, 48);
  doc.text("2. QUESTIONS FOR YOUR LEGAL ADVISOR / ADVOCATE", margin, y);
  y += 2;

  doc.setDrawColor(224, 215, 198);
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5;

  // Estimate height needed for questions box
  const questionLinesArray: string[][] = [];
  memo.lawyerQuestions.forEach((q, idx) => {
    const qText = `Q${idx + 1}: ${q.text}`;
    const rawQ: unknown = doc.splitTextToSize(qText, contentWidth - 10);
    const wrapped: string[] = Array.isArray(rawQ) ? (rawQ as string[]) : [String(rawQ)];
    questionLinesArray.push(wrapped);
  });

  const totalCardHeight =
    questionLinesArray.reduce((acc, lines) => acc + lines.length * 4.2 + 3, 0) + 10;

  // If card fits on current page, draw boxed card; otherwise draw clean formatted block
  if (y + totalCardHeight < pageHeight - 25) {
    doc.setFillColor(251, 249, 244); // #FBF9F4
    doc.setDrawColor(176, 141, 87); // Brass border
    doc.setLineWidth(0.4);
    doc.rect(margin, y, contentWidth, totalCardHeight, "FD");
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(27, 36, 48);

    questionLinesArray.forEach((lines) => {
      doc.text(lines, margin + 5, y);
      y += lines.length * 4.2 + 3;
    });
    y += 6;
  } else {
    // Flow questions across pages with individual item formatting
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(27, 36, 48);

    questionLinesArray.forEach((lines) => {
      checkPageBreak(lines.length * 4.2 + 4);
      doc.text(lines, margin + 4, y);
      y += lines.length * 4.2 + 3;
    });
    y += 4;
  }

  // 5. Statutory References Cited
  if (memo.statutoryCitations.length > 0) {
    checkPageBreak(25);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(82, 93, 107);
    doc.text("STATUTORY BENCHMARKS REFERENCED:", margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(82, 93, 107);
    memo.statutoryCitations.forEach((statute) => {
      checkPageBreak(5);
      doc.text(`•  ${statute}`, margin + 3, y);
      y += 4;
    });
    y += 4;
  }

  // 6. Formal Disclaimer Footer
  checkPageBreak(16);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(138, 148, 161);
  const footerText =
    "DISCLAIMER: This legal preparation memorandum was generated by NyaySetu to assist in citizen navigation and legal-aid preparation. It is grounded exclusively in the provided document text and does not constitute formal legal representation or attorney-client advice.";
  const rawFooter: unknown = doc.splitTextToSize(footerText, contentWidth);
  const wrappedFooter: string[] = Array.isArray(rawFooter)
    ? (rawFooter as string[])
    : [String(rawFooter)];
  doc.text(wrappedFooter, margin, y);

  return doc;
}

/**
 * Direct client-side trigger to download the generated Legal Preparation Memo PDF.
 */
export function exportLegalMemoToPdf(memo: LegalMemo): jsPDF {
  const doc = buildLegalMemoPdf(memo);
  const sanitizedTitle = memo.documentTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`NyaySetu_Memo_${sanitizedTitle}.pdf`);
  return doc;
}
