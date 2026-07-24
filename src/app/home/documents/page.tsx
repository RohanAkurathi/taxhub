"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { Button, Card, Chip, EmptyState, SectionLabel } from "@/components/ui";
import { FIELD_STATE } from "@/lib/design";
import { documentsFor, relativeTime } from "@/lib/mockData";
import { useStore } from "@/lib/store";
import type { DocumentType, SourceDocument, ThreadItem } from "@/lib/types";

/* ---------------------------------------------------------------------------
   Everything the client has sent us.

   A client does not think in form numbers, so the plain description leads and
   the official name is small print underneath. The two states that matter to
   them are "you've read it" and "you had a question about it" — the same
   green/amber the firm's screens use, in words a person would actually say.
--------------------------------------------------------------------------- */


const PLAIN_DOC: Record<DocumentType, { what: string; why: string }> = {
  "W-2": {
    what: "Your pay for the year",
    why: "The form your employer sends you in January.",
  },
  "1099-INT": {
    what: "Interest your bank paid you",
    why: "Banks send this if your savings earned interest.",
  },
  "1099-NEC": {
    what: "Freelance or contract income",
    why: "Sent by anyone who paid you outside a normal job.",
  },
  "1099-DIV": {
    what: "Income from your investments",
    why: "What your brokerage paid out during the year.",
  },
  "1099-B": {
    what: "Investments you sold",
    why: "Your brokerage's record of what you sold and for how much.",
  },
  "K-1": {
    what: "Your share of a business",
    why: "Sent by a business you own part of.",
  },
  "1098": {
    what: "Mortgage interest you paid",
    why: "Sent by your mortgage lender.",
  },
  receipt: {
    what: "A receipt you sent us",
    why: "Proof of something you paid for or gave away.",
  },
  statement: {
    what: "An account statement",
    why: "A record from your bank or brokerage.",
  },
  other: { what: "Something you sent us", why: "Filed with your return." },
};

/** What a return line is, in the client's words. */
const PLAIN_LINE: Record<string, string> = {
  "1a": "your pay",
  "3b": "your investment income",
  "9": "your total income",
  "12b": "your donations",
  "19": "the credit for your daughter",
  "25a": "tax already taken from your pay",
};

export default function ClientDocuments() {
  const { getReturn, threads, clientReturnId } = useStore();
  const ret = getReturn(clientReturnId);
  const docs = documentsFor(clientReturnId);

  // Files chosen in this preview. They are not saved anywhere, and the copy
  // below says so rather than pretending an upload happened.
  const [justAdded, setJustAdded] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const crumbs = [
    { label: "Your 2025 return", href: "/home" },
    { label: "Your documents" },
  ];

  if (!ret) {
    return (
      <Shell crumbs={crumbs}>
        <EmptyState title="We couldn't open your documents" />
      </Shell>
    );
  }

  /** The open question, if any, that the firm has asked about this document. */
  function questionFor(doc: SourceDocument) {
    const lineIds = ret!.lines
      .filter(
        (l) => l.provenance.kind === "document" && l.provenance.documentId === doc.id
      )
      .map((l) => l.id);
    for (const t of threads.filter((t) => t.returnId === clientReturnId)) {
      for (const item of t.items) {
        if (
          item.kind === "request" &&
          item.owner === "client" &&
          item.status !== "resolved" &&
          item.anchor &&
          lineIds.includes(item.anchor.id)
        ) {
          return item as Extract<ThreadItem, { kind: "request" }>;
        }
      }
    }
    return undefined;
  }

  /** Amber whenever a human still has to settle something this document feeds. */
  function needsAttention(doc: SourceDocument) {
    return ret!.lines.some(
      (l) =>
        l.provenance.kind === "document" &&
        l.provenance.documentId === doc.id &&
        FIELD_STATE[l.state].needsAttention
    );
  }

  function usedFor(doc: SourceDocument) {
    return doc.feedsLines
      .map((id) => PLAIN_LINE[id])
      .filter(Boolean)
      .join(", ");
  }

  return (
    <Shell crumbs={crumbs}>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Your documents</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Everything you&apos;ve sent us, and what we&apos;ve done with it. We keep
          your original file exactly as you sent it — we never change it.
        </p>

        <div className="mt-6 space-y-3">
          {docs.map((doc) => {
            const plain = PLAIN_DOC[doc.type];
            const question = questionFor(doc);
            const amber = needsAttention(doc);
            const used = usedFor(doc);
            return (
              <Card key={doc.id} tone={amber ? "warn" : "plain"} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">{plain.what}</h2>
                    <p className="mt-0.5 text-sm text-muted">
                      From {doc.issuer} · arrived {relativeTime(doc.uploadedAt)}
                    </p>
                  </div>
                  {amber ? (
                    <Chip tone="warn">We had a question about this</Chip>
                  ) : (
                    <Chip tone="ok">We&apos;ve read this</Chip>
                  )}
                </div>

                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  {plain.why}
                </p>

                {used && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted">We used it for </span>
                    {used}
                    <span className="text-muted">.</span>
                  </p>
                )}

                {amber && (
                  <div className="mt-3 rounded-lg border border-warnedge bg-warnsoft px-3.5 py-2.5">
                    <p className="text-sm font-medium text-warn">
                      {question
                        ? question.title
                        : "We're double-checking one amount on this one."}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {question
                        ? question.detail
                        : "Nothing for you to do — we'll get in touch if we need you."}
                    </p>
                    {question && (
                      <Link
                        href="/home/messages"
                        className="mt-1.5 inline-block text-sm font-medium text-accentink hover:underline"
                      >
                        Answer this →
                      </Link>
                    )}
                  </div>
                )}

                {/* The official name, kept as small print. */}
                <p className="mt-3 border-t border-hair pt-2 text-xs text-faint">
                  {doc.title} · {doc.taxYear} · {doc.pages} page
                  {doc.pages > 1 ? "s" : ""} · you sent this{" "}
                  {relativeTime(doc.uploadedAt)}
                </p>
              </Card>
            );
          })}

          {docs.length === 0 && (
            <Card>
              <EmptyState
                title="Nothing here yet"
                detail="Once you send us your first form, it will show up here."
              />
            </Card>
          )}
        </div>

        {/* Send us something else ------------------------------------- */}
        <div className="mt-6">
          <SectionLabel>Send us something else</SectionLabel>
          <div className="mt-2 rounded-xl border-2 border-dashed border-lockedge bg-panel px-5 py-6 text-center">
            <p className="text-sm font-medium">Drop a file here</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted">
              A clear photo from your phone is fine. If you&apos;re not sure
              whether we need something, send it anyway — we&apos;ll tell you.
            </p>
            <div className="mt-3">
              <Button variant="primary" onClick={() => fileRef.current?.click()}>
                Choose a file
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                aria-label="Choose a file to send us"
                onChange={(e) => {
                  const names = Array.from(e.target.files ?? []).map((f) => f.name);
                  if (names.length) setJustAdded((cur) => [...cur, ...names]);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="mt-2 text-xs text-faint">
              This is a preview — files you pick here stay in your browser and
              aren&apos;t sent anywhere.
            </p>
          </div>

          {justAdded.length > 0 && (
            <Card className="mt-3 divide-y divide-hair p-0">
              {justAdded.map((name, i) => (
                <div
                  key={`${name}-${i}`}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                  <Chip tone="accent">We&apos;re reading this now</Chip>
                </div>
              ))}
            </Card>
          )}
        </div>

        <p className="mt-6 text-sm text-muted">
          Something look wrong?{" "}
          <Link href="/home/messages" className="text-accentink hover:underline">
            Tell {ret.preparerName.split(" ")[0]}
          </Link>{" "}
          and we&apos;ll sort it out.
        </p>
      </div>
    </Shell>
  );
}
