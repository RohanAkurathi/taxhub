"use client";

import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Button, Card, Chip, EmptyState, SectionLabel } from "@/components/ui";
import { STAGE, formatMoney } from "@/lib/design";
import { documentsFor } from "@/lib/mockData";
import { useStore } from "@/lib/store";
import { RETURN_SECTIONS } from "@/lib/types";
import type {
  DocumentType,
  FieldState,
  ReturnLine,
  ReturnSection,
  ThreadItem,
} from "@/lib/types";

/* ---------------------------------------------------------------------------
   The return, made client-safe (traceability, challenge 01).

   Same lines the preparer works on, same provenance, same states — but the
   plain description leads and the IRS line number is small print, because a
   client cannot check "line 2b · taxable interest" against anything they own.
   They can check "dividends from your investments — we took this from your
   Vanguard statement".

   States keep the firm's colours and lose the firm's words: amber still means
   a person has to settle it, it just reads "we're checking this" instead of
   "needs review".
--------------------------------------------------------------------------- */


const PLAIN_LINE: Record<string, string> = {
  "1a": "What your employer paid you",
  "2b": "Interest your bank paid you",
  "3b": "Dividends from your investments",
  "8": "Freelance and other income",
  "9": "Everything you brought in",
  "10": "Adjustments to your income",
  "11": "Your income after adjustments",
  "12": "The standard amount everyone can deduct",
  "12b": "What you gave to charity",
  "13": "Deduction for your business income",
  "15": "The amount you're taxed on",
  "16": "Tax on that amount",
  "19": "Credit for your daughter",
  "24": "Your total tax for the year",
  "25a": "Tax already taken out of your pay",
  "26": "Tax you paid in instalments",
  "33": "Everything you've already paid",
  "34": "What comes back to you",
};

const SECTION_TITLE: Record<ReturnSection, string> = {
  Income: "Money you brought in",
  "Adjustments & deductions": "Things that lower your tax",
  "Tax & payments": "Tax, and what you've already paid",
  Refund: "What comes back to you",
};

const DOC_NOUN: Record<DocumentType, string> = {
  "W-2": "pay form",
  "1099-INT": "bank interest form",
  "1099-NEC": "freelance income form",
  "1099-DIV": "investment statement",
  "1099-B": "investment sales statement",
  "K-1": "business income form",
  "1098": "mortgage interest form",
  receipt: "receipt",
  statement: "statement",
  other: "document",
};

/** The firm's colours, the client's words. */
const PLAIN_STATE: Record<FieldState, { label: string; tone: "ok" | "accent" | "warn" | "flag" | "neutral" }> = {
  verified: { label: "Checked by us", tone: "ok" },
  edited: { label: "Corrected by us", tone: "accent" },
  ai_extracted: { label: "Read from your document", tone: "accent" },
  needs_review: { label: "We're checking this", tone: "warn" },
  flagged: { label: "On hold while we check", tone: "flag" },
  calculated: { label: "Worked out for you", tone: "neutral" },
  rule: { label: "A standard amount", tone: "neutral" },
  locked: { label: "Final", tone: "neutral" },
  empty: { label: "Nothing to include", tone: "neutral" },
};

export default function ClientReturn() {
  const { getReturn, threads, clientReturnId } = useStore();
  const ret = getReturn(clientReturnId);

  const crumbs = [
    { label: "Your 2025 return", href: "/home" },
    { label: "What's on your return" },
  ];

  if (!ret) {
    return (
      <Shell crumbs={crumbs}>
        <EmptyState title="We couldn't open your return" />
      </Shell>
    );
  }

  const docs = documentsFor(clientReturnId);

  /** Where a number came from, said the way a person would say it. */
  function sourceOf(line: ReturnLine): { text: string; docLink: boolean } {
    const p = line.provenance;
    switch (p.kind) {
      case "document": {
        const doc = docs.find((d) => d.id === p.documentId);
        return {
          text: doc
            ? `We took this from your ${doc.issuer} ${DOC_NOUN[doc.type]}.`
            : "We took this from a document you sent us.",
          docLink: true,
        };
      }
      case "answer":
        return { text: `You told us: “${p.answer}”.`, docLink: false };
      case "calculation":
        return { text: "We added this up from the amounts above.", docLink: false };
      case "rule":
        return {
          text: "This is a set amount from the tax rules, not something you sent us.",
          docLink: false,
        };
      case "none":
        return { text: p.reason, docLink: false };
    }
  }

  /** An open question the firm has asked the client about this exact number. */
  function questionFor(line: ReturnLine) {
    for (const t of threads.filter((t) => t.returnId === clientReturnId)) {
      for (const item of t.items) {
        if (
          item.kind === "request" &&
          item.owner === "client" &&
          item.status !== "resolved" &&
          item.anchor?.id === line.id
        ) {
          return item as Extract<ThreadItem, { kind: "request" }>;
        }
      }
    }
    return undefined;
  }

  const sections = RETURN_SECTIONS.map((s) => ({
    section: s,
    lines: ret.lines.filter((l) => l.section === s),
  })).filter((s) => s.lines.length > 0);

  return (
    <Shell crumbs={crumbs}>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          What&apos;s on your {ret.taxYear} return
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Every number here comes from something you sent us or something you told
          us. Nothing is invented, and you can see where each one came from.
        </p>

        {/* The number people came for --------------------------------- */}
        {ret.outcome && (
          <Card className="mt-5 p-6">
            <SectionLabel>
              {ret.outcome.kind === "refund"
                ? "Your estimated refund"
                : "What you'll likely owe"}
            </SectionLabel>
            <p className="tnum mt-1.5 text-4xl font-semibold tracking-tight">
              {formatMoney(ret.outcome.amount)}
            </p>
            {ret.outcome.provisional && (
              <div className="mt-2.5">
                <Chip tone="warn">Estimate — this can still change</Chip>
              </div>
            )}
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted">
              {STAGE[ret.stage].client}, so this figure isn&apos;t final. If it
              moves, we&apos;ll tell you what changed and why.
            </p>
          </Card>
        )}

        {/* What we included -------------------------------------------- */}
        <h2 className="mt-8 text-lg font-semibold">What we included</h2>

        {/*
          A brand-new client has no return yet. Saying so plainly is better
          than an empty heading, which reads as something that failed to load.
        */}
        {sections.length === 0 && (
          <Card className="mt-3 p-5">
            <p className="text-[15px] font-medium">
              There&rsquo;s nothing on your return yet.
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              As soon as you send us your forms, we&rsquo;ll start filling this in — and
              every number that appears here will show you the document it came from.
            </p>
            <Link href="/home" className="mt-3 inline-block">
              <Button size="sm" variant="primary">
                See what we need from you
              </Button>
            </Link>
          </Card>
        )}

        <div className="mt-3 space-y-5">
          {sections.map(({ section, lines }) => (
            <div key={section}>
              <SectionLabel>{SECTION_TITLE[section]}</SectionLabel>
              <Card className="mt-2 divide-y divide-hair p-0">
                {lines.map((line) => {
                  const source = sourceOf(line);
                  const question = questionFor(line);
                  const plainState = PLAIN_STATE[line.state];
                  return (
                    <div key={line.id} className="px-4 py-3.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-medium">
                          {PLAIN_LINE[line.id] ?? line.label}
                        </p>
                        <p className="tnum text-sm font-semibold">
                          {line.amount === null ? (
                            <span className="text-muted">Still working this out</span>
                          ) : (
                            formatMoney(line.amount)
                          )}
                        </p>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Chip tone={plainState.tone}>{plainState.label}</Chip>
                        <span className="text-xs leading-relaxed text-muted">
                          {source.text}
                        </span>
                        {source.docLink && (
                          <Link
                            href="/home/documents"
                            className="text-xs font-medium text-accentink hover:underline"
                          >
                            See it
                          </Link>
                        )}
                      </div>

                      {question && (
                        <div className="mt-2 rounded-md border border-warnedge bg-warnsoft px-3 py-2">
                          <p className="text-xs font-medium text-warn">
                            {question.title}
                          </p>
                          <Link
                            href="/home/messages"
                            className="mt-0.5 inline-block text-xs font-medium text-accentink hover:underline"
                          >
                            Answer this →
                          </Link>
                        </div>
                      )}

                      {/* The official name for this number, kept as small
                          print — useful if you ever compare it to the form. */}
                      <p className="mt-1.5 text-[11px] text-faint">
                        Line {line.id} · {line.label}
                      </p>
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>

        <Card className="mt-6 p-5">
          <SectionLabel>If something looks wrong</SectionLabel>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Tell us and we&apos;ll look again — you don&apos;t need to work out
            which number it affects.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium">
            <Link href="/home/messages" className="text-accentink hover:underline">
              Message {ret.preparerName.split(" ")[0]} →
            </Link>
            <Link href="/home/documents" className="text-accentink hover:underline">
              See everything you&apos;ve sent →
            </Link>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
