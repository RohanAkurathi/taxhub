import type { ActingContext } from "./store";

/* ---------------------------------------------------------------------------
   A route through the product.

   Someone opening this cold has no reason to know that the interesting thing
   is on line 2b of one particular return. Left to wander, they will find the
   dashboard, click a generated row, and conclude the prototype is thin.

   So the product carries its own path: an ordered set of stops, each naming
   what to look at and what to try, with a "next" that follows you from screen
   to screen. Free navigation still works — this is a handrail, not a rail.
--------------------------------------------------------------------------- */

export interface TourStop {
  slug: string;
  href: string;
  title: string;
  /** What this screen is for, in one line. */
  blurb: string;
  /** The one thing worth doing here. */
  tryThis: string;
  /** Which of the ten challenges this stop speaks to. */
  challenges: number[];
  /** The role to switch into before showing it. */
  acting?: ActingContext;
}

export const TOUR: TourStop[] = [
  {
    slug: "review",
    href: "/returns/ret-rivera-2025?line=2b",
    title: "Where a number comes from",
    blurb:
      "The whole 1040, every line, each with a health state. Clicking any line — verified, calculated, even deliberately blank — shows exactly where that figure came from.",
    tryThis:
      "The AI read $1,432 here but the return says $1,240. Confirm is disabled until you click the highlighted box on the document. Do that, confirm, and watch six lines recalculate — then undo it.",
    challenges: [1, 8, 10],
    acting: { kind: "staff", role: "preparer" },
  },
  {
    slug: "conversation",
    href: "/returns/ret-rivera-2025/messages",
    title: "One conversation, two audiences",
    blurb:
      "Every question, note and answer on this return in one thread, going back to when the engagement started. Internal notes sit inline; requests are objects with an owner and a status.",
    tryThis:
      "Switch to Marcus's view in the top right. Every firm-only note disappears, the status re-words itself, and the line number drops off the chip.",
    challenges: [2, 4],
    acting: { kind: "staff", role: "preparer" },
  },
  {
    slug: "dashboard",
    href: "/dashboard",
    title: "What to work on now",
    blurb:
      "Columns are ownership, not process stage, because at 8am the only question is whose move it is. Ranking is real, and every card can explain why it sits where it does.",
    tryThis:
      "Switch to Reviewer in the top right — same firm, different job, different verbs. Then try Seasonal preparer and read the line at the bottom of the sidebar.",
    challenges: [5, 6, 7],
    acting: { kind: "staff", role: "preparer" },
  },
  {
    slug: "client",
    href: "/home",
    title: "The same firm, from outside",
    blurb:
      "A brand-new client account on day one. Nothing uploaded, nothing to unlearn — the actual first-run experience, not an orientation page.",
    tryThis:
      "Complete the checklist and watch the page become a status page. Then switch to Elena Petrov to see a business owner's version of the same product.",
    challenges: [3, 6],
    acting: { kind: "self", role: "client", as: "reyes" },
  },
  {
    slug: "scale",
    href: "/returns/ret-petrov-2025/documents",
    title: "Depth that stays navigable",
    blurb:
      "A business return carrying 41 lines and 40 documents, on top of a firm-wide book of 240 returns. The complexity is not reduced — it is made navigable.",
    tryThis:
      "Filter to the four documents the AI struggled with, open one, and follow it to the line it becomes.",
    challenges: [9],
    acting: { kind: "staff", role: "preparer" },
  },
  {
    slug: "system",
    href: "/design-system",
    title: "The rules underneath",
    blurb:
      "Every state a value can be in, what each one permits, and the two vocabularies the same status is rendered in. Defined once as data — which is what stops any of it drifting.",
    tryThis:
      "Compare the staff and client wording for the same pipeline stage, near the bottom.",
    challenges: [6, 8],
    acting: { kind: "staff", role: "preparer" },
  },
];

export function stopIndex(slug: string): number {
  return TOUR.findIndex((s) => s.slug === slug);
}

/** The stop a given path belongs to, so "next" works from anywhere on it. */
export function stopForPath(pathname: string): TourStop | undefined {
  return TOUR.find((s) => {
    const base = s.href.split("?")[0];
    return pathname === base;
  });
}
