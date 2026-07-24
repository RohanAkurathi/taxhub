"use client";

import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Button, Card, Chip, SectionLabel } from "@/components/ui";
import { useStore } from "@/lib/store";

/* ---------------------------------------------------------------------------
   A short front door for whoever is reviewing this prototype.

   It exists because someone opening the link cold has no idea which of six
   roles they are, or which of ten problems this is meant to solve. Three
   sentences and four entry points cost almost nothing and save that confusion.
--------------------------------------------------------------------------- */

const ENTRIES = [
  {
    href: "/dashboard",
    title: "Preparer dashboard",
    detail: "Whose move is it, across a book of 240 returns.",
    tone: "accent" as const,
  },
  {
    href: "/returns/ret-rivera-2025",
    title: "Review a return",
    detail:
      "Every line traced to its source. Confirm a flagged number and watch the math follow.",
    tone: "accent" as const,
  },
  {
    href: "/home",
    title: "The client side",
    detail: "What a client sees: plain language, one next action.",
    tone: "ok" as const,
  },
  {
    href: "/design-system",
    title: "The interaction system",
    detail: "Every state a value can be in, and what each one permits.",
    tone: "neutral" as const,
  },
];

export default function Home() {
  const { setActing } = useStore();

  return (
    <Shell crumbs={[{ label: "Start" }]}>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <SectionLabel>GreenGrowth CPAs · prototype</SectionLabel>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          A tax platform where every number traces back to the paper it came from.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Client documents come in, an AI reads them, a preparer builds the return, a
          reviewer checks it, and it gets filed. This prototype covers that whole path
          from four points of view. The AI is simulated; everything you can click is real.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {ENTRIES.map((e) => (
            <Card key={e.href} className="p-4 transition-colors hover:border-accentedge">
              <Link
                href={e.href}
                onClick={() =>
                  setActing(
                    e.href === "/home"
                      ? { kind: "self", role: "client", as: "reyes" }
                      : { kind: "staff", role: "preparer" }
                  )
                }
                className="block"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{e.title}</h2>
                  <Chip tone={e.tone}>open</Chip>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{e.detail}</p>
              </Link>
            </Card>
          ))}
        </div>

        <Card className="mt-6 p-4">
          <SectionLabel>What is real, and what is not</SectionLabel>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
            <li>
              <strong className="text-ink">Real:</strong> the state machine on every
              value, the audit trail, the progressive-bracket tax math, search and
              filtering over 240 returns, the prioritization logic, and the permission
              boundary between firm-internal notes and client-visible messages.
            </li>
            <li>
              <strong className="text-ink">Simulated:</strong> the AI. No model is
              called. Confidence scores, extractions and warnings are fabricated in{" "}
              <code className="rounded bg-locksoft px-1 py-0.5 text-xs">
                src/lib/mockAI.ts
              </code>
              , which defines the response contract a real extraction service would fill.
            </li>
          </ul>
          <div className="mt-3">
            <Link href="/design-system">
              <Button size="sm">See the interaction system</Button>
            </Link>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
