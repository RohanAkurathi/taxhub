"use client";

import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Card, SectionLabel } from "@/components/ui";
import { LogoMark } from "@/components/Logo";
import { TOUR } from "@/lib/tour";
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

export default function Home() {
  const { setActing } = useStore();

  return (
    <Shell crumbs={[{ label: "Start" }]}>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center gap-2.5">
          <LogoMark size={36} />
          <div>
            <p className="text-lg font-semibold leading-none tracking-tight">
              Tax<span className="text-accent">Hub</span>
            </p>
            <SectionLabel className="mt-1">
              GreenGrowth CPAs · case-study prototype
            </SectionLabel>
          </div>
        </div>
        <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-balance">
          A tax platform where every number traces back to the paper it came from.
        </h1>

        {/* Said plainly, because a reviewer could otherwise mistake this page
            for the product's first-run experience — which is the client's
            empty account, not an orientation page for whoever is grading. */}
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          This page is a way in for whoever is reviewing the prototype, not a screen
          the product ships. The real first-run experience is{" "}
          <span className="font-medium text-ink">the client&rsquo;s empty account</span>,
          which is where the tour starts.
        </p>

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

        <SectionLabel className="mt-8">
          A route through it &mdash; about six minutes
        </SectionLabel>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          Start at the top and follow the &ldquo;next&rdquo; link at the bottom of each
          screen. Nothing here needs a URL typed, and the sidebar still works if you
          would rather wander.
        </p>

        <ol className="mt-4 space-y-2">
          {TOUR.map((stop, i) => (
            <li key={stop.slug}>
              <Link
                href={stop.href}
                onClick={() => stop.acting && setActing(stop.acting)}
                className={
                  "flex gap-3.5 rounded-xl border p-4 transition-colors " +
                  (i === 0
                    ? "border-accentedge bg-accentsoft/40 hover:border-accent"
                    : "border-line bg-canvas hover:border-accentedge")
                }
              >
                <span
                  className={
                    "tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold " +
                    (i === 0
                      ? "bg-accent text-white"
                      : "bg-locksoft text-muted")
                  }
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold">{stop.title}</span>
                    {i === 0 && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        start here
                      </span>
                    )}
                    <span className="text-[11px] text-faint">
                      challenge{stop.challenges.length > 1 ? "s" : ""}{" "}
                      {stop.challenges.map((c) => String(c).padStart(2, "0")).join(", ")}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">
                    {stop.blurb}
                  </span>
                  <span className="mt-2 block border-t border-hair pt-2 text-xs leading-relaxed text-muted">
                    <span className="font-medium text-ink">Try:</span> {stop.tryThis}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

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
