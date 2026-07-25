/* ---------------------------------------------------------------------------
   The domain model for Tax Hub.

   Two ideas drive the whole shape of this file:

   1. A number on a tax return is worthless without its provenance. Every
      `ReturnLine` therefore carries a `Provenance` explaining where the value
      came from — a document box, a client's answer, a calculation, a tax rule,
      or a deliberate absence.

   2. The uploaded document is immutable. Values are never mutated in place;
      each change appends an `AuditEntry`. The audit trail is not a feature
      bolted on for show — it is the storage model, which is what makes undo,
      review, and trust possible.
--------------------------------------------------------------------------- */

/*
 * The six the platform serves. Individual taxpayers and business owners are
 * both clients of the firm, but they see different products — one has a W-2,
 * the other has entities, K-1s and a schedule of expenses — so they are
 * separate roles rather than one "client" with a flag on it.
 *
 * Seasonal staff are the interesting case: a preparer whose authority stops
 * short of filing. That restriction is what makes the role architecture prove
 * itself, because a limit has to be communicated without an error message.
 */
export type Role =
  | "client"
  | "business_owner"
  | "preparer"
  | "seasonal"
  | "reviewer"
  | "admin";

/** Who a piece of work is waiting on. Drives status, dashboard, and requests. */
export type Owner = "client" | "preparer" | "reviewer" | "system" | "none";

/* -------------------------------------------------------------------------- */
/* Field states — the interaction/affordance system (challenge 08)             */
/* -------------------------------------------------------------------------- */

export type FieldState =
  /** AI filled this in with high confidence; no human has confirmed it yet. */
  | "ai_extracted"
  /** AI is unsure, or its read disagrees with the return. Needs a human. */
  | "needs_review"
  /** A human checked it against the source and confirmed it. */
  | "verified"
  /** A human overrode the AI's value. */
  | "edited"
  /** Computed from other lines. Not directly editable, by design. */
  | "calculated"
  /** Set by a tax rule (e.g. standard deduction from filing status). */
  | "rule"
  /** A person raised a question on it and is holding it. */
  | "flagged"
  /** The return is filed; nothing can change. */
  | "locked"
  /** Deliberately blank, with a reason. */
  | "empty";

/* -------------------------------------------------------------------------- */
/* Provenance — traceability (challenge 01)                                    */
/* -------------------------------------------------------------------------- */

export type Provenance =
  | {
      kind: "document";
      documentId: string;
      /** Human-readable citation, e.g. "W-2 · Acme Corp · Box 1 · page 1". */
      citation: string;
      page: number;
      /** The specific box on that document this value was read from. */
      boxId: string;
      /** Any arithmetic applied between the document and the return line. */
      transformation?: string;
    }
  | {
      kind: "answer";
      questionId: string;
      question: string;
      answer: string;
      answeredBy: string;
      answeredAt: string;
    }
  | {
      kind: "calculation";
      formula: string;
      inputs: { lineId: string; label: string; amount: number }[];
    }
  | {
      kind: "rule";
      rule: string;
      detail: string;
    }
  | {
      kind: "none";
      /** Why this line is legitimately blank. An empty line still has a story. */
      reason: string;
    };

/* -------------------------------------------------------------------------- */
/* Pipeline + audit — who touched a value, and every change ever made          */
/* -------------------------------------------------------------------------- */

export type PipelineActor = "ai" | "preparer" | "reviewer";
export type PipelineStatus = "done" | "attention" | "waiting" | "flagged";

export interface PipelineStep {
  actor: PipelineActor;
  /** Display name, e.g. "Jordan Reyes". "AI" for the model. */
  actorName: string;
  status: PipelineStatus;
  note?: string;
  at?: string;
}

export type AuditAction =
  | "extracted"
  | "verified"
  | "edited"
  | "flagged"
  | "resolved"
  | "recalculated"
  | "requested"
  | "answered"
  | "locked";

export interface AuditEntry {
  at: string;
  actor: string;
  action: AuditAction;
  detail: string;
  from?: number | string | null;
  to?: number | string | null;
}

/* -------------------------------------------------------------------------- */
/* Return lines                                                                */
/* -------------------------------------------------------------------------- */

export interface ReturnLine {
  /** IRS line number, e.g. "1a", "2b", "15". Not a synthetic id. */
  id: string;
  section: ReturnSection;
  label: string;
  /** Null means the line is intentionally blank. */
  amount: number | null;
  state: FieldState;
  /** 0–1. Present only where an AI produced the value. */
  confidence?: number;
  provenance: Provenance;
  pipeline: PipelineStep[];
  history: AuditEntry[];
  /** Whether a preparer may type into it. Calculated lines are false. */
  editable: boolean;
  /** Why it can't be edited — shown instead of a dead control. */
  lockReason?: string;
  /**
   * What the AI thinks the value should be, when that differs from the return
   * or when confidence is low. This is what a reviewer is asked to confirm.
   */
  aiSuggestion?: {
    value: number;
    confidence: number;
    rationale: string;
    corroboration?: string;
  };
  /** A person's question holding this line (challenge 10's human-in-the-loop). */
  flag?: {
    byName: string;
    byRole: Role;
    at: string;
    note: string;
    /** What resolving this specific flag should record in the audit trail. */
    resolution?: string;
  };
  /** Link to the conversation about this number (challenge 04). */
  threadId?: string;
  /** Lines this one feeds into, so an edit can show its downstream effect. */
  feedsInto?: string[];
}

export type ReturnSection =
  | "Income"
  | "Adjustments & deductions"
  | "Tax & payments"
  | "Refund";

export const RETURN_SECTIONS: ReturnSection[] = [
  "Income",
  "Adjustments & deductions",
  "Tax & payments",
  "Refund",
];

/* -------------------------------------------------------------------------- */
/* Status model (challenge 06) — one pipeline, two vocabularies                */
/* -------------------------------------------------------------------------- */

export type Stage =
  | "docs_pending"
  | "extracting"
  | "in_preparation"
  | "in_review"
  | "ready_to_file"
  | "filed";

export interface StageMeta {
  /** What firm staff call it. */
  staff: string;
  /** What the client reads. Same truth, plain language. */
  client: string;
  /** Whose move it is at this stage. */
  owner: Owner;
  /** Position in the journey, for progress display. */
  index: number;
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

export type DocumentType =
  | "W-2"
  | "1099-INT"
  | "1099-NEC"
  | "1099-DIV"
  | "1099-B"
  | "K-1"
  | "1098"
  | "receipt"
  | "statement"
  | "other";

export interface DocumentBox {
  /** e.g. "w2_box1" — referenced by a line's provenance. */
  id: string;
  label: string;
  value: string;
  /** AI read confidence for this specific box. */
  confidence?: number;
  /** True when the AI could not read it cleanly. Renders amber on the doc. */
  uncertain?: boolean;
  /** Spans both columns when rendering the fake document. */
  wide?: boolean;
}

export interface SourceDocument {
  id: string;
  returnId: string;
  type: DocumentType;
  title: string;
  issuer: string;
  taxYear: number;
  uploadedBy: string;
  uploadedAt: string;
  pages: number;
  scanQuality: "clean" | "low";
  boxes: DocumentBox[];
  /** Return lines this document feeds — the reverse of provenance. */
  feedsLines: string[];
  /** Set when the AI flagged something about the document as a whole. */
  notice?: string;
}

/* -------------------------------------------------------------------------- */
/* Collaboration (challenge 02)                                                */
/* -------------------------------------------------------------------------- */

export type Visibility = "client" | "internal";

export type RequestStatus = "asked" | "waiting" | "answered" | "resolved";

export interface ThreadAnchor {
  kind: "line" | "document" | "question";
  id: string;
  label: string;
}

export type ThreadItem =
  | {
      kind: "message";
      id: string;
      author: string;
      authorRole: Role;
      visibility: Visibility;
      body: string;
      at: string;
      mentions?: string[];
    }
  | {
      kind: "request";
      id: string;
      title: string;
      detail: string;
      status: RequestStatus;
      /** Whose move it is right now. */
      owner: Owner;
      askedBy: string;
      askedAt: string;
      anchor?: ThreadAnchor;
      resolvedAt?: string;
      /** What answering it does to the return — the payoff of a request. */
      resolution?: {
        writesToLine: string;
        value: string;
        note: string;
      };
      /** Client-facing quick replies, so answering is one tap. */
      quickReplies?: string[];
    }
  | {
      kind: "system";
      id: string;
      body: string;
      at: string;
      /** e.g. a document id the event refers to. */
      refId?: string;
    };

export interface Thread {
  id: string;
  returnId: string;
  anchor?: ThreadAnchor;
  items: ThreadItem[];
}

/* -------------------------------------------------------------------------- */
/* Client-side tasks (challenge 03)                                            */
/* -------------------------------------------------------------------------- */

export interface ClientTask {
  id: string;
  returnId: string;
  title: string;
  /** Plain-language explanation. No jargon, no form numbers alone. */
  help: string;
  kind: "upload" | "questionnaire" | "esign" | "review";
  status: "todo" | "done";
  /** True when nothing else can proceed until this is done. */
  blocking: boolean;
  optional?: boolean;
  estimateMinutes?: number;
  completedAt?: string;
}

export interface QuestionnaireItem {
  id: string;
  question: string;
  answer: string | null;
  answeredBy?: string;
  answeredAt?: string;
  /** Return lines this answer justifies. */
  affectsLines?: string[];
}

/* -------------------------------------------------------------------------- */
/* Returns                                                                     */
/* -------------------------------------------------------------------------- */

export type FormType = "1040" | "1120-S" | "1065" | "1120";

export interface Readiness {
  /** A→F. A single glance answer to "can this go out?" */
  grade: string;
  /** 0–100. */
  score: number;
  linesSettled: number;
  linesTotal: number;
  openItems: number;
}

export interface TaxReturn {
  id: string;
  clientId: string;
  clientName: string;
  formType: FormType;
  taxYear: number;
  stage: Stage;
  /** Present when the return cannot move — the reason a client must resolve. */
  blocked?: {
    reason: string;
    since: string;
    requestId?: string;
  };
  preparerName: string;
  reviewerName: string;
  dueDate: string;
  lastActivity: string;
  lines: ReturnLine[];
  readiness: Readiness;
  /** Estimated refund/owed, for the client-facing summary. */
  outcome?: {
    kind: "refund" | "owed";
    amount: number;
    provisional: boolean;
  };
}

/** The lightweight shape used in lists and dashboards, for hundreds of rows. */
export interface ReturnSummary {
  id: string;
  clientName: string;
  formType: FormType;
  taxYear: number;
  stage: Stage;
  owner: Owner;
  preparerName: string;
  reviewerName: string;
  dueDate: string;
  lastActivity: string;
  readinessGrade: string;
  readinessScore: number;
  openItems: number;
  blockedDays?: number;
  blockedReason?: string;
  /** Computed rank for "what should I work on right now" (challenge 07). */
  priority: number;
  priorityReason: string;
}

/* -------------------------------------------------------------------------- */
/* People                                                                      */
/* -------------------------------------------------------------------------- */

export interface Person {
  id: string;
  name: string;
  role: Role;
  initials: string;
  /** A firm employee who is also a client of the firm (challenge 05). */
  alsoClientOfReturnId?: string;
  title?: string;
}
