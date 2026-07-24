/* ---------------------------------------------------------------------------
   The simulated AI layer.

   NOTHING HERE CALLS A MODEL. Every value is fabricated.

   This module exists to pin down the *contract* between the product and a real
   extraction service, so the UI can be built and judged against a realistic
   response shape. In production the functions below would call a document-
   understanding model (Claude with a vision/tool-use pass over the scanned
   page, or a dedicated OCR + structured-extraction pipeline); the return types
   would not change.

   The design decisions this file encodes are real, and they are the ones worth
   discussing:

   1. Confidence is returned per extracted value, not per document. A W-2 can be
      99% legible in Box 1 and 61% in Box 17 — reporting one number for the page
      would hide exactly the thing a preparer needs to know.

   2. The model is never allowed to silently write a low-confidence value into
      a return. Below `AUTO_APPLY_THRESHOLD` it must surface a suggestion for a
      human instead. A tax return is a legal document; a plausible guess is
      worse than an obvious gap.

   3. Every suggestion must carry a rationale and, where possible,
      corroboration from an independent source (prior-year figures, a matching
      bank record). "Trust me, 61%" is not a reviewable statement.
--------------------------------------------------------------------------- */

/** At or above this, an extraction may populate a field unattended. */
export const AUTO_APPLY_THRESHOLD = 0.85;

/** Below this, the UI additionally requires the reviewer to open the evidence. */
export const EVIDENCE_REQUIRED_THRESHOLD = 0.85;

export interface AIExtraction {
  documentId: string;
  boxId: string;
  /** The literal text the model believes it read. */
  rawText: string;
  /** Parsed numeric value, where the box is monetary. */
  value: number | null;
  confidence: number;
  /** Why the model is or isn't sure. Written for a human, not a log file. */
  rationale: string;
  /** An independent signal supporting the read. */
  corroboration?: string;
  /** Which return line this value is destined for. */
  targetLine: string;
  /** Arithmetic applied between document and return, if any. */
  transformation?: string;
}

export type AIWarningSeverity = "info" | "attention" | "serious";

export interface AIWarning {
  id: string;
  returnId: string;
  severity: AIWarningSeverity;
  title: string;
  /** Plain-language explanation of what looks wrong. */
  detail: string;
  /** What the model suggests a human do about it. */
  suggestedAction: string;
  relatedLines: string[];
  relatedDocuments?: string[];
  /** How the model noticed. Naming the method is part of being auditable. */
  method: "year-over-year comparison" | "cross-document check" | "rule check" | "document scan";
}

export interface AIDocumentRead {
  documentId: string;
  documentType: string;
  /** Overall page legibility — used for the "low scan quality" notice only. */
  legibility: number;
  extractions: AIExtraction[];
  warnings: AIWarning[];
  /** Milliseconds a real call would plausibly take, for honest loading states. */
  elapsedMs: number;
}

/* -------------------------------------------------------------------------- */
/* The fabricated response set                                                 */
/* -------------------------------------------------------------------------- */

const EXTRACTIONS: AIExtraction[] = [
  {
    documentId: "doc-rivera-w2",
    boxId: "w2_box1",
    rawText: "85,000.00",
    value: 85000,
    confidence: 0.99,
    rationale: "Printed digits, clean scan, matches the box's expected format.",
    corroboration: "Employer and EIN match last year's W-2 from Acme Corp.",
    targetLine: "1a",
  },
  {
    documentId: "doc-rivera-w2",
    boxId: "w2_box2",
    rawText: "14,120.00",
    value: 14120,
    confidence: 0.99,
    rationale: "Printed digits, clean scan.",
    targetLine: "25a",
    transformation: "Summed with withholding from other documents.",
  },
  {
    documentId: "doc-rivera-1099int",
    boxId: "int_box1",
    rawText: "1,4?2.00",
    value: 1432,
    confidence: 0.68,
    rationale:
      "The third digit is obscured by a scan artifact. Shape analysis favors a 3 over a 7, but not decisively.",
    corroboration:
      "Prior-year interest from the same payer was $1,395 — within 3% of the $1,432 reading, and 6% from $1,472.",
    targetLine: "2b",
  },
  {
    documentId: "doc-rivera-1099nec",
    boxId: "nec_box1",
    rawText: "12,000.00",
    value: 12000,
    confidence: 0.97,
    rationale: "Printed digits, clean scan.",
    targetLine: "8",
  },
  {
    documentId: "doc-chen-w2",
    boxId: "w2_box1",
    rawText: "128,400.00",
    value: 128400,
    confidence: 0.98,
    rationale: "Clean scan of a standard payroll-issued W-2.",
    targetLine: "1a",
  },
  {
    documentId: "doc-chen-1099div",
    boxId: "div_box1a",
    rawText: "3,210.00",
    value: 3210,
    confidence: 0.96,
    rationale: "Clean scan.",
    targetLine: "3b",
  },
  {
    documentId: "doc-chen-receipt",
    boxId: "rcpt_amount",
    rawText: "2,340",
    value: 2340,
    confidence: 0.71,
    rationale:
      "Handwritten amount on a charity receipt. The leading digit is legible; the cents are not recorded.",
    corroboration:
      "No matching bank withdrawal was found in the statements provided, so this could not be cross-checked.",
    targetLine: "12b",
  },
  {
    documentId: "doc-petrov-k1",
    boxId: "k1_box1",
    rawText: "204,500.00",
    value: 204500,
    confidence: 0.94,
    rationale: "Clean scan; figures agree with the partnership's summary page.",
    targetLine: "K1-1",
  },
];

const WARNINGS: AIWarning[] = [
  {
    id: "warn-rivera-int",
    returnId: "ret-rivera-2025",
    severity: "attention",
    title: "One digit on the Chase 1099-INT could not be read cleanly",
    detail:
      "The interest amount reads as $1,432, but a scan artifact covers part of the third digit. The return currently carries $1,240, which matches neither reading.",
    suggestedAction:
      "Confirm the amount against the paper copy, or ask Marcus to re-photograph the form.",
    relatedLines: ["2b"],
    relatedDocuments: ["doc-rivera-1099int"],
    method: "document scan",
  },
  {
    id: "warn-rivera-qbi",
    returnId: "ret-rivera-2025",
    severity: "serious",
    title: "Consulting income may be a specified service trade or business",
    detail:
      "Schedule C income of $12,000 is claimed for the qualified business income deduction. If the consulting work is an SSTB, the deduction may be limited or unavailable at this income level.",
    suggestedAction:
      "Confirm the nature of the consulting work with the client before the deduction stands.",
    relatedLines: ["13"],
    method: "rule check",
  },
  {
    id: "warn-chen-charity",
    returnId: "ret-chen-2025",
    severity: "attention",
    title: "Charitable donation has no corroborating bank record",
    detail:
      "A handwritten receipt for $2,340 was provided, but no matching withdrawal appears in the bank statements on file.",
    suggestedAction:
      "Ask the client for the bank or card record before including the deduction.",
    relatedLines: ["12b"],
    relatedDocuments: ["doc-chen-receipt"],
    method: "cross-document check",
  },
  {
    id: "warn-chen-yoy",
    returnId: "ret-chen-2025",
    severity: "info",
    title: "Wages rose 14% year over year",
    detail:
      "Wages of $128,400 compare with $112,600 last year. This is a normal-looking change, noted only for context.",
    suggestedAction: "No action needed unless the client expected different figures.",
    relatedLines: ["1a"],
    method: "year-over-year comparison",
  },
  {
    id: "warn-petrov-basis",
    returnId: "ret-petrov-2025",
    severity: "serious",
    title: "A basis worksheet is missing for the second partnership",
    detail:
      "Losses are claimed from two partnerships, but only one has a basis worksheet on file. Loss deductibility cannot be confirmed without it.",
    suggestedAction: "Request the 2025 basis worksheet from the client before filing.",
    relatedLines: ["K1-1"],
    method: "cross-document check",
  },
];

/* -------------------------------------------------------------------------- */
/* The "API"                                                                   */
/* -------------------------------------------------------------------------- */

/** All fabricated extractions for a document. */
export function getExtractions(documentId: string): AIExtraction[] {
  return EXTRACTIONS.filter((e) => e.documentId === documentId);
}

/** The extraction that produced a given return line, if any. */
export function getExtractionForLine(
  documentId: string,
  boxId: string
): AIExtraction | undefined {
  return EXTRACTIONS.find((e) => e.documentId === documentId && e.boxId === boxId);
}

/** Everything the AI wants to say about a return. */
export function getWarnings(returnId: string): AIWarning[] {
  const order: Record<AIWarningSeverity, number> = {
    serious: 0,
    attention: 1,
    info: 2,
  };
  return WARNINGS.filter((w) => w.returnId === returnId).sort(
    (a, b) => order[a.severity] - order[b.severity]
  );
}

export function getWarningsForLine(returnId: string, lineId: string): AIWarning[] {
  return getWarnings(returnId).filter((w) => w.relatedLines.includes(lineId));
}

/**
 * Whether an extraction may populate a field without a human.
 * Deliberately conservative — see note 2 at the top of this file.
 */
export function mayAutoApply(confidence: number): boolean {
  return confidence >= AUTO_APPLY_THRESHOLD;
}

/**
 * Simulates the latency of a real extraction call, so loading states in the
 * UI are honest about the fact that this work takes time.
 */
export function simulateRead(documentId: string): Promise<AIDocumentRead> {
  const extractions = getExtractions(documentId);
  const elapsedMs = 900 + extractions.length * 220;
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          documentId,
          documentType: documentId.split("-").slice(-1)[0],
          legibility: Math.min(...extractions.map((e) => e.confidence), 1),
          extractions,
          warnings: WARNINGS.filter((w) =>
            w.relatedDocuments?.includes(documentId)
          ),
          elapsedMs,
        }),
      // Kept short so the prototype stays pleasant to click through.
      Math.min(elapsedMs, 1400)
    );
  });
}
