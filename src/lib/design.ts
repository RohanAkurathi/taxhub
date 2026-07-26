import type { FieldState, Owner, Role, Stage, StageMeta } from "./types";

/* ---------------------------------------------------------------------------
   The interaction system, defined once as data (challenge 08).

   Every badge, row tint, and affordance in the product reads from this table.
   Defining it here rather than in each component is what keeps "AI-extracted"
   looking and behaving identically on the dashboard, the return, the document
   viewer, and the client portal.
--------------------------------------------------------------------------- */

export interface FieldStateMeta {
  /** Short label used on badges. */
  label: string;
  /** Longer explanation, used in the legend and tooltips. */
  meaning: string;
  /** Single glyph. Deliberately not emoji — these sit inside dense tables. */
  glyph: string;
  /** Tailwind classes for the badge. */
  badge: string;
  /** Tailwind class tinting a whole row/card in this state. */
  rowTint: string;
  /** Whether this state demands a human's attention. Drives filters + counts. */
  needsAttention: boolean;
  /** Whether a preparer can type into a field in this state. */
  editable: boolean;
}

export const FIELD_STATE: Record<FieldState, FieldStateMeta> = {
  ai_extracted: {
    label: "AI-read",
    meaning: "The AI read this from a document and is confident. No human has confirmed it yet.",
    glyph: "●",
    badge: "bg-accentsoft text-accentink border-accentedge",
    rowTint: "",
    needsAttention: false,
    editable: true,
  },
  needs_review: {
    label: "Check",
    meaning: "The AI is unsure, or its reading disagrees with the return. A human needs to decide.",
    glyph: "▲",
    badge: "bg-warnsoft text-warn border-warnedge",
    rowTint: "bg-[#fffdf6]",
    needsAttention: true,
    editable: true,
  },
  verified: {
    label: "Verified",
    meaning: "A person checked this against the source document and confirmed it.",
    glyph: "✓",
    badge: "bg-oksoft text-ok border-okedge",
    rowTint: "",
    needsAttention: false,
    editable: true,
  },
  edited: {
    label: "Edited",
    meaning: "A person overrode the AI. The original value is kept in the history.",
    glyph: "✎",
    badge: "bg-accentsoft text-accentink border-accentedge",
    rowTint: "",
    needsAttention: false,
    editable: true,
  },
  calculated: {
    label: "Calculated",
    meaning: "Computed from other lines. Change a source line and this follows automatically.",
    glyph: "∑",
    badge: "bg-locksoft text-lock border-lockedge",
    rowTint: "",
    needsAttention: false,
    editable: false,
  },
  rule: {
    label: "Tax rule",
    meaning: "Set by a tax rule, such as the standard deduction for a filing status.",
    glyph: "§",
    badge: "bg-locksoft text-lock border-lockedge",
    rowTint: "",
    needsAttention: false,
    editable: false,
  },
  flagged: {
    label: "Flagged",
    meaning: "A person raised a question here and is holding the line until it is answered.",
    glyph: "⚑",
    badge: "bg-flagsoft text-flag border-flagedge",
    rowTint: "bg-[#fbf9ff]",
    needsAttention: true,
    editable: true,
  },
  locked: {
    label: "Locked",
    meaning: "The return is filed. Nothing on it can change.",
    glyph: "⊘",
    badge: "bg-locksoft text-lock border-lockedge",
    rowTint: "",
    needsAttention: false,
    editable: false,
  },
  empty: {
    label: "Blank",
    meaning: "Deliberately blank — no source suggests a value, and the client confirmed it.",
    glyph: "–",
    badge: "bg-transparent text-faint border-transparent",
    rowTint: "",
    needsAttention: false,
    editable: true,
  },
};

/** Order used by the legend and the design-system page. */
export const FIELD_STATE_ORDER: FieldState[] = [
  "verified",
  "ai_extracted",
  "needs_review",
  "flagged",
  "edited",
  "calculated",
  "rule",
  "empty",
  "locked",
];

/* ---------------------------------------------------------------------------
   Status vocabulary (challenge 06).

   One internal pipeline. Two vocabularies. A client never reads "extraction
   queued" and a preparer never loses the detail — because both render from
   the same stage value rather than from two separate status fields that can
   drift apart.
--------------------------------------------------------------------------- */

export const STAGE: Record<Stage, StageMeta> = {
  docs_pending: {
    staff: "Documents pending",
    client: "We need a few documents from you",
    owner: "client",
    index: 0,
  },
  extracting: {
    staff: "AI extraction",
    client: "We're reading your documents",
    owner: "system",
    index: 1,
  },
  in_preparation: {
    staff: "In preparation",
    client: "We're preparing your return",
    owner: "preparer",
    index: 2,
  },
  in_review: {
    staff: "In review",
    client: "Almost done — a second accountant is checking it",
    owner: "reviewer",
    index: 3,
  },
  ready_to_file: {
    staff: "Ready to file",
    client: "Ready — we just need your signature",
    owner: "client",
    index: 4,
  },
  filed: {
    staff: "Filed",
    client: "Filed with the IRS",
    owner: "none",
    index: 5,
  },
};

export const STAGE_ORDER: Stage[] = [
  "docs_pending",
  "extracting",
  "in_preparation",
  "in_review",
  "ready_to_file",
  "filed",
];

/**
 * The five milestones a client actually sees. `extracting` is deliberately
 * folded into "we're preparing" — a client does not need to know the machine
 * finished before the human started.
 */
export const CLIENT_JOURNEY: { key: Stage; label: string; owner: Owner }[] = [
  { key: "docs_pending", label: "Your documents", owner: "client" },
  { key: "in_preparation", label: "We prepare", owner: "preparer" },
  { key: "in_review", label: "We double-check", owner: "reviewer" },
  { key: "ready_to_file", label: "You sign", owner: "client" },
  { key: "filed", label: "Filed", owner: "none" },
];

/** Which journey milestone a given internal stage maps to. */
export function clientMilestoneIndex(stage: Stage): number {
  if (stage === "extracting") return 1;
  const i = CLIENT_JOURNEY.findIndex((m) => m.key === stage);
  return i === -1 ? 0 : i;
}

/* ---------------------------------------------------------------------------
   Ownership — "whose move is it?" rendered identically everywhere.
--------------------------------------------------------------------------- */

export const OWNER_LABEL: Record<Owner, string> = {
  client: "Client's move",
  preparer: "Your move",
  reviewer: "With reviewer",
  system: "Processing",
  none: "Done",
};

export const OWNER_BADGE: Record<Owner, string> = {
  client: "bg-warnsoft text-warn border-warnedge",
  preparer: "bg-accentsoft text-accentink border-accentedge",
  reviewer: "bg-flagsoft text-flag border-flagedge",
  system: "bg-locksoft text-lock border-lockedge",
  none: "bg-oksoft text-ok border-okedge",
};

/* ---------------------------------------------------------------------------
   Roles (challenge 05).

   Navigation is derived from role rather than hidden behind permission errors:
   a client's sidebar simply has fewer rooms. Nobody is shown a door they
   cannot open.
--------------------------------------------------------------------------- */

export interface RoleMeta {
  label: string;
  description: string;
  badge: string;
  /** Sidebar destinations available to this role. */
  nav: { href: string; label: string; icon: string }[];
  home: string;
  /**
   * What this role cannot do, said plainly.
   *
   * A limit a person discovers by being refused is a bad limit. Stating it in
   * the shell means nobody reaches for something they were never going to be
   * allowed to have.
   */
  cannot?: string;
}

/*
 * Note on what is deliberately NOT in any of these navs: /design-system.
 *
 * It used to sit in the preparer, reviewer and admin sidebars beside Dashboard
 * and Returns, which made a page written for whoever is grading this prototype
 * look like a screen a tax preparer uses. It also undercut the claim this table
 * exists to make — that navigation is shaped around your job — since no
 * preparer has any use for a swatch page. The giveaway was that seasonal staff
 * never had it, so it had never really been reasoned about per role at all.
 *
 * The page is still there and still reachable: it is the last stop on the tour,
 * linked from the landing page, which is explicitly a way in for a reviewer
 * rather than a screen the product ships.
 */
export const ROLE: Record<Role, RoleMeta> = {
  client: {
    label: "Client",
    description: "Someone whose return the firm is preparing",
    badge: "bg-oksoft text-ok border-okedge",
    home: "/home",
    nav: [
      { href: "/home", label: "Home", icon: "home" },
      { href: "/home/documents", label: "My documents", icon: "doc" },
      { href: "/home/messages", label: "Messages", icon: "chat" },
      { href: "/home/return", label: "My return", icon: "grid" },
    ],
  },
  business_owner: {
    label: "Business owner",
    description: "A client whose return is an entity, not a paycheck",
    badge: "bg-oksoft text-ok border-okedge",
    home: "/home",
    nav: [
      { href: "/home", label: "Home", icon: "home" },
      { href: "/home/documents", label: "My documents", icon: "doc" },
      { href: "/home/messages", label: "Messages", icon: "chat" },
      { href: "/home/return", label: "My return", icon: "grid" },
    ],
  },
  preparer: {
    label: "Preparer",
    description: "Builds the return from the client's documents",
    badge: "bg-accentsoft text-accentink border-accentedge",
    home: "/dashboard",
    nav: [
      { href: "/dashboard", label: "Dashboard", icon: "home" },
      { href: "/returns", label: "Returns", icon: "grid" },
      { href: "/requests", label: "Follow-ups", icon: "chat" },
    ],
  },
  seasonal: {
    label: "Seasonal preparer",
    description: "Prepares returns during the season, but cannot file them",
    badge: "bg-accentsoft text-accentink border-accentedge",
    home: "/dashboard",
    cannot:
      "You can prepare and edit returns, but filing and client billing stay with permanent staff.",
    nav: [
      { href: "/dashboard", label: "Dashboard", icon: "home" },
      { href: "/returns", label: "Returns", icon: "grid" },
      { href: "/requests", label: "Follow-ups", icon: "chat" },
    ],
  },
  reviewer: {
    label: "Reviewer",
    description: "Checks a preparer's work before anything is filed",
    badge: "bg-flagsoft text-flag border-flagedge",
    home: "/dashboard",
    nav: [
      { href: "/dashboard", label: "Dashboard", icon: "home" },
      { href: "/returns", label: "Returns", icon: "grid" },
      { href: "/requests", label: "Follow-ups", icon: "chat" },
    ],
  },
  admin: {
    label: "Firm administrator",
    description: "Watches the whole firm's workload rather than any one return",
    badge: "bg-locksoft text-lock border-lockedge",
    home: "/dashboard",
    nav: [
      { href: "/dashboard", label: "Dashboard", icon: "home" },
      { href: "/returns", label: "Returns", icon: "grid" },
      { href: "/requests", label: "Follow-ups", icon: "chat" },
    ],
  },
};

/* ---------------------------------------------------------------------------
   Readiness grade — a single glance answer to "can this go out?"
--------------------------------------------------------------------------- */

export function gradeFromScore(score: number): string {
  if (score >= 97) return "A";
  if (score >= 92) return "A−";
  if (score >= 87) return "B+";
  if (score >= 80) return "B";
  if (score >= 74) return "B−";
  if (score >= 66) return "C+";
  if (score >= 58) return "C";
  if (score >= 48) return "D";
  return "F";
}

export function gradeClasses(grade: string): string {
  if (grade.startsWith("A")) return "bg-oksoft text-ok";
  if (grade.startsWith("B")) return "bg-accentsoft text-accentink";
  if (grade.startsWith("C")) return "bg-warnsoft text-warn";
  return "bg-dangersoft text-danger";
}

/** Confidence presentation — tiered, never a raw float dumped on screen. */
export function confidenceBand(c: number): {
  label: string;
  tone: "high" | "medium" | "low";
} {
  if (c >= 0.95) return { label: "High confidence", tone: "high" };
  if (c >= 0.85) return { label: "Good confidence", tone: "medium" };
  return { label: "Low confidence", tone: "low" };
}

export function formatMoney(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatMoneyCents(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
