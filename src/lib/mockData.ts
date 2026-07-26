import type {
  ClientTask,
  Person,
  QuestionnaireItem,
  ReturnLine,
  SourceDocument,
  TaxReturn,
  Thread,
} from "./types";
import { ROLE, gradeFromScore } from "./design";

/* ---------------------------------------------------------------------------
   Hardcoded demo data. No database, no API, no document parsing.

   The prototype is pinned to a fixed demo date so the story stays internally
   consistent whenever it is opened: late March, three weeks out from the
   April 15 deadline, which is when prioritization actually matters.
--------------------------------------------------------------------------- */

export const TODAY = new Date("2026-03-25T09:00:00");
export const FILING_DEADLINE = new Date("2026-04-15T00:00:00");

export function daysUntil(date: string | Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.round((d.getTime() - TODAY.getTime()) / 86_400_000);
}

export function daysSince(date: string | Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.round((TODAY.getTime() - d.getTime()) / 86_400_000);
}

export function relativeTime(date: string | Date): string {
  const days = daysSince(date);
  if (days <= 0) {
    const hours = Math.round(
      (TODAY.getTime() - new Date(date).getTime()) / 3_600_000
    );
    if (hours <= 1) return "just now";
    return `${hours}h ago`;
  }
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  return `${Math.floor(days / 7)} weeks ago`;
}

/* -------------------------------------------------------------------------- */
/* People                                                                      */
/* -------------------------------------------------------------------------- */

export const PEOPLE: Person[] = [
  {
    id: "u-jordan",
    name: "Jordan Reyes",
    role: "preparer",
    initials: "JR",
    title: "Senior tax preparer",
    // Jordan is staff, and also has a personal return with the firm.
    // This is the multi-role case the product has to handle gracefully.
    alsoClientOfReturnId: "ret-reyes-2025",
  },
  {
    id: "u-dana",
    name: "Dana Whitfield",
    role: "reviewer",
    initials: "DW",
    title: "Review manager, CPA",
  },
  {
    id: "u-marcus",
    name: "Marcus Rivera",
    role: "client",
    initials: "MR",
  },
  {
    id: "u-sarah",
    name: "Sarah Chen",
    role: "client",
    initials: "SC",
  },
  {
    id: "u-elena",
    name: "Elena Petrov",
    role: "client",
    initials: "EP",
    title: "Owner, Petrov Design Studio",
  },
];

export const CURRENT_USER_ID = "u-jordan";

export function personByName(name: string): Person | undefined {
  return PEOPLE.find((p) => p.name === name || p.name.split(" ")[0] === name);
}

/**
 * The role to print beside a name — "Jordan Reyes" → "Preparer".
 *
 * A bare first name only means something to someone who already knows the
 * team, so every surface that shows a name shows this next to it. It lives
 * here, next to PEOPLE, because three screens had been about to grow three
 * slightly different versions of it.
 *
 * Non-people are named too: audit trails record "AI" and "System" as actors,
 * and leaving those unlabelled is what makes a machine's edit look like a
 * colleague's.
 */
export function roleLabelForName(name: string): string {
  if (name === "AI") return "Automated";
  if (name === "System") return "Automatic";
  const person = personByName(name);
  return person ? ROLE[person.role].label : "Staff";
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Source documents                                                            */
/* -------------------------------------------------------------------------- */

export const DOCUMENTS: SourceDocument[] = [
  {
    id: "doc-rivera-2024-w2",
    returnId: "ret-rivera-2024",
    type: "W-2",
    title: "W-2 · Wage and Tax Statement",
    issuer: "Acme Corp",
    taxYear: 2024,
    uploadedBy: "Marcus Rivera",
    uploadedAt: "2025-03-04T09:12:00",
    pages: 1,
    scanQuality: "clean",
    feedsLines: ["1a"],
    boxes: [
      { id: "w2_employer", label: "Employer", value: "Acme Corp" },
      { id: "w2_employee", label: "Employee", value: "Marcus Rivera" },
      { id: "w2_box1", label: "Box 1 · Wages, tips, other comp.", value: "$78,500.00", confidence: 0.99 },
      { id: "w2_box2", label: "Box 2 · Federal income tax withheld", value: "$11,900.00", confidence: 0.99 },
    ],
  },
  {
    id: "doc-rivera-2024-1099int",
    returnId: "ret-rivera-2024",
    type: "1099-INT",
    title: "1099-INT · Interest Income",
    issuer: "Chase Bank N.A.",
    taxYear: 2024,
    uploadedBy: "Marcus Rivera",
    uploadedAt: "2025-03-04T09:14:00",
    pages: 1,
    scanQuality: "clean",
    feedsLines: ["2b"],
    boxes: [
      { id: "int_payer", label: "Payer", value: "Chase Bank N.A." },
      { id: "int_recipient", label: "Recipient", value: "Marcus Rivera" },
      { id: "int_box1", label: "Box 1 · Interest income", value: "$1,395.00", confidence: 0.98, wide: true },
    ],
  },
  {
    id: "doc-rivera-w2",
    returnId: "ret-rivera-2025",
    type: "W-2",
    title: "W-2 · Wage and Tax Statement",
    issuer: "Acme Corp",
    taxYear: 2025,
    uploadedBy: "Marcus Rivera",
    uploadedAt: "2026-03-08T14:20:00",
    pages: 1,
    scanQuality: "clean",
    feedsLines: ["1a", "25a"],
    boxes: [
      { id: "w2_employer", label: "Employer", value: "Acme Corp" },
      { id: "w2_employee", label: "Employee", value: "Marcus Rivera" },
      { id: "w2_box1", label: "Box 1 · Wages, tips, other comp.", value: "$85,000.00", confidence: 0.99 },
      { id: "w2_box2", label: "Box 2 · Federal income tax withheld", value: "$14,120.00", confidence: 0.99 },
      { id: "w2_box15", label: "Box 15 · State", value: "CA" },
      { id: "w2_box17", label: "Box 17 · State income tax", value: "$4,290.00", confidence: 0.96 },
    ],
  },
  {
    id: "doc-rivera-1099int",
    returnId: "ret-rivera-2025",
    type: "1099-INT",
    title: "1099-INT · Interest Income",
    issuer: "Chase Bank N.A.",
    taxYear: 2025,
    uploadedBy: "Marcus Rivera",
    uploadedAt: "2026-03-20T18:02:00",
    pages: 1,
    scanQuality: "low",
    notice: "Photographed at an angle; one digit is obscured by glare.",
    feedsLines: ["2b"],
    boxes: [
      { id: "int_payer", label: "Payer", value: "Chase Bank N.A." },
      { id: "int_recipient", label: "Recipient", value: "Marcus Rivera" },
      {
        id: "int_box1",
        label: "Box 1 · Interest income",
        value: "$1,4?2.00",
        confidence: 0.68,
        uncertain: true,
        wide: true,
      },
      { id: "int_box4", label: "Box 4 · Federal tax withheld", value: "$0.00" },
    ],
  },
  {
    id: "doc-rivera-1099nec",
    returnId: "ret-rivera-2025",
    type: "1099-NEC",
    title: "1099-NEC · Nonemployee Compensation",
    issuer: "Brightline Consulting LLC",
    taxYear: 2025,
    uploadedBy: "Marcus Rivera",
    uploadedAt: "2026-03-08T14:22:00",
    pages: 1,
    scanQuality: "clean",
    feedsLines: ["8", "13"],
    boxes: [
      { id: "nec_payer", label: "Payer", value: "Brightline Consulting LLC" },
      { id: "nec_recipient", label: "Recipient", value: "Marcus Rivera" },
      {
        id: "nec_box1",
        label: "Box 1 · Nonemployee compensation",
        value: "$12,000.00",
        confidence: 0.97,
        wide: true,
      },
    ],
  },
  {
    id: "doc-chen-w2",
    returnId: "ret-chen-2025",
    type: "W-2",
    title: "W-2 · Wage and Tax Statement",
    issuer: "Northwind Health",
    taxYear: 2025,
    uploadedBy: "Sarah Chen",
    uploadedAt: "2026-03-19T08:40:00",
    pages: 1,
    scanQuality: "clean",
    feedsLines: ["1a", "25a"],
    boxes: [
      { id: "w2_employer", label: "Employer", value: "Northwind Health" },
      { id: "w2_employee", label: "Employee", value: "Sarah Chen" },
      { id: "w2_box1", label: "Box 1 · Wages, tips, other comp.", value: "$128,400.00", confidence: 0.98 },
      { id: "w2_box2", label: "Box 2 · Federal income tax withheld", value: "$21,880.00", confidence: 0.98 },
      { id: "w2_box15", label: "Box 15 · State", value: "CA" },
      { id: "w2_box17", label: "Box 17 · State income tax", value: "$8,140.00", confidence: 0.97 },
    ],
  },
  {
    id: "doc-chen-1099div",
    returnId: "ret-chen-2025",
    type: "1099-DIV",
    title: "1099-DIV · Dividends and Distributions",
    issuer: "Vanguard Brokerage",
    taxYear: 2025,
    uploadedBy: "Sarah Chen",
    uploadedAt: "2026-03-19T08:41:00",
    pages: 2,
    scanQuality: "clean",
    feedsLines: ["3b"],
    boxes: [
      { id: "div_payer", label: "Payer", value: "Vanguard Brokerage" },
      { id: "div_box1a", label: "Box 1a · Total ordinary dividends", value: "$3,210.00", confidence: 0.96 },
      { id: "div_box1b", label: "Box 1b · Qualified dividends", value: "$2,980.00", confidence: 0.96 },
      { id: "div_box2a", label: "Box 2a · Capital gain distributions", value: "$410.00", confidence: 0.94 },
    ],
  },
  {
    id: "doc-chen-receipt",
    returnId: "ret-chen-2025",
    type: "receipt",
    title: "Donation receipt",
    issuer: "Goodwill Industries",
    taxYear: 2025,
    uploadedBy: "Sarah Chen",
    uploadedAt: "2026-03-19T08:44:00",
    pages: 1,
    scanQuality: "low",
    notice: "Handwritten amount. No matching bank record was found.",
    feedsLines: ["12b"],
    boxes: [
      { id: "rcpt_org", label: "Organization", value: "Goodwill Industries" },
      {
        id: "rcpt_amount",
        label: "Amount (handwritten)",
        value: "$2,340",
        confidence: 0.71,
        uncertain: true,
        wide: true,
      },
      { id: "rcpt_date", label: "Date", value: "Nov 12, 2025" },
      { id: "rcpt_signed", label: "Signed by receiving agent", value: "Yes" },
    ],
  },
  {
    id: "doc-petrov-k1",
    returnId: "ret-petrov-2025",
    type: "K-1",
    title: "Schedule K-1 · Partner's Share of Income",
    issuer: "Meridian Partners LP",
    taxYear: 2025,
    uploadedBy: "Elena Petrov",
    uploadedAt: "2026-03-14T11:15:00",
    pages: 3,
    scanQuality: "clean",
    feedsLines: ["K1-1"],
    boxes: [
      { id: "k1_partnership", label: "Partnership", value: "Meridian Partners LP" },
      { id: "k1_partner", label: "Partner", value: "Elena Petrov" },
      { id: "k1_box1", label: "Box 1 · Ordinary business income", value: "$204,500.00", confidence: 0.94 },
      { id: "k1_box2", label: "Box 2 · Net rental real estate income", value: "$0.00" },
      { id: "k1_box19", label: "Box 19 · Distributions", value: "$180,000.00", confidence: 0.93 },
    ],
  },
];

/* Built on first use, not at module-evaluation time: the generator below
   depends on data declared later in this file. */
let allDocumentsCache: SourceDocument[] | null = null;
function allDocuments(): SourceDocument[] {
  if (!allDocumentsCache) {
    allDocumentsCache = [...DOCUMENTS, ...generateBusinessDocuments()];
  }
  return allDocumentsCache;
}

export function documentsFor(returnId: string): SourceDocument[] {
  return allDocuments().filter((d) => d.returnId === returnId);
}

export function documentById(id: string): SourceDocument | undefined {
  return allDocuments().find((d) => d.id === id);
}

/* -------------------------------------------------------------------------- */
/* Questionnaire answers — a source of truth as real as any document           */
/* -------------------------------------------------------------------------- */

export const QUESTIONNAIRE: Record<string, QuestionnaireItem[]> = {
  "ret-rivera-2025": [
    {
      id: "q-rivera-1",
      question: "Did your filing status change during 2025?",
      answer: "No — still single",
      answeredBy: "Marcus Rivera",
      answeredAt: "2026-03-07T19:30:00",
      affectsLines: ["12"],
    },
    {
      id: "q-rivera-4",
      question: "Do you have any brokerage or cryptocurrency accounts?",
      answer: "No",
      answeredBy: "Marcus Rivera",
      answeredAt: "2026-03-07T19:32:00",
      affectsLines: ["7"],
    },
    {
      id: "q-rivera-6",
      question: "Did you contribute to an IRA, HSA, or pay student-loan interest?",
      answer: "No",
      answeredBy: "Marcus Rivera",
      answeredAt: "2026-03-07T19:33:00",
      affectsLines: ["10"],
    },
    {
      id: "q-rivera-7",
      question: "Did you make estimated tax payments during 2025?",
      answer: "No",
      answeredBy: "Marcus Rivera",
      answeredAt: "2026-03-07T19:34:00",
      affectsLines: ["26"],
    },
  ],
  "ret-chen-2025": [
    {
      id: "q-chen-3",
      question: "Did you have any children or dependents in 2025?",
      answer: "Yes — my daughter was born in March",
      answeredBy: "Sarah Chen",
      answeredAt: "2026-03-25T07:40:00",
      affectsLines: ["19"],
    },
    {
      id: "q-chen-7",
      question: "Did you make estimated tax payments during 2025?",
      answer: "No",
      answeredBy: "Sarah Chen",
      answeredAt: "2026-03-19T08:36:00",
      affectsLines: ["26"],
    },
  ],
};

export function questionnaireFor(returnId: string): QuestionnaireItem[] {
  return QUESTIONNAIRE[returnId] ?? [];
}

/* -------------------------------------------------------------------------- */
/* Return lines — Marcus Rivera, the flagship demo return                      */
/* -------------------------------------------------------------------------- */

const RIVERA_LINES: ReturnLine[] = [
  {
    id: "1a",
    section: "Income",
    label: "Wages, salaries, tips",
    amount: 85000,
    state: "verified",
    confidence: 0.99,
    editable: true,
    feedsInto: ["9"],
    provenance: {
      kind: "document",
      documentId: "doc-rivera-w2",
      citation: "W-2 · Acme Corp · Box 1 · page 1",
      page: 1,
      boxId: "w2_box1",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Read at 99%", at: "2026-03-08T14:25:00" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Verified against the W-2", at: "2026-03-09T10:12:00" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [
      { at: "2026-03-08T14:25:00", actor: "AI", action: "extracted", detail: "Read $85,000 from W-2 Box 1 at 99% confidence", to: 85000 },
      { at: "2026-03-09T10:12:00", actor: "Jordan Reyes", action: "verified", detail: "Checked against the uploaded W-2" },
    ],
  },
  {
    id: "2b",
    section: "Income",
    label: "Taxable interest",
    amount: 1240,
    state: "needs_review",
    confidence: 0.68,
    editable: true,
    feedsInto: ["9"],
    threadId: "thread-rivera-interest",
    provenance: {
      kind: "document",
      documentId: "doc-rivera-1099int",
      citation: "1099-INT · Chase Bank · Box 1 · page 1",
      page: 1,
      boxId: "int_box1",
    },
    aiSuggestion: {
      value: 1432,
      confidence: 0.68,
      rationale:
        "A scan artifact covers part of the third digit. Shape analysis favors $1,432, but not decisively.",
      corroboration: "Prior-year interest from the same payer was $1,395.",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "attention", note: "Reads $1,432 at 68%", at: "2026-03-20T18:05:00" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "attention", note: "Waiting on your decision" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [
      { at: "2026-03-08T14:26:00", actor: "Jordan Reyes", action: "edited", detail: "Entered $1,240 from the client's own summary, pending the form", to: 1240 },
      { at: "2026-03-20T18:05:00", actor: "AI", action: "extracted", detail: "Read $1,432 from 1099-INT Box 1 at 68% — held for review, not applied", to: 1432 },
      { at: "2026-03-20T18:30:00", actor: "Jordan Reyes", action: "requested", detail: "Asked Marcus to confirm the amount" },
    ],
  },
  {
    id: "3b",
    section: "Income",
    label: "Ordinary dividends",
    amount: null,
    state: "empty",
    editable: true,
    feedsInto: ["9"],
    provenance: {
      kind: "none",
      reason:
        "No dividend statement was provided, and Marcus confirmed he holds no brokerage accounts.",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "No matching document found" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Consistent with questionnaire Q4" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
  },
  {
    id: "7",
    section: "Income",
    label: "Capital gain or (loss)",
    amount: null,
    state: "empty",
    editable: true,
    feedsInto: ["9"],
    provenance: {
      kind: "answer",
      questionId: "q-rivera-4",
      question: "Do you have any brokerage or cryptocurrency accounts?",
      answer: "No",
      answeredBy: "Marcus Rivera",
      answeredAt: "2026-03-07T19:32:00",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "No 1099-B on file" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Confirmed by the client's answer" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
  },
  {
    id: "8",
    section: "Income",
    label: "Additional income (Schedule 1)",
    amount: 12000,
    state: "ai_extracted",
    confidence: 0.97,
    editable: true,
    feedsInto: ["9"],
    provenance: {
      kind: "document",
      documentId: "doc-rivera-1099nec",
      citation: "1099-NEC · Brightline Consulting · Box 1",
      page: 1,
      boxId: "nec_box1",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Read at 97%", at: "2026-03-08T14:25:00" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "waiting", note: "Not yet verified" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [
      { at: "2026-03-08T14:25:00", actor: "AI", action: "extracted", detail: "Read $12,000 from 1099-NEC Box 1 at 97% confidence", to: 12000 },
    ],
  },
  {
    id: "9",
    section: "Income",
    label: "Total income",
    amount: 98240,
    state: "calculated",
    editable: false,
    lockReason: "Calculated from the income lines above.",
    provenance: {
      kind: "calculation",
      formula: "Line 1a + Line 2b + Line 8",
      inputs: [
        { lineId: "1a", label: "Wages", amount: 85000 },
        { lineId: "2b", label: "Taxable interest", amount: 1240 },
        { lineId: "8", label: "Additional income", amount: 12000 },
      ],
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Cross-foots" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
    feedsInto: ["11"],
  },
  {
    id: "10",
    section: "Adjustments & deductions",
    label: "Adjustments to income",
    amount: 0,
    state: "verified",
    editable: true,
    feedsInto: ["11"],
    provenance: {
      kind: "answer",
      questionId: "q-rivera-6",
      question: "Did you contribute to an IRA, HSA, or pay student-loan interest?",
      answer: "No",
      answeredBy: "Marcus Rivera",
      answeredAt: "2026-03-07T19:33:00",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "No supporting documents found" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Verified against questionnaire Q6" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
  },
  {
    id: "11",
    section: "Adjustments & deductions",
    label: "Adjusted gross income",
    amount: 98240,
    state: "calculated",
    editable: false,
    lockReason: "Calculated: total income less adjustments.",
    provenance: {
      kind: "calculation",
      formula: "Line 9 − Line 10",
      inputs: [
        { lineId: "9", label: "Total income", amount: 98240 },
        { lineId: "10", label: "Adjustments", amount: 0 },
      ],
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
    feedsInto: ["15"],
  },
  {
    id: "12",
    section: "Adjustments & deductions",
    label: "Standard deduction",
    amount: 14600,
    state: "rule",
    editable: false,
    lockReason:
      "Set by the IRS standard deduction table for a single filer. Itemising would replace it.",
    feedsInto: ["15"],
    provenance: {
      kind: "rule",
      rule: "IRS standard deduction, tax year 2025",
      detail: "Filing status: single. Table value $14,600.",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Rule applied" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
  },
  {
    id: "13",
    section: "Adjustments & deductions",
    label: "Qualified business income deduction",
    amount: 2400,
    state: "flagged",
    editable: true,
    feedsInto: ["15"],
    threadId: "thread-rivera-qbi",
    flag: {
      byName: "Dana Whitfield",
      byRole: "reviewer",
      at: "2026-03-21T16:05:00",
      note: "Is the $12,000 of consulting a trade or business, or a one-off payment? The deduction only stands if he carried the work on regularly. Please confirm before this goes out.",
      resolution:
        "Confirmed with the client: he consulted on recurring engagements through the year, so it is a trade or business and the deduction stands.",
    },
    provenance: {
      kind: "calculation",
      formula: "20% of qualified business income (Form 8995)",
      inputs: [{ lineId: "8", label: "Schedule C consulting income", amount: 12000 }],
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed via Form 8995" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Entered Mar 19" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "flagged", note: "Flagged Mar 21", at: "2026-03-21T16:05:00" },
    ],
    history: [
      { at: "2026-03-19T15:40:00", actor: "AI", action: "extracted", detail: "Computed $2,400 as 20% of $12,000 QBI", to: 2400 },
      { at: "2026-03-21T16:05:00", actor: "Dana Whitfield", action: "flagged", detail: "Held pending confirmation that the consulting is a trade or business" },
    ],
  },
  {
    id: "15",
    section: "Adjustments & deductions",
    label: "Taxable income",
    amount: 81240,
    state: "calculated",
    editable: false,
    lockReason: "Calculated from AGI less deductions.",
    provenance: {
      kind: "calculation",
      formula: "Line 11 − Line 12 − Line 13",
      inputs: [
        { lineId: "11", label: "Adjusted gross income", amount: 98240 },
        { lineId: "12", label: "Standard deduction", amount: 14600 },
        { lineId: "13", label: "QBI deduction", amount: 2400 },
      ],
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
    feedsInto: ["16"],
  },
  {
    id: "16",
    section: "Tax & payments",
    label: "Tax",
    amount: 12787,
    state: "calculated",
    editable: false,
    lockReason: "Calculated from the 2025 tax tables.",
    provenance: {
      kind: "calculation",
      formula: "2025 tax table, single filer, applied to taxable income",
      inputs: [{ lineId: "15", label: "Taxable income", amount: 81240 }],
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
    feedsInto: ["24"],
  },
  {
    id: "24",
    section: "Tax & payments",
    label: "Total tax",
    amount: 12787,
    state: "calculated",
    editable: false,
    lockReason: "Calculated.",
    provenance: {
      kind: "calculation",
      formula: "Line 16 plus other taxes",
      inputs: [{ lineId: "16", label: "Tax", amount: 12787 }],
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
    feedsInto: ["34"],
  },
  {
    id: "25a",
    section: "Tax & payments",
    label: "Federal income tax withheld",
    amount: 14120,
    state: "verified",
    confidence: 0.99,
    editable: true,
    feedsInto: ["33"],
    provenance: {
      kind: "document",
      documentId: "doc-rivera-w2",
      citation: "W-2 · Acme Corp · Box 2 · page 1",
      page: 1,
      boxId: "w2_box2",
      transformation: "Summed with withholding reported on other documents ($0).",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Read at 99%" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Verified" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [
      { at: "2026-03-08T14:25:00", actor: "AI", action: "extracted", detail: "Read $14,120 from W-2 Box 2", to: 14120 },
      { at: "2026-03-09T10:14:00", actor: "Jordan Reyes", action: "verified", detail: "Checked against the W-2" },
    ],
  },
  {
    id: "26",
    section: "Tax & payments",
    label: "Estimated tax payments",
    amount: 0,
    state: "verified",
    editable: true,
    feedsInto: ["33"],
    provenance: {
      kind: "answer",
      questionId: "q-rivera-7",
      question: "Did you make estimated tax payments during 2025?",
      answer: "No",
      answeredBy: "Marcus Rivera",
      answeredAt: "2026-03-07T19:34:00",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "No payment vouchers found" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Verified against questionnaire Q7" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
  },
  {
    id: "33",
    section: "Tax & payments",
    label: "Total payments",
    amount: 14120,
    state: "calculated",
    editable: false,
    lockReason: "Calculated from withholding and estimated payments.",
    provenance: {
      kind: "calculation",
      formula: "Line 25a + Line 26",
      inputs: [
        { lineId: "25a", label: "Withholding", amount: 14120 },
        { lineId: "26", label: "Estimated payments", amount: 0 },
      ],
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
    feedsInto: ["34"],
  },
  {
    id: "34",
    section: "Refund",
    label: "Overpayment — your refund",
    amount: 1333,
    state: "calculated",
    editable: false,
    lockReason: "Calculated: payments less total tax.",
    provenance: {
      kind: "calculation",
      formula: "Line 33 − Line 24",
      inputs: [
        { lineId: "33", label: "Total payments", amount: 14120 },
        { lineId: "24", label: "Total tax", amount: 12787 },
      ],
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "attention", note: "Provisional until 2 open items clear" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
  },
];

/* -------------------------------------------------------------------------- */
/* Sarah Chen — a return one step earlier, with a different mix of problems    */
/* -------------------------------------------------------------------------- */

const CHEN_LINES: ReturnLine[] = [
  {
    id: "1a",
    section: "Income",
    label: "Wages, salaries, tips",
    amount: 128400,
    state: "ai_extracted",
    confidence: 0.98,
    editable: true,
    feedsInto: ["9"],
    provenance: {
      kind: "document",
      documentId: "doc-chen-w2",
      citation: "W-2 · Northwind Health · Box 1 · page 1",
      page: 1,
      boxId: "w2_box1",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Read at 98%" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "waiting", note: "Not yet verified" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [
      { at: "2026-03-19T08:45:00", actor: "AI", action: "extracted", detail: "Read $128,400 from W-2 Box 1", to: 128400 },
    ],
  },
  {
    id: "3b",
    section: "Income",
    label: "Ordinary dividends",
    amount: 3210,
    state: "ai_extracted",
    confidence: 0.96,
    editable: true,
    feedsInto: ["9"],
    provenance: {
      kind: "document",
      documentId: "doc-chen-1099div",
      citation: "1099-DIV · Vanguard · Box 1a · page 1",
      page: 1,
      boxId: "div_box1a",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Read at 96%" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "waiting" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
  },
  {
    id: "9",
    section: "Income",
    label: "Total income",
    amount: 131610,
    state: "calculated",
    editable: false,
    lockReason: "Calculated from the income lines above.",
    provenance: {
      kind: "calculation",
      formula: "Line 1a + Line 3b",
      inputs: [
        { lineId: "1a", label: "Wages", amount: 128400 },
        { lineId: "3b", label: "Ordinary dividends", amount: 3210 },
      ],
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "waiting" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
  },
  {
    id: "12b",
    section: "Adjustments & deductions",
    label: "Charitable contributions",
    amount: 2340,
    state: "needs_review",
    confidence: 0.71,
    editable: true,
    threadId: "thread-chen-charity",
    provenance: {
      kind: "document",
      documentId: "doc-chen-receipt",
      citation: "Donation receipt · Goodwill · handwritten",
      page: 1,
      boxId: "rcpt_amount",
    },
    aiSuggestion: {
      value: 2340,
      confidence: 0.71,
      rationale: "Handwritten amount on a charity receipt; the cents are not recorded.",
      corroboration: "No matching bank withdrawal was found in the statements provided.",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "attention", note: "Read at 71% — no corroborating record" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "attention", note: "Needs a decision" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [
      { at: "2026-03-19T08:47:00", actor: "AI", action: "extracted", detail: "Read $2,340 at 71% — held for review, not applied", to: 2340 },
    ],
  },
  {
    id: "19",
    section: "Tax & payments",
    label: "Child tax credit",
    amount: null,
    state: "needs_review",
    editable: true,
    threadId: "thread-chen-dependent",
    provenance: {
      kind: "answer",
      questionId: "q-chen-3",
      question: "Did you have any children or dependents in 2025?",
      answer: "Yes — my daughter was born in March",
      answeredBy: "Sarah Chen",
      answeredAt: "2026-03-25T07:40:00",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "attention", note: "New answer changes this line" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "attention", note: "Add the dependent" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [
      { at: "2026-03-25T07:40:00", actor: "Sarah Chen", action: "answered", detail: "Reported a new dependent born in March 2025" },
    ],
  },
  {
    id: "25a",
    section: "Tax & payments",
    label: "Federal income tax withheld",
    amount: 21880,
    state: "ai_extracted",
    confidence: 0.98,
    editable: true,
    provenance: {
      kind: "document",
      documentId: "doc-chen-w2",
      citation: "W-2 · Northwind Health · Box 2 · page 1",
      page: 1,
      boxId: "w2_box2",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Read at 98%" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "waiting" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
    ],
    history: [],
  },
];

/* -------------------------------------------------------------------------- */
/* Elena Petrov — a business return sitting with the reviewer                  */
/* -------------------------------------------------------------------------- */

const PETROV_LINES: ReturnLine[] = [
  {
    id: "K1-1",
    section: "Income",
    label: "Ordinary business income (K-1, Meridian Partners)",
    amount: 204500,
    state: "flagged",
    confidence: 0.94,
    editable: true,
    threadId: "thread-petrov-basis",
    flag: {
      byName: "Dana Whitfield",
      byRole: "reviewer",
      at: "2026-03-24T14:20:00",
      note: "The basis worksheet for the second partnership is missing. We can't confirm the loss is deductible without it — please request it before I approve.",
      resolution:
        "Basis worksheet received from the client and checked against the K-1; the loss is within basis.",
    },
    provenance: {
      kind: "document",
      documentId: "doc-petrov-k1",
      citation: "Schedule K-1 · Meridian Partners LP · Box 1 · page 1",
      page: 1,
      boxId: "k1_box1",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Read at 94%" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Verified Mar 22" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "flagged", note: "Flagged Mar 24" },
    ],
    history: [
      { at: "2026-03-14T11:20:00", actor: "AI", action: "extracted", detail: "Read $204,500 from K-1 Box 1", to: 204500 },
      { at: "2026-03-22T09:30:00", actor: "Jordan Reyes", action: "verified", detail: "Agreed to the partnership summary page" },
      { at: "2026-03-24T14:20:00", actor: "Dana Whitfield", action: "flagged", detail: "Missing basis worksheet for the second partnership" },
    ],
  },
  {
    id: "K1-19",
    section: "Income",
    label: "Distributions (K-1 Box 19)",
    amount: 180000,
    state: "verified",
    confidence: 0.93,
    editable: true,
    provenance: {
      kind: "document",
      documentId: "doc-petrov-k1",
      citation: "Schedule K-1 · Meridian Partners LP · Box 19",
      page: 2,
      boxId: "k1_box19",
    },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Read at 93%" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Verified" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "done", note: "Approved" },
    ],
    history: [],
  },
];


/* -------------------------------------------------------------------------- */
/* Volume inside a single return (challenge 09)                                */
/* -------------------------------------------------------------------------- */

/*
 * A real business return is not a dozen lines. Elena's 1120-S carries the kind
 * of bulk the brief describes — schedules of expenses, a stack of K-1s, dozens
 * of documents — because the claim that this interface stays navigable at depth
 * is only worth anything if there is something to navigate.
 *
 * Generated from a fixed seed rather than typed out: the point is the volume
 * and how the outline, filters and search behave against it, not the prose of
 * sixty individual expense captions.
 */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

const EXPENSE_CATEGORIES = [
  "Advertising", "Bank charges", "Client entertainment", "Cloud software",
  "Computer equipment", "Conference fees", "Contract labor", "Courier and postage",
  "Depreciation", "Dues and subscriptions", "Employee benefits", "Equipment rental",
  "Insurance — general liability", "Insurance — professional", "Interest on business loans",
  "Legal and professional", "Licenses and permits", "Marketing materials",
  "Meals — business travel", "Office supplies", "Payroll — administrative",
  "Payroll — design staff", "Payroll taxes", "Printing and reproduction",
  "Rent — studio", "Repairs and maintenance", "Retirement plan contributions",
  "Security services", "State franchise tax", "Studio utilities",
  "Subcontracted design", "Telephone and internet", "Training and development",
  "Travel — airfare", "Travel — lodging", "Vehicle expenses", "Waste removal",
  "Website hosting", "Workers compensation",
];

function generateBusinessLines(): ReturnLine[] {
  const rng = seeded(881122);
  const lines: ReturnLine[] = [];

  EXPENSE_CATEGORIES.forEach((label, i) => {
    const amount = Math.round((900 + rng() * 46_000) / 10) * 10;
    const roll = rng();
    // Most of a real return is quiet. Only a handful of lines earn attention,
    // which is exactly the ratio that makes the attention filter useful.
    // "edited" earns a slice of its own: it is the state that proves a person
    // can overrule the machine and that the original survives in the history.
    // Without one seeded instance it existed only if a reviewer happened to
    // edit something, which is a poor way to demonstrate a documented state.
    const state: ReturnLine["state"] =
      roll > 0.94
        ? "needs_review"
        : roll > 0.88
        ? "edited"
        : roll > 0.62
        ? "ai_extracted"
        : "verified";
    const confidence =
      state === "needs_review" ? 0.6 + rng() * 0.22 : 0.9 + rng() * 0.09;
    const docId = `doc-petrov-exp-${i}`;

    lines.push({
      id: `Sch-${20 + i}`,
      section: "Adjustments & deductions",
      label,
      amount,
      state,
      confidence,
      editable: true,
      provenance: {
        kind: "document",
        documentId: docId,
        citation: `Expense schedule · ${label} · line ${20 + i}`,
        page: 1 + Math.floor(i / 12),
        boxId: `exp_${i}_total`,
      },
      aiSuggestion:
        state === "needs_review"
          ? {
              value: amount,
              confidence,
              rationale:
                "Several receipts in this category were photographed together; the totals could not be separated with confidence.",
              corroboration: "Prior-year total for this category was within 15%.",
            }
          : undefined,
      pipeline: [
        { actor: "ai", actorName: "AI", status: state === "needs_review" ? "attention" : "done", note: `Read at ${Math.round(confidence * 100)}%` },
        {
          actor: "preparer",
          actorName: "Jordan Reyes",
          // An edited line is one the preparer has already acted on, so leaving
          // them "waiting" here contradicted the state beside it.
          status: state === "verified" || state === "edited" ? "done" : "waiting",
          note:
            state === "edited"
              ? "Corrected the AI's reading"
              : state === "verified"
              ? "Verified"
              : undefined,
        },
        { actor: "reviewer", actorName: "Dana Whitfield", status: "waiting" },
      ],
      /* The design system promises that an edited value keeps its original in
         the history. That has to be true, so an edited line carries the
         override it describes. Derived from `amount` rather than another
         rng() call, which would shift every later line in this seeded run. */
      history:
        state === "edited"
          ? [
              {
                at: "2026-03-22T11:15:00",
                actor: "Jordan Reyes",
                action: "edited" as const,
                detail: "Receipt total re-read by hand; the AI had picked up the pre-tax subtotal",
                from: Math.round((amount * 1.08) / 10) * 10,
                to: amount,
              },
              {
                at: "2026-03-20T09:02:00",
                actor: "AI",
                action: "extracted" as const,
                detail: `Read from the expense schedule at ${Math.round(confidence * 100)}%`,
                to: Math.round((amount * 1.08) / 10) * 10,
              },
            ]
          : [],
    });
  });

  return lines;
}

function generateBusinessDocuments(): SourceDocument[] {
  const rng = seeded(447733);
  return EXPENSE_CATEGORIES.map((label, i) => {
    const amount = Math.round((900 + rng() * 46_000) / 10) * 10;
    const low = rng() > 0.88;
    return {
      id: `doc-petrov-exp-${i}`,
      returnId: "ret-petrov-2025",
      type: "receipt" as const,
      title: `${label} — supporting receipts`,
      issuer: "Petrov Design Studio",
      taxYear: 2025,
      uploadedBy: "Elena Petrov",
      uploadedAt: "2026-03-14T11:20:00",
      pages: 1 + Math.floor(rng() * 5),
      scanQuality: low ? ("low" as const) : ("clean" as const),
      feedsLines: [`Sch-${20 + i}`],
      boxes: [
        { id: `exp_${i}_payee`, label: "Category", value: label },
        {
          id: `exp_${i}_total`,
          label: "Total for the year",
          value: `$${amount.toLocaleString("en-US")}.00`,
          confidence: low ? 0.68 : 0.96,
          uncertain: low,
          wide: true,
        },
      ],
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Readiness                                                                   */
/* -------------------------------------------------------------------------- */

import { FIELD_STATE } from "./design";

export function computeReadiness(lines: ReturnLine[], openItems: number) {
  const total = lines.length;
  const attention = lines.filter((l) => FIELD_STATE[l.state].needsAttention).length;
  const settled = total - attention;
  // A return is not "90% done" just because most lines are quiet — an open
  // request with a client is a hard blocker, so it costs more than a line.
  const raw = total === 0 ? 0 : (settled / total) * 100;
  const score = Math.max(0, Math.round(raw - openItems * 6));
  return {
    grade: gradeFromScore(score),
    score,
    linesSettled: settled,
    linesTotal: total,
    openItems,
  };
}

/* -------------------------------------------------------------------------- */
/* The hero returns                                                            */
/* -------------------------------------------------------------------------- */

/** The hand-authored K-1 lines plus the generated expense schedule. */
const PETROV_ALL_LINES: ReturnLine[] = [...PETROV_LINES, ...generateBusinessLines()];


/* -------------------------------------------------------------------------- */
/* Marcus's prior year — filed, and therefore frozen                           */
/* -------------------------------------------------------------------------- */

/*
 * Every other return in this prototype is mid-flight, which left one state in
 * the design system with nothing behind it: `locked`. A filed return is the
 * only honest way to show "what cannot be changed, and why" — the reason is
 * not a permission, it is that the document has already gone to the IRS and
 * the remedy is a different form entirely.
 *
 * It is Marcus's own prior year rather than a new client, because a firm keeps
 * last year's return next to this year's, and it gives the current return
 * something to be compared against.
 */
const RIVERA_2024_LINES: ReturnLine[] = [
  {
    id: "1a",
    section: "Income",
    label: "Wages, salaries, tips",
    amount: 78500,
    state: "locked",
    editable: false,
    lockReason:
      "Filed on 12 April 2025. A filed return cannot be edited — a change would have to go out as an amended return on Form 1040-X.",
    provenance: { kind: "document", documentId: "doc-rivera-2024-w2", citation: "W-2 · Box 1", page: 1, boxId: "w2_box1" },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Read from the W-2" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Checked against the source" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "done", note: "Approved for filing" },
    ],
    history: [
      { at: "2025-04-12T16:20:00", actor: "Dana Whitfield", action: "locked", detail: "Return filed with the IRS" },
    ],
  },
  {
    id: "2b",
    section: "Income",
    label: "Taxable interest",
    amount: 1395,
    state: "locked",
    editable: false,
    lockReason:
      "Filed on 12 April 2025. A filed return cannot be edited — a change would have to go out as an amended return on Form 1040-X.",
    provenance: { kind: "document", documentId: "doc-rivera-2024-1099int", citation: "1099-INT · Box 1", page: 1, boxId: "int_box1" },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Read from the 1099-INT" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Checked against the source" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "done", note: "Approved for filing" },
    ],
    history: [
      { at: "2025-04-12T16:20:00", actor: "Dana Whitfield", action: "locked", detail: "Return filed with the IRS" },
    ],
  },
  {
    id: "11",
    section: "Adjustments & deductions",
    label: "Adjusted gross income",
    amount: 79895,
    state: "locked",
    editable: false,
    lockReason:
      "Filed on 12 April 2025. A filed return cannot be edited — a change would have to go out as an amended return on Form 1040-X.",
    provenance: { kind: "calculation", formula: "Sum of total income", inputs: [{ lineId: "1a", label: "Wages", amount: 78500 }, { lineId: "2b", label: "Taxable interest", amount: 1395 }] },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Checked against the source" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "done", note: "Approved for filing" },
    ],
    history: [
      { at: "2025-04-12T16:20:00", actor: "Dana Whitfield", action: "locked", detail: "Return filed with the IRS" },
    ],
  },
  {
    id: "12",
    section: "Adjustments & deductions",
    label: "Standard deduction",
    amount: 14600,
    state: "locked",
    editable: false,
    lockReason:
      "Filed on 12 April 2025. A filed return cannot be edited — a change would have to go out as an amended return on Form 1040-X.",
    provenance: { kind: "rule", rule: "Standard deduction, single filer, 2024", detail: "Set by filing status. Not a figure anyone types." },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Applied the 2024 rule" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Checked against the source" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "done", note: "Approved for filing" },
    ],
    history: [
      { at: "2025-04-12T16:20:00", actor: "Dana Whitfield", action: "locked", detail: "Return filed with the IRS" },
    ],
  },
  {
    id: "15",
    section: "Adjustments & deductions",
    label: "Taxable income",
    amount: 65295,
    state: "locked",
    editable: false,
    lockReason:
      "Filed on 12 April 2025. A filed return cannot be edited — a change would have to go out as an amended return on Form 1040-X.",
    provenance: { kind: "calculation", formula: "AGI less the standard deduction", inputs: [{ lineId: "11", label: "Adjusted gross income", amount: 79895 }, { lineId: "12", label: "Standard deduction", amount: 14600 }] },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Checked against the source" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "done", note: "Approved for filing" },
    ],
    history: [
      { at: "2025-04-12T16:20:00", actor: "Dana Whitfield", action: "locked", detail: "Return filed with the IRS" },
    ],
  },
  {
    id: "34",
    section: "Refund",
    label: "Amount overpaid",
    amount: 1508,
    state: "locked",
    editable: false,
    lockReason:
      "Filed on 12 April 2025. A filed return cannot be edited — a change would have to go out as an amended return on Form 1040-X.",
    provenance: { kind: "calculation", formula: "Payments less total tax", inputs: [{ lineId: "25a", label: "Federal income tax withheld", amount: 11900 }, { lineId: "24", label: "Total tax", amount: 10392 }] },
    pipeline: [
      { actor: "ai", actorName: "AI", status: "done", note: "Computed" },
      { actor: "preparer", actorName: "Jordan Reyes", status: "done", note: "Checked against the source" },
      { actor: "reviewer", actorName: "Dana Whitfield", status: "done", note: "Approved for filing" },
    ],
    history: [
      { at: "2025-04-12T16:20:00", actor: "Dana Whitfield", action: "locked", detail: "Return filed with the IRS" },
    ],
  },
];

export const HERO_RETURNS: TaxReturn[] = [
  {
    id: "ret-rivera-2025",
    priorYearReturnId: "ret-rivera-2024",
    clientId: "u-marcus",
    clientName: "Marcus Rivera",
    formType: "1040",
    taxYear: 2025,
    stage: "in_preparation",
    blocked: {
      reason: "Waiting for Marcus to confirm the interest amount on his Chase 1099-INT",
      since: "2026-03-20T18:30:00",
      requestId: "req-rivera-interest",
    },
    preparerName: "Jordan Reyes",
    reviewerName: "Dana Whitfield",
    dueDate: "2026-04-15",
    lastActivity: "2026-03-21T16:05:00",
    lines: RIVERA_LINES,
    readiness: computeReadiness(RIVERA_LINES, 1),
    outcome: { kind: "refund", amount: 1333, provisional: true },
  },
  {
    id: "ret-chen-2025",
    clientId: "u-sarah",
    clientName: "Sarah Chen",
    formType: "1040",
    taxYear: 2025,
    stage: "in_preparation",
    preparerName: "Jordan Reyes",
    reviewerName: "Dana Whitfield",
    dueDate: "2026-04-15",
    lastActivity: "2026-03-25T07:40:00",
    lines: CHEN_LINES,
    readiness: computeReadiness(CHEN_LINES, 1),
    outcome: { kind: "refund", amount: 2140, provisional: true },
  },
  {
    id: "ret-rivera-2024",
    clientId: "u-marcus",
    clientName: "Marcus Rivera",
    formType: "1040",
    taxYear: 2024,
    stage: "filed",
    preparerName: "Jordan Reyes",
    reviewerName: "Dana Whitfield",
    dueDate: "2025-04-15",
    lastActivity: "2025-04-12T16:20:00",
    lines: RIVERA_2024_LINES,
    readiness: computeReadiness(RIVERA_2024_LINES, 0),
    outcome: { kind: "refund", amount: 1508, provisional: false },
  },
  /*
   * Jordan's own return, and the reason it exists is twofold.
   *
   * It is the firm employee who is also a client of the firm — the awkward
   * case the role architecture has to survive. And because he has only just
   * signed up, it is also the genuinely blank, day-one client account: no
   * documents, no lines, nothing to unlearn. The first-run experience needs a
   * real empty account to be honest, not a half-finished one.
   */
  {
    id: "ret-reyes-2025",
    clientId: "u-jordan",
    clientName: "Jordan Reyes",
    formType: "1040",
    taxYear: 2025,
    stage: "docs_pending",
    preparerName: "Rita Alvarez",
    reviewerName: "Dana Whitfield",
    dueDate: "2026-04-15",
    lastActivity: "2026-03-25T08:15:00",
    lines: [],
    readiness: { grade: "—", score: 0, linesSettled: 0, linesTotal: 0, openItems: 0 },
  },
  {
    id: "ret-petrov-2025",
    clientId: "u-elena",
    clientName: "Elena Petrov",
    formType: "1120-S",
    taxYear: 2025,
    stage: "in_review",
    preparerName: "Jordan Reyes",
    reviewerName: "Dana Whitfield",
    dueDate: "2026-04-15",
    lastActivity: "2026-03-24T14:20:00",
    lines: PETROV_ALL_LINES,
    readiness: computeReadiness(PETROV_ALL_LINES, 1),
    outcome: { kind: "owed", amount: 18400, provisional: true },
  },
];

/* -------------------------------------------------------------------------- */
/* Client-facing tasks (challenge 03)                                          */
/* -------------------------------------------------------------------------- */

export const CLIENT_TASKS: ClientTask[] = [
  {
    id: "task-chen-w2",
    returnId: "ret-chen-2025",
    title: "Upload your W-2",
    help: "The wage form your employer sent you in January. A clear photo is fine.",
    kind: "upload",
    status: "done",
    blocking: true,
    estimateMinutes: 2,
    completedAt: "2026-03-19T08:40:00",
  },
  {
    id: "task-chen-questions",
    returnId: "ret-chen-2025",
    title: "Answer 4 quick questions",
    help: "Dependents, address changes, and anything unusual about your year.",
    kind: "questionnaire",
    status: "done",
    blocking: true,
    estimateMinutes: 3,
    completedAt: "2026-03-25T07:40:00",
  },
  {
    id: "task-chen-1099",
    returnId: "ret-chen-2025",
    title: "Add any 1099 forms",
    help: "Bank interest, dividends, or freelance income. Skip this if you didn't get any.",
    kind: "upload",
    status: "done",
    blocking: false,
    optional: true,
    estimateMinutes: 2,
    completedAt: "2026-03-19T08:41:00",
  },
  /* The day-one account: nothing done yet, and one obvious place to start. */
  {
    id: "task-reyes-w2",
    returnId: "ret-reyes-2025",
    title: "Upload your W-2",
    help: "The wage form your employer sent you in January. A clear photo of it is fine.",
    kind: "upload",
    status: "todo",
    blocking: true,
    estimateMinutes: 2,
  },
  {
    id: "task-reyes-questions",
    returnId: "ret-reyes-2025",
    title: "Answer 4 quick questions",
    help: "Dependents, address changes, and anything unusual about your year.",
    kind: "questionnaire",
    status: "todo",
    blocking: true,
    estimateMinutes: 3,
  },
  {
    id: "task-reyes-1099",
    returnId: "ret-reyes-2025",
    title: "Add any 1099 forms",
    help: "Bank interest, dividends, or freelance income. Skip this if you didn't get any.",
    kind: "upload",
    status: "todo",
    blocking: false,
    optional: true,
    estimateMinutes: 2,
  },
  {
    id: "task-rivera-1099int",
    returnId: "ret-rivera-2025",
    title: "Confirm your Chase interest amount",
    help: "One digit on the form you sent is hard to read. Just tell us the number printed in Box 1.",
    kind: "review",
    status: "todo",
    blocking: true,
    estimateMinutes: 1,
  },
];

export function tasksFor(returnId: string): ClientTask[] {
  return CLIENT_TASKS.filter((t) => t.returnId === returnId);
}

/* -------------------------------------------------------------------------- */
/* Conversations (challenge 02)                                                */
/* -------------------------------------------------------------------------- */

export const THREADS: Thread[] = [
  {
    id: "thread-rivera-interest",
    returnId: "ret-rivera-2025",
    anchor: { kind: "line", id: "2b", label: "Line 2b · Taxable interest" },
    items: [
      {
        kind: "system",
        id: "s0",
        body: "Engagement letter signed. Marcus's 2025 return opened.",
        at: "2026-02-02T09:05:00",
      },
      {
        kind: "message",
        id: "m0",
        author: "Jordan Reyes",
        authorRole: "preparer",
        visibility: "client",
        body: "Hi Marcus — good to be working on this again. Same as last year: send whatever arrives in the post and I'll tell you what I actually need. No rush yet, but the sooner it's in the sooner we know where you stand.",
        at: "2026-02-02T09:20:00",
      },
      {
        kind: "message",
        id: "m0b",
        author: "Marcus Rivera",
        authorRole: "client",
        visibility: "client",
        body: "Sounds good. I've moved to freelance for part of the year so there might be an extra form or two this time.",
        at: "2026-02-02T21:14:00",
      },
      {
        kind: "message",
        id: "m0c",
        author: "Jordan Reyes",
        authorRole: "preparer",
        visibility: "internal",
        body: "New freelance income this year — watch for a 1099-NEC and check whether QBI applies. Last year was W-2 only.",
        at: "2026-02-02T21:40:00",
      },
      {
        kind: "system",
        id: "s0b",
        body: "W-2.pdf and 1099-NEC.pdf received from Marcus Rivera.",
        at: "2026-03-08T14:22:00",
        refId: "doc-rivera-w2",
      },
      {
        kind: "message",
        id: "m1",
        author: "Jordan Reyes",
        authorRole: "preparer",
        visibility: "client",
        body: "Both came through clean and they're already on the return. One more form and we're set.",
        at: "2026-03-08T15:00:00",
      },
      {
        kind: "request",
        id: "req-rivera-1099",
        title: "Upload your 1099-INT from Chase",
        detail: "The interest statement your bank sent in January.",
        status: "resolved",
        owner: "none",
        askedBy: "Jordan Reyes",
        askedAt: "2026-03-08T15:00:00",
        resolvedAt: "2026-03-20T18:02:00",
        anchor: { kind: "line", id: "2b", label: "Line 2b · Taxable interest" },
      },
      {
        kind: "message",
        id: "m2",
        author: "Jordan Reyes",
        authorRole: "preparer",
        visibility: "internal",
        body: "Prior year had $1,395 interest from Chase — if he says he has no 1099-INT, push back gently. It'll exist.",
        at: "2026-03-09T09:15:00",
      },
      {
        kind: "message",
        id: "m2b",
        author: "Marcus Rivera",
        authorRole: "client",
        visibility: "client",
        body: "I don't think Chase sent me anything this year?",
        at: "2026-03-16T19:48:00",
      },
      {
        kind: "message",
        id: "m2c",
        author: "Jordan Reyes",
        authorRole: "preparer",
        visibility: "client",
        body: "They almost certainly did — you had interest from them last year, and they post it in the statements section of online banking rather than mailing it. Worth a look under Tax Documents.",
        at: "2026-03-17T08:30:00",
      },
      {
        kind: "message",
        id: "m3",
        author: "Marcus Rivera",
        authorRole: "client",
        visibility: "client",
        body: "Found it! Uploading from my phone — sorry for the wait.",
        at: "2026-03-20T18:00:00",
      },
      {
        kind: "system",
        id: "s1",
        body: "1099-INT.pdf received. The AI read it, but one value needs a human eye.",
        at: "2026-03-20T18:05:00",
        refId: "doc-rivera-1099int",
      },
      {
        kind: "request",
        id: "req-rivera-interest",
        title: "Quick check: is the interest amount $1,432?",
        detail:
          "One digit on the scan is covered by glare. If you can read the number in Box 1, that settles it.",
        status: "waiting",
        owner: "client",
        askedBy: "Jordan Reyes",
        askedAt: "2026-03-20T18:30:00",
        anchor: { kind: "line", id: "2b", label: "Line 2b · Taxable interest" },
        quickReplies: ["Yes, it's $1,432", "No — let me type it"],
        resolution: {
          writesToLine: "2b",
          value: "$1,432",
          note: "Confirmed by the client against the paper form.",
        },
      },
    ],
  },
  {
    id: "thread-rivera-qbi",
    returnId: "ret-rivera-2025",
    anchor: { kind: "line", id: "13", label: "Line 13 · QBI deduction" },
    items: [
      {
        kind: "message",
        id: "m4",
        author: "Dana Whitfield",
        authorRole: "reviewer",
        visibility: "internal",
        body: "@Jordan flagging line 13 — he's at $81k taxable so the SSTB limits don't reach him, that part's fine. What I need before this stands is that the $12,000 is actually a trade or business and not one payment that happened to land on a 1099-NEC.",
        at: "2026-03-21T16:05:00",
        mentions: ["Jordan Reyes"],
      },
      {
        kind: "message",
        id: "m5",
        author: "Jordan Reyes",
        authorRole: "preparer",
        visibility: "internal",
        body: "Pulling his engagement letters. If he consulted through the year on recurring work it's a trade or business and it stands; if it was one project that fell in his lap, the deduction comes off.",
        at: "2026-03-21T17:10:00",
      },
      {
        kind: "message",
        id: "m5b",
        author: "Dana Whitfield",
        authorRole: "reviewer",
        visibility: "internal",
        body: "Agreed. Don't file it either way until we've written the reasoning down — this is the kind of thing that gets asked about three years later.",
        at: "2026-03-21T17:26:00",
      },
    ],
  },
  {
    id: "thread-chen-charity",
    returnId: "ret-chen-2025",
    anchor: { kind: "line", id: "12b", label: "Line 12b · Charitable contributions" },
    items: [
      {
        kind: "system",
        id: "cs0",
        body: "Sarah Chen's 2025 return opened. Documents requested.",
        at: "2026-03-02T10:00:00",
      },
      {
        kind: "message",
        id: "cm0",
        author: "Jordan Reyes",
        authorRole: "preparer",
        visibility: "client",
        body: "Hi Sarah — welcome aboard. Three things to start: your W-2, any 1099s, and four quick questions in your checklist. Everything else I'll ask for as it comes up.",
        at: "2026-03-02T10:05:00",
      },
      {
        kind: "system",
        id: "cs1",
        body: "W-2.pdf, 1099-DIV.pdf and a donation receipt received from Sarah Chen.",
        at: "2026-03-19T08:44:00",
        refId: "doc-chen-w2",
      },
      {
        kind: "message",
        id: "m6",
        author: "Jordan Reyes",
        authorRole: "preparer",
        visibility: "internal",
        body: "Handwritten receipt, no bank record. We should ask for the card statement before this goes on the return.",
        at: "2026-03-19T10:00:00",
      },
      {
        kind: "message",
        id: "m6b",
        author: "Dana Whitfield",
        authorRole: "reviewer",
        visibility: "internal",
        body: "Agreed — a handwritten receipt on its own is thin at that amount. Worth the awkward email now rather than later.",
        at: "2026-03-19T10:18:00",
      },
      {
        kind: "request",
        id: "req-chen-charity",
        title: "Do you have a bank or card record for the $2,340 donation?",
        detail:
          "The receipt is handwritten, so a matching statement line keeps the deduction safe if it's ever questioned.",
        status: "waiting",
        owner: "client",
        askedBy: "Jordan Reyes",
        askedAt: "2026-03-19T10:05:00",
        anchor: { kind: "line", id: "12b", label: "Line 12b · Charitable contributions" },
        quickReplies: ["I'll upload it", "I paid cash"],
      },
    ],
  },
  {
    id: "thread-chen-dependent",
    returnId: "ret-chen-2025",
    anchor: { kind: "question", id: "q-chen-3", label: "Questionnaire · Q3 dependents" },
    items: [
      /* The question Sarah is answering came from the onboarding questionnaire,
         not from a person typing in this thread — so without it rendered here,
         the transcript opened with an answer to nothing. The anchor above is
         only a chip; it is not a conversational turn. Carrying the question in
         as a system line is also the honest version of what happened, and it
         shows a questionnaire answer landing in the same thread as chat. */
      {
        kind: "system",
        id: "m7-q",
        body: "Questionnaire, Q3: “Did anyone new join your household in 2025 — a birth, an adoption, or someone moving in?”",
        at: "2026-03-25T07:39:00",
      },
      {
        kind: "message",
        id: "m7",
        author: "Sarah Chen",
        authorRole: "client",
        visibility: "client",
        body: "Yes — my daughter was born in March! Let me know if you need her details.",
        at: "2026-03-25T07:40:00",
      },
      {
        kind: "request",
        id: "req-chen-dependent",
        title: "New dependent reported — add to the return",
        detail: "Sarah's answer to Q3 changes the child tax credit on line 19.",
        status: "answered",
        owner: "preparer",
        askedBy: "System",
        askedAt: "2026-03-25T07:41:00",
        anchor: { kind: "line", id: "19", label: "Line 19 · Child tax credit" },
        resolution: {
          writesToLine: "19",
          value: "$2,000",
          note: "Child tax credit for one qualifying dependent.",
        },
      },
    ],
  },
  {
    id: "thread-reyes-welcome",
    returnId: "ret-reyes-2025",
    items: [
      {
        kind: "message",
        id: "m-welcome",
        author: "Rita Alvarez",
        authorRole: "preparer",
        visibility: "client",
        body: "Hi Jordan — I'll be preparing your return this year. Send over your W-2 whenever you have it and I'll take it from there. If anything looks unclear, just ask me here.",
        at: "2026-03-25T08:15:00",
      },
    ],
  },
  {
    id: "thread-petrov-basis",
    returnId: "ret-petrov-2025",
    anchor: { kind: "line", id: "K1-1", label: "K-1 Box 1 · Ordinary business income" },
    items: [
      {
        kind: "system",
        id: "ps0",
        body: "Petrov Design Studio 1120-S opened. Prior-year return and books received.",
        at: "2026-02-11T09:00:00",
      },
      {
        kind: "message",
        id: "pm0",
        author: "Jordan Reyes",
        authorRole: "preparer",
        visibility: "client",
        body: "Hi Elena — books look tidy this year, thank you. I'll work through the expense schedule and come back with anything that needs a second look.",
        at: "2026-02-11T09:30:00",
      },
      {
        kind: "message",
        id: "pm1",
        author: "Elena Petrov",
        authorRole: "client",
        visibility: "client",
        body: "Great. The two partnerships are the messy part — Meridian sent their K-1 late again.",
        at: "2026-02-11T14:02:00",
      },
      {
        kind: "system",
        id: "ps1",
        body: "Schedule K-1 (Meridian Partners LP) received · 3 pages.",
        at: "2026-03-14T11:15:00",
        refId: "doc-petrov-k1",
      },
      {
        kind: "message",
        id: "m8",
        author: "Dana Whitfield",
        authorRole: "reviewer",
        visibility: "internal",
        body: "@Jordan the basis worksheet for the second partnership is missing. I can't approve the loss without it.",
        at: "2026-03-24T14:20:00",
        mentions: ["Jordan Reyes"],
      },
      {
        kind: "request",
        id: "req-petrov-basis",
        title: "Request the 2025 basis worksheet",
        detail: "Needed for the second partnership before the loss can be confirmed as deductible.",
        status: "asked",
        owner: "preparer",
        askedBy: "Dana Whitfield",
        askedAt: "2026-03-24T14:22:00",
        anchor: { kind: "line", id: "K1-1", label: "K-1 Box 1" },
      },
    ],
  },
];


export function threadsFor(returnId: string): Thread[] {
  return THREADS.filter((t) => t.returnId === returnId);
}

export function threadById(id: string): Thread | undefined {
  return THREADS.find((t) => t.id === id);
}

/** Open requests across a return — what "outstanding items" actually counts. */
export function openRequestsFor(returnId: string) {
  return threadsFor(returnId)
    .flatMap((t) => t.items.map((i) => ({ item: i, threadId: t.id })))
    .filter(
      (x) =>
        x.item.kind === "request" &&
        x.item.status !== "resolved"
    );
}
