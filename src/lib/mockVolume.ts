import type { FormType, Owner, ReturnSummary, Stage } from "./types";
import { STAGE, gradeFromScore } from "./design";
import { HERO_RETURNS, TODAY, daysSince, openRequestsFor } from "./mockData";

/* ---------------------------------------------------------------------------
   Volume.

   Challenge 09 asks for search, filtering, and hierarchy to be tested against
   real volume rather than a handful of demo rows, so this module generates a
   full firm's book of business: ~240 returns across six staff.

   The generator is seeded and deterministic. Math.random() would produce
   different data on the server and the client and break hydration — and, more
   practically, a demo whose numbers change on every refresh is impossible to
   talk about in a walkthrough.
--------------------------------------------------------------------------- */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  "Amara", "Ben", "Priya", "Tom", "Lucia", "Wei", "Nadia", "Owen", "Sofia", "Hassan",
  "Grace", "Diego", "Mei", "Caleb", "Ingrid", "Rafael", "Yara", "Felix", "Anika", "Jonas",
  "Talia", "Miguel", "Farrah", "Ezra", "Noor", "Silas", "Divya", "Marco", "Leila", "Anton",
  "Rosa", "Kwame", "Elise", "Viktor", "Amina", "Theo", "Camila", "Idris", "Hana", "Bram",
];

const LAST = [
  "Okafor", "Nakamura", "Delgado", "Osei", "Whitfield", "Ramos", "Petersen", "Ibrahim",
  "Lindqvist", "Moreau", "Vasquez", "Bergman", "Adeyemi", "Kowalski", "Santos", "Farouk",
  "Novak", "Bianchi", "Haddad", "Lindgren", "Ferreira", "Mbeki", "Choudhury", "Варга",
  "Sørensen", "Castellanos", "Ashworth", "Nguyen", "Rossi", "Abadi",
];

const ENTITY = [
  "Holdings LLC", "Design Studio", "& Partners", "Consulting Group", "Ventures",
  "Trust", "Family Trust", "Restaurant Group", "Logistics Inc", "Dental Practice",
];

const STAFF = [
  "Jordan Reyes",
  "Dana Whitfield",
  "Sam Okonkwo",
  "Rita Alvarez",
  "Paul Mensah",
  "Nina Brandt",
];

const BLOCKERS = [
  "Missing 1099-INT — requested from client",
  "Waiting on signed engagement letter",
  "K-1 not yet issued by the partnership",
  "Missing basis worksheet",
  "Client has not answered the dependents question",
  "Bank statements requested for a deduction",
  "Prior-year return not provided",
];

const STAGE_POOL: Stage[] = [
  "docs_pending",
  "docs_pending",
  "extracting",
  "in_preparation",
  "in_preparation",
  "in_preparation",
  "in_review",
  "in_review",
  "ready_to_file",
  "filed",
  "filed",
];

const FORM_POOL: FormType[] = ["1040", "1040", "1040", "1040", "1120-S", "1065", "1120"];

/* -------------------------------------------------------------------------- */
/* Priority — the real ranking logic behind "what should I work on now?"        */
/* -------------------------------------------------------------------------- */

export interface PriorityResult {
  score: number;
  reason: string;
}

/**
 * Ranks a return by how much it needs a human right now.
 *
 * The weights encode a point of view about tax work, which is the part worth
 * defending: work that is *stuck* outranks work that is merely *due*, because
 * a blocked return burns calendar days while nobody is touching it. A return
 * two days from its deadline with everything in hand is a 20-minute job; a
 * return three weeks out that has been waiting on a client for a week is the
 * one that quietly turns into an extension.
 */
export function computePriority(r: {
  stage: Stage;
  owner: Owner;
  dueDate: string;
  blockedDays?: number;
  openItems: number;
  readinessScore: number;
}): PriorityResult {
  let score = 0;
  const reasons: string[] = [];

  const daysToDue = Math.round(
    (new Date(r.dueDate).getTime() - TODAY.getTime()) / 86_400_000
  );

  // Deadline pressure, ramping steeply inside two weeks.
  if (daysToDue <= 3) {
    score += 45;
    reasons.push(`due in ${daysToDue} days`);
  } else if (daysToDue <= 10) {
    score += 28;
    reasons.push(`due in ${daysToDue} days`);
  } else if (daysToDue <= 21) {
    score += 14;
  }

  // Being stuck is worse than being busy.
  if (r.blockedDays && r.blockedDays > 0) {
    score += Math.min(40, 8 + r.blockedDays * 6);
    reasons.push(`blocked ${r.blockedDays} days`);
  }

  // Work sitting in your own court is actionable right now; work with someone
  // else is not, however urgent it looks.
  if (r.owner === "preparer") {
    score += 20;
    reasons.push("your move");
  } else if (r.owner === "client") {
    score += 6;
  } else if (r.owner === "reviewer") {
    score += 2;
  }

  // Nearly-done work is cheap to close out, so it earns a nudge upward.
  if (r.stage === "ready_to_file") {
    score += 18;
    reasons.push("minutes from filing");
  }

  score += Math.min(12, r.openItems * 4);
  if (r.stage === "filed") score = 0;

  return {
    score,
    reason: reasons.length ? reasons.join(" · ") : "on track",
  };
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                  */
/* -------------------------------------------------------------------------- */

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function generateSummaries(count: number): ReturnSummary[] {
  const rng = mulberry32(20260325);
  const out: ReturnSummary[] = [];

  for (let i = 0; i < count; i++) {
    const stage = pick(rng, STAGE_POOL);
    const formType = pick(rng, FORM_POOL);
    const isEntity = formType !== "1040" && rng() > 0.4;
    const clientName = isEntity
      ? `${pick(rng, LAST)} ${pick(rng, ENTITY)}`
      : `${pick(rng, FIRST)} ${pick(rng, LAST)}`;

    const owner = STAGE[stage].owner;
    const preparerName = pick(rng, STAFF);
    let reviewerName = pick(rng, STAFF);
    if (reviewerName === preparerName) reviewerName = "Dana Whitfield";

    // Most returns are due at the filing deadline; a minority are on extension.
    const onExtension = rng() > 0.86;
    const dueDate = onExtension ? "2026-10-15" : "2026-04-15";

    const stuck = owner === "client" && rng() > 0.45;
    const blockedDays = stuck ? 1 + Math.floor(rng() * 12) : undefined;
    const blockedReason = stuck ? pick(rng, BLOCKERS) : undefined;

    const openItems =
      stage === "filed" ? 0 : Math.floor(rng() * (stuck ? 3 : 2)) + (stuck ? 1 : 0);

    const baseScore =
      stage === "filed"
        ? 100
        : stage === "ready_to_file"
        ? 88 + Math.floor(rng() * 10)
        : stage === "in_review"
        ? 72 + Math.floor(rng() * 18)
        : stage === "in_preparation"
        ? 50 + Math.floor(rng() * 30)
        : stage === "extracting"
        ? 35 + Math.floor(rng() * 20)
        : 12 + Math.floor(rng() * 28);

    const readinessScore = Math.max(0, baseScore - openItems * 5);

    const daysAgo = Math.floor(rng() * 14);
    const lastActivity = new Date(
      TODAY.getTime() - daysAgo * 86_400_000 - Math.floor(rng() * 8) * 3_600_000
    ).toISOString();

    const { score, reason } = computePriority({
      stage,
      owner,
      dueDate,
      blockedDays,
      openItems,
      readinessScore,
    });

    out.push({
      id: `ret-gen-${i.toString().padStart(4, "0")}`,
      clientName,
      formType,
      taxYear: 2025,
      stage,
      owner,
      preparerName,
      reviewerName,
      dueDate,
      lastActivity,
      readinessGrade: gradeFromScore(readinessScore),
      readinessScore,
      openItems,
      blockedDays,
      blockedReason,
      priority: score,
      priorityReason: reason,
    });
  }

  return out;
}

/** Summaries for the three hand-authored returns, so lists include them. */
function heroSummaries(): ReturnSummary[] {
  return HERO_RETURNS.map((r) => {
    const owner = r.blocked ? "client" : STAGE[r.stage].owner;
    const blockedDays = r.blocked ? daysSince(r.blocked.since) : undefined;
    const openItems = openRequestsFor(r.id).length;
    const { score, reason } = computePriority({
      stage: r.stage,
      owner,
      dueDate: r.dueDate,
      blockedDays,
      openItems,
      readinessScore: r.readiness.score,
    });
    return {
      id: r.id,
      clientName: r.clientName,
      formType: r.formType,
      taxYear: r.taxYear,
      stage: r.stage,
      owner,
      preparerName: r.preparerName,
      reviewerName: r.reviewerName,
      dueDate: r.dueDate,
      lastActivity: r.lastActivity,
      readinessGrade: r.readiness.grade,
      readinessScore: r.readiness.score,
      openItems,
      blockedDays,
      blockedReason: r.blocked?.reason,
      priority: score,
      priorityReason: reason,
    };
  });
}

/** The firm's whole book of business. Hero returns first so they're findable. */
export const ALL_RETURNS: ReturnSummary[] = [
  ...heroSummaries(),
  ...generateSummaries(237),
];

export const MY_RETURNS = ALL_RETURNS.filter(
  (r) => r.preparerName === "Jordan Reyes"
);

/** Returns awaiting the current user in a reviewer capacity. */
export const REVIEW_QUEUE = ALL_RETURNS.filter(
  (r) => r.stage === "in_review" && r.reviewerName === "Dana Whitfield"
);

export function returnSummaryById(id: string): ReturnSummary | undefined {
  return ALL_RETURNS.find((r) => r.id === id);
}

/* -------------------------------------------------------------------------- */
/* Search + filter (challenge 09)                                              */
/* -------------------------------------------------------------------------- */

export interface ReturnFilters {
  query?: string;
  stages?: Stage[];
  owners?: Owner[];
  formTypes?: FormType[];
  blockedOnly?: boolean;
  scope?: "mine" | "team";
  sort?: "priority" | "due" | "name" | "readiness" | "activity";
}

export function filterReturns(
  rows: ReturnSummary[],
  f: ReturnFilters
): ReturnSummary[] {
  let out = rows;

  if (f.scope === "mine") {
    out = out.filter((r) => r.preparerName === "Jordan Reyes");
  }
  if (f.query) {
    const q = f.query.toLowerCase().trim();
    out = out.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        r.formType.toLowerCase().includes(q) ||
        r.preparerName.toLowerCase().includes(q) ||
        (r.blockedReason ?? "").toLowerCase().includes(q)
    );
  }
  if (f.stages?.length) out = out.filter((r) => f.stages!.includes(r.stage));
  if (f.owners?.length) out = out.filter((r) => f.owners!.includes(r.owner));
  if (f.formTypes?.length) out = out.filter((r) => f.formTypes!.includes(r.formType));
  if (f.blockedOnly) out = out.filter((r) => (r.blockedDays ?? 0) > 0);

  const sort = f.sort ?? "priority";
  const sorted = [...out];
  sorted.sort((a, b) => {
    switch (sort) {
      case "due":
        return a.dueDate.localeCompare(b.dueDate) || b.priority - a.priority;
      case "name":
        return a.clientName.localeCompare(b.clientName);
      case "readiness":
        return a.readinessScore - b.readinessScore;
      case "activity":
        return b.lastActivity.localeCompare(a.lastActivity);
      default:
        return b.priority - a.priority || a.dueDate.localeCompare(b.dueDate);
    }
  });
  return sorted;
}

/** Counts for the dashboard's triage columns. */
export function boardBuckets(rows: ReturnSummary[]) {
  return {
    yourMove: rows.filter((r) => r.owner === "preparer"),
    waitingOnClient: rows.filter((r) => r.owner === "client"),
    atReviewer: rows.filter((r) => r.owner === "reviewer"),
    processing: rows.filter((r) => r.owner === "system"),
    done: rows.filter((r) => r.stage === "filed"),
  };
}

/** Aging tone for a card — how long something has sat untouched. */
export function agingTone(days: number | undefined): "fresh" | "warm" | "hot" {
  if (!days || days < 2) return "fresh";
  if (days < 4) return "warm";
  return "hot";
}
