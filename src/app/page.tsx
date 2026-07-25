"use client";

import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Card, SectionLabel } from "@/components/ui";
import { useStore } from "@/lib/store";

/* ---------------------------------------------------------------------------
   The front door.

   Someone opening this cold knows nothing: not what the product is, not which
   of six roles they are, not which of ten problems it was built to answer. The
   job of this page is to remove all three questions in about twenty seconds and
   then get out of the way.

   It is deliberately not a marketing page. It explains the workflow the product
   models, names the one thing worth trying first, and says plainly what is real
   and what is faked — because a reviewer who has to guess at that will assume
   the worst.
--------------------------------------------------------------------------- */

/** The pipeline the whole product is organized around. */
const PIPELINE = [
  { who: "The client", does: "sends in their tax documents" },
  { who: "An AI", does: "reads each one and proposes the numbers" },
  { who: "A preparer", does: "checks every figure against its source" },
  { who: "A reviewer", does: "approves it before anything is filed" },
];

const ENTRIES = [
  {
    href: "/returns/ret-rivera-2025?line=2b",
    title: "Review a return",
    kicker: "Start here",
    detail:
      "The heart of it. Every line on a 1040 with a health state, and clicking any of them shows exactly where that number came from.",
    try: "Confirm the flagged interest line and watch six other lines recalculate.",
    primary: true,
  },
  {
    href: "/dashboard",
    title: "The preparer's dashboard",
    kicker: "Whose move is it",
    detail:
      "240 returns, ranked by what is most likely to slip rather than what arrived last.",
    try: "Switch to Reviewer, top right, to see the same firm as a different job.",
  },
  {
    href: "/home",
    title: "The client's side",
    kicker: "The same firm, from outside",
    detail:
      "What a taxpayer sees: plain language, one next action, and no jargon anywhere.",
    try: "This account is brand new, so it starts empty. Complete the checklist.",
  },
  {
    href: "/design-system",
    title: "The interaction system",
    kicker: "The rules underneath",
    detail:
      "Every state a value can be in — AI-read, verified, flagged, locked — and what each one lets you do.",
    try: "This is the reference the rest of the product is built against.",
  },
];

export default function Home() {
  const { setActing } = useStore();

  return (
    <Shell crumbs={[{ label: "Start" }]}>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <SectionLabel>GreenGrowth CPAs · case-study prototype</SectionLabel>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-balance">
          A tax platform where every number traces back to the paper it came from.
        </h1>

        {/* The workflow, before anything else. Nothing on the next screens
            makes sense without knowing who does what to whom. */}
        <Card className="mt-6 p-5">
          <SectionLabel>How a tax return gets made</SectionLabel>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((step, i) => (
              <li key={step.who} className="flex gap-2.5">
                <span className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accentsoft text-[11px] font-semibold text-accentink">
                  {i + 1}
                </span>
                <span className="text-sm leading-snug">
                  <span className="font-medium">{step.who}</span>{" "}
                  <span className="text-muted">{step.does}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-hair pt-3 text-sm leading-relaxed text-muted">
            The hard part is trust. A preparer signs their name to every figure, so
            they cannot take software&rsquo;s word for it — which is why this prototype
            treats <span className="font-medium text-ink">where a number came from</span>{" "}
            as the center of the product rather than a detail behind it.
          </p>
        </Card>

        <SectionLabel className="mt-8">Four ways in</SectionLabel>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ENTRIES.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              onClick={() =>
                setActing(
                  e.href === "/home"
                    ? { kind: "self", role: "client", as: "reyes" }
                    : { kind: "staff", role: "preparer" }
                )
              }
              className={
                "block rounded-xl border p-4 transition-colors " +
                (e.primary
                  ? "border-accentedge bg-accentsoft/40 hover:border-accent"
                  : "border-line bg-canvas hover:border-accentedge")
              }
            >
              <p
                className={
                  "text-[11px] font-semibold uppercase tracking-[0.09em] " +
                  (e.primary ? "text-accentink" : "text-faint")
                }
              >
                {e.kicker}
              </p>
              <h2 className="mt-1 text-[15px] font-semibold">{e.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{e.detail}</p>
              <p className="mt-2 border-t border-hair pt-2 text-xs leading-relaxed text-muted">
                <span className="font-medium text-ink">Try:</span> {e.try}
              </p>
            </Link>
          ))}
        </div>

        <Card className="mt-6 p-5">
          <SectionLabel>What is real, and what is faked</SectionLabel>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-ok">Real</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                The state of every value and what it permits, the audit trail, the tax
                math (confirming a number really does recalculate the rest through 2025
                brackets), search across 240 returns, the ranking logic, and the wall
                between firm-internal notes and client-visible messages.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-warn">Simulated</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                The AI. No model is called anywhere. Confidence scores, extractions and
                warnings are written by hand in{" "}
                <code className="rounded bg-locksoft px-1 py-0.5 text-xs">
                  src/lib/mockAI.ts
                </code>
                , which exists to pin down the response contract a real document-reading
                service would have to fill. Source documents are styled HTML, not scans.
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-hair pt-3 text-xs leading-relaxed text-faint">
            Everything is held in memory, so refreshing the page resets the demo to its
            starting state. There is no database and no sign-in.
          </p>
        </Card>
      </div>
    </Shell>
  );
}
