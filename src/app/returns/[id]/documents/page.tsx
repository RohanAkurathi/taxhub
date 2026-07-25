"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  Button,
  Card,
  Chip,
  DocumentView,
  EmptyState,
  SectionLabel,
  cx,
} from "@/components/ui";
import { documentsFor, relativeTime } from "@/lib/mockData";
import { returnSummaryById } from "@/lib/mockVolume";
import { useStore } from "@/lib/store";
import type { DocumentType, SourceDocument } from "@/lib/types";

/* ---------------------------------------------------------------------------
   Every document on one return (challenge 09).

   A business return arrives as dozens of files, and the question a preparer
   actually asks is never "show me all of them" — it is "which ones did the AI
   struggle with", or "what feeds line 27", or "did the receipts for travel ever
   turn up". So the list is built around those questions: filter by what needs a
   human, search by name, and every row states what it feeds.

   Preview stays inline rather than opening a viewer. Opening a document is a
   detour; seeing it beside its neighbours is how you actually work through a
   pile of them.
--------------------------------------------------------------------------- */

type Lens = "all" | "attention" | "clean";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { getReturn } = useStore();

  const ret = getReturn(id);
  const summary = returnSummaryById(id);
  const clientName = ret?.clientName ?? summary?.clientName ?? "This return";

  const docs = useMemo(() => documentsFor(id), [id]);

  const [query, setQuery] = useState("");
  const [lens, setLens] = useState<Lens>("all");
  const [type, setType] = useState<DocumentType | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(15);

  const needsEye = (d: SourceDocument) =>
    d.scanQuality === "low" || d.boxes.some((b) => b.uncertain);

  const types = useMemo(() => {
    const set = new Map<DocumentType, number>();
    for (const d of docs) set.set(d.type, (set.get(d.type) ?? 0) + 1);
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [docs]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return docs.filter((d) => {
      if (lens === "attention" && !needsEye(d)) return false;
      if (lens === "clean" && needsEye(d)) return false;
      if (type !== "all" && d.type !== type) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.issuer.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q) ||
        d.feedsLines.some((l) => l.toLowerCase().includes(q))
      );
    });
  }, [docs, query, lens, type]);

  const attentionCount = docs.filter(needsEye).length;
  const shown = filtered.slice(0, limit);

  const crumbs = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Returns", href: "/returns" },
    { label: clientName, href: `/returns/${id}` },
    { label: "Documents" },
  ];

  if (!docs.length) {
    return (
      <Shell crumbs={crumbs}>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <EmptyState
            title="No documents on this return yet"
            detail={`Nothing has been uploaded for ${clientName}. Documents appear here the moment they arrive.`}
            action={
              <Link href={`/returns/${id}`} className="mt-2 inline-block">
                <Button size="sm">Open the return</Button>
              </Link>
            }
          />
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      crumbs={crumbs}
      right={
        <Chip tone={attentionCount ? "warn" : "ok"}>
          {attentionCount
            ? `${attentionCount} need a human eye`
            : "All read cleanly"}
        </Chip>
      }
    >
      <div className="mx-auto max-w-5xl px-6 py-7">
        <SectionLabel>Documents</SectionLabel>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{clientName}</h1>
          <span className="text-sm text-muted">
            {docs.length} file{docs.length === 1 ? "" : "s"} on this return
          </span>
          <Link
            href={`/returns/${id}`}
            className="text-sm text-accentink hover:underline"
          >
            Open the return →
          </Link>
        </div>

        {/* Controls -------------------------------------------------------- */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(15);
            }}
            placeholder="Search by name, issuer, or the line it feeds…"
            aria-label="Search documents"
            className="min-w-[260px] flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm placeholder:text-faint"
          />
          <div className="inline-flex rounded-lg border border-line bg-panel p-0.5">
            {(
              [
                ["all", `All ${docs.length}`],
                ["attention", `Needs an eye ${attentionCount}`],
                ["clean", `Read cleanly ${docs.length - attentionCount}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setLens(key);
                  setLimit(15);
                }}
                aria-pressed={lens === key}
                className={cx(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  lens === key
                    ? "bg-accent text-white"
                    : "text-muted hover:bg-locksoft hover:text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {types.length > 1 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-faint">Type:</span>
            <button
              onClick={() => setType("all")}
              className={cx(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                type === "all"
                  ? "border-accentedge bg-accentsoft text-accentink"
                  : "border-line bg-canvas text-muted hover:border-lockedge"
              )}
            >
              Any
            </button>
            {types.map(([t, n]) => (
              <button
                key={t}
                onClick={() => {
                  setType(t);
                  setLimit(15);
                }}
                className={cx(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  type === t
                    ? "border-accentedge bg-accentsoft text-accentink"
                    : "border-line bg-canvas text-muted hover:border-lockedge"
                )}
              >
                {t} <span className="tnum opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-muted">
          Showing <span className="tnum font-medium text-ink">{shown.length}</span> of{" "}
          <span className="tnum">{filtered.length}</span>
          {filtered.length !== docs.length && ` (filtered from ${docs.length})`}
        </p>

        {/* The list -------------------------------------------------------- */}
        {filtered.length === 0 ? (
          <EmptyState
            title="No documents match"
            detail="Nothing on this return fits those filters."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setQuery("");
                  setLens("all");
                  setType("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <ul className="mt-3 space-y-2">
            {shown.map((d) => {
              const flagged = needsEye(d);
              const open = openId === d.id;
              return (
                <li key={d.id}>
                  <Card tone={flagged ? "warn" : "plain"} className="overflow-hidden">
                    <button
                      onClick={() => setOpenId(open ? null : d.id)}
                      aria-expanded={open}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left"
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                          flagged ? "bg-warnedge" : "bg-okedge"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{d.title}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {d.issuer} · {d.pages} page{d.pages === 1 ? "" : "s"} ·
                          uploaded {relativeTime(d.uploadedAt)}
                          {d.feedsLines.length > 0 && (
                            <> · feeds {d.feedsLines.map((l) => `line ${l}`).join(", ")}</>
                          )}
                        </span>
                      </span>
                      {flagged && <Chip tone="warn">needs an eye</Chip>}
                      <span className="shrink-0 text-xs text-faint">
                        {open ? "hide" : "preview"}
                      </span>
                    </button>

                    {open && (
                      <div className="border-t border-hair bg-panel px-4 py-3">
                        <DocumentView doc={d} />
                        {d.feedsLines.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted">Goes to:</span>
                            {d.feedsLines.map((l) => (
                              <Link key={l} href={`/returns/${id}?line=${l}`}>
                                <Chip tone="accent">line {l} ↗</Chip>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        {shown.length < filtered.length && (
          <div className="mt-4 text-center">
            <Button size="sm" onClick={() => setLimit((n) => n + 25)}>
              Show 25 more · {filtered.length - shown.length} remaining
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}
