"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { Inspector } from "@/components/return/Inspector";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Grade,
  OwnerBadge,
  ProgressBar,
  SectionLabel,
  StatePill,
  cx,
  Segmented,
} from "@/components/ui";
import { FIELD_STATE, STAGE, formatMoney } from "@/lib/design";
import {
  daysUntil,
  documentsFor,
  openRequestsFor,
  relativeTime,
  tasksFor,
} from "@/lib/mockData";
import { returnSummaryById } from "@/lib/mockVolume";
import { getWarnings } from "@/lib/mockAI";
import { useStore } from "@/lib/store";
import {
  RETURN_SECTIONS,
  type ReturnLine,
  type ReturnSection,
  type ReturnSummary,
  type TaxReturn,
} from "@/lib/types";

/* ---------------------------------------------------------------------------
   The return review workspace.

   The organising decision here is that the screen shows the WHOLE return, not
   a queue of problems. A preparer's job is to be able to sign their name to
   every line, which they cannot do if the interface only ever shows them the
   broken ones.

   So: all lines, always, grouped as they appear on the form — and a health
   state on each. A healthy return reads as calm, which is precisely what makes
   the two lines that need attention impossible to miss. "Needs attention" is
   available as a filter, but it is a lens, never the default.
--------------------------------------------------------------------------- */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Formatted by hand, same as the messages page: toLocaleDateString on a page
 *  rendered on the server and again in the browser risks a hydration mismatch. */
function formatFiledDate(at: string): string {
  const d = new Date(at);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading return…</div>}>
      <ReturnWorkspace returnId={id} />
    </Suspense>
  );
}

function ReturnWorkspace({ returnId }: { returnId: string }) {
  const { getReturn, lastChanges, clearChanges, undoable, undoLast } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const ret = getReturn(returnId);

  const [onlyAttention, setOnlyAttention] = useState(false);
  const [activeSection, setActiveSection] = useState<ReturnSection | "all">("all");

  // The selected line lives in the URL, so any view of this workspace is a
  // shareable link straight to the number under discussion.
  const selectedId = params.get("line");

  const selected = useMemo(() => {
    if (!ret) return undefined;
    return ret.lines.find((l) => l.id === selectedId) ?? ret.lines[0];
  }, [ret, selectedId]);

  const selectLine = (lineId: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("line", lineId);
    router.replace(`/returns/${returnId}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!lastChanges.length) return;
    const t = setTimeout(clearChanges, 15000);
    return () => clearTimeout(t);
  }, [lastChanges, clearChanges]);

  // Most of the firm's book exists as summary data only. Rather than a dead
  // end, show everything that IS known about the return and be explicit about
  // where the line-level detail lives.
  if (!ret) {
    const summary = returnSummaryById(returnId);
    if (!summary) {
      return (
        <Shell crumbs={[{ label: "Returns", href: "/returns" }, { label: "Unknown return" }]}>
          <EmptyState
            title="No return with that reference"
            detail="The link may be out of date. All 240 returns are listed under Returns."
            action={
              <Link href="/returns">
                <Button variant="primary" size="sm">
                  Browse all returns
                </Button>
              </Link>
            }
          />
        </Shell>
      );
    }
    return <SummaryOnlyReturn summary={summary} />;
  }

  // A return that exists but has not been started yet — a brand-new client.
  if (ret.lines.length === 0) {
    return <NotStartedReturn ret={ret} />;
  }

  const attentionLines = ret.lines.filter((l) => FIELD_STATE[l.state].needsAttention);
  const openRequests = openRequestsFor(ret.id);
  const warnings = getWarnings(ret.id);
  const dueIn = daysUntil(ret.dueDate);

  const visible = ret.lines.filter((l) => {
    if (onlyAttention && !FIELD_STATE[l.state].needsAttention) return false;
    if (activeSection !== "all" && l.section !== activeSection) return false;
    return true;
  });

  const changedIds = new Set(lastChanges.map((c) => c.lineId));

  return (
    <Shell
      crumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Returns", href: "/returns" },
        { label: `${ret.clientName} · ${ret.formType} (${ret.taxYear})` },
        { label: "Review" },
      ]}
      context={{
        label: ret.clientName,
        items: [
          { href: `/returns/${ret.id}`, label: "Review", icon: "grid", count: ret.lines.length },
          {
            href: `/returns/${ret.id}/documents`,
            label: "Documents",
            icon: "doc",
            count: documentsFor(ret.id).length,
          },
          {
            href: `/returns/${ret.id}/messages`,
            label: "Conversation",
            icon: "chat",
            count: openRequests.length,
            alert: openRequests.length > 0,
          },
        ],
      }}
      right={
        <div className="flex items-center gap-2">
          {ret.blocked && <Chip tone="danger">Blocked</Chip>}
          <Chip tone={attentionLines.length ? "warn" : "ok"}>
            {attentionLines.length
              ? `${attentionLines.length} need${attentionLines.length === 1 ? "s" : ""} attention`
              : "Nothing outstanding"}
          </Chip>
        </div>
      }
    >
      <div className="flex h-full flex-col">
      {/* Return-level summary ------------------------------------------- */}
      <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-hair bg-panel px-5 py-3">
        <Grade grade={ret.readiness.grade} />
        <div className="min-w-[220px] flex-1">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs text-muted">
              {ret.readiness.linesSettled} of {ret.readiness.linesTotal} lines settled
              {openRequests.length > 0 &&
                ` · ${openRequests.length} question${openRequests.length === 1 ? "" : "s"} out with the client`}
            </span>
            <span className="text-xs text-faint">
              {/* A filed return has no countdown — "due in -345 days" read as
                  a bug, and the only date that matters now is when it went in. */}
              {ret.stage === "filed"
                ? `Filed · ${formatFiledDate(ret.lastActivity)}`
                : `${STAGE[ret.stage].staff} · due in ${dueIn} days`}
            </span>
          </div>
          <ProgressBar value={ret.readiness.score} />
        </div>

        <div className="text-right">
          <p className="text-xs text-muted">
            {ret.outcome?.kind === "refund" ? "Estimated refund" : "Estimated owed"}
          </p>
          <p className="tnum text-lg font-semibold">
            {formatMoney(
              ret.lines.find((l) => l.id === "34")?.amount ?? ret.outcome?.amount ?? 0
            )}
          </p>
        </div>
      </div>

      {/* A blocker is the most important thing on the screen. ------------- */}
      {ret.blocked && (
        <div className="flex flex-wrap items-center gap-3 border-b border-dangeredge bg-dangersoft px-5 py-2.5">
          <span className="text-sm text-danger">
            <strong className="font-medium">Blocked:</strong> {ret.blocked.reason}
          </span>
          <span className="text-xs text-danger/80">
            since {relativeTime(ret.blocked.since)}
          </span>
          <Link href={`/returns/${ret.id}/messages`} className="ml-auto">
            <Button size="sm">Open the conversation</Button>
          </Link>
        </div>
      )}

      {/* What just moved, after a recalculation. -------------------------- */}
      {lastChanges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-accentedge bg-accentsoft px-5 py-2 text-xs text-accentink">
          <strong className="font-medium">Recalculated:</strong>
          {lastChanges.map((c) => (
            <span key={c.lineId} className="tnum">
              line {c.lineId} {formatMoney(c.from)} → {formatMoney(c.to)}
            </span>
          ))}
          {/* Undo lives here because this is where the consequence is being
              announced. A correction you cannot take back is not a correction
              a careful person will make quickly. */}
          {undoable && (
            <button
              onClick={undoLast}
              className="ml-auto rounded-md border border-accentedge bg-canvas px-2 py-0.5 font-medium text-accentink hover:bg-white"
            >
              Undo this
            </button>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-stretch">
        {/* Section outline ---------------------------------------------- */}
        <nav className="app-scroll w-44 shrink-0 border-r border-line py-4" aria-label="Return sections">
          <SectionLabel className="px-4 pb-1.5">Return outline</SectionLabel>
          <ul>
            <li>
              <SectionButton
                label="All lines"
                count={ret.lines.length}
                active={activeSection === "all"}
                onClick={() => setActiveSection("all")}
              />
            </li>
            {RETURN_SECTIONS.map((s: ReturnSection) => {
              const lines = ret.lines.filter((l) => l.section === s);
              if (!lines.length) return null;
              const attention = lines.filter(
                (l) => FIELD_STATE[l.state].needsAttention
              ).length;
              return (
                <li key={s}>
                  <SectionButton
                    label={s}
                    count={lines.length}
                    attention={attention}
                    active={activeSection === s}
                    onClick={() => setActiveSection(s)}
                  />
                </li>
              );
            })}
          </ul>

          {warnings.length > 0 && (
            <div className="mt-4 border-t border-line px-4 pt-3">
              <SectionLabel>AI observations</SectionLabel>
              <ul className="mt-1.5 space-y-1.5">
                {warnings.map((w) => (
                  <li key={w.id}>
                    <button
                      onClick={() => w.relatedLines[0] && selectLine(w.relatedLines[0])}
                      className="text-left text-[11px] leading-snug text-muted hover:text-accentink"
                    >
                      <span
                        className={cx(
                          "mr-1",
                          w.severity === "serious"
                            ? "text-warn"
                            : w.severity === "attention"
                            ? "text-warn"
                            : "text-faint"
                        )}
                      >
                        {w.severity === "info" ? "·" : "▲"}
                      </span>
                      {w.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        {/* The return itself -------------------------------------------- */}
        <div className="app-scroll min-w-0 flex-1">
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-hair bg-canvas px-5 py-2">
            <SectionLabel>
              {onlyAttention ? "Lines needing attention" : "Every line on this return"}
            </SectionLabel>
            <div className="ml-auto">
              <Segmented
                label="Which lines to show"
                value={onlyAttention ? "attention" : "all"}
                onChange={(v) => setOnlyAttention(v === "attention")}
                options={[
                  { value: "all", label: "All lines", count: ret.lines.length },
                  {
                    value: "attention",
                    label: "Needs attention",
                    count: attentionLines.length,
                  },
                ]}
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title="Nothing needs attention here"
              detail="Every line in this view has been settled."
              action={
                <Button size="sm" onClick={() => setOnlyAttention(false)}>
                  Show all lines
                </Button>
              }
            />
          ) : (
            <LineTable
              lines={visible}
              selectedId={selected?.id}
              changedIds={changedIds}
              onSelect={selectLine}
              grouped={activeSection === "all"}
            />
          )}
        </div>

        {selected && <Inspector ret={ret} line={selected} onSelectLine={selectLine} />}
      </div>
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A return the firm has, but which this prototype only carries summary data
 * for. Everything genuinely known about it is shown; the honest sentence about
 * what is missing sits at the bottom rather than replacing the content.
 */
function SummaryOnlyReturn({ summary }: { summary: ReturnSummary }) {
  return (
    <Shell
      crumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Returns", href: "/returns" },
        { label: summary.clientName },
      ]}
      right={<OwnerBadge owner={summary.owner} />}
    >
      <div className="mx-auto max-w-3xl px-6 py-8">
        <SectionLabel>
          {summary.formType} · tax year {summary.taxYear}
        </SectionLabel>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {summary.clientName}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Grade grade={summary.readinessGrade} />
          <Chip tone="neutral">{STAGE[summary.stage].staff}</Chip>
          <OwnerBadge owner={summary.owner} />
          {summary.blockedDays ? (
            <Chip tone="danger">Blocked {summary.blockedDays} days</Chip>
          ) : null}
        </div>

        {summary.blockedReason && (
          <Card tone="danger" className="mt-4 p-4">
            <SectionLabel className="text-danger">What is holding it up</SectionLabel>
            <p className="mt-1.5 text-sm">{summary.blockedReason}</p>
          </Card>
        )}

        <Card className="mt-4 divide-y divide-hair p-0">
          <Row label="Preparer" value={summary.preparerName} />
          <Row label="Reviewer" value={summary.reviewerName} />
          <Row
            label="Due"
            value={`${summary.dueDate}${
              summary.dueDate.startsWith("2026-10") ? " (on extension)" : ""
            }`}
          />
          <Row label="Last activity" value={relativeTime(summary.lastActivity)} />
          <Row label="Open items" value={String(summary.openItems)} />
          <Row label="Why it ranks where it does" value={summary.priorityReason} />
        </Card>

        <Card className="mt-4 p-4">
          <SectionLabel>Line-level detail</SectionLabel>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            This prototype carries the firm&rsquo;s full book of 240 returns so that
            search, filtering and prioritization can be judged at real volume, but
            only four are built out line by line. Those four are where the
            traceability and review work can be seen end to end.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/returns/ret-rivera-2025">
              <Button variant="primary" size="sm">
                Marcus Rivera · a return mid-review
              </Button>
            </Link>
            <Link href="/returns/ret-chen-2025">
              <Button size="sm">Sarah Chen</Button>
            </Link>
            <Link href="/returns/ret-petrov-2025">
              <Button size="sm">Elena Petrov · business return</Button>
            </Link>
            {/* The copy said three and listed three, but a fourth exists and is
                the only one that shows a filed, frozen return. */}
            <Link href="/returns/ret-rivera-2024">
              <Button size="sm">Marcus Rivera · 2024, filed</Button>
            </Link>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/** A real return that simply has not been started — nothing to review yet. */
function NotStartedReturn({ ret }: { ret: TaxReturn }) {
  const tasks = tasksFor(ret.id);
  const outstanding = tasks.filter((t) => t.status !== "done");
  return (
    <Shell
      crumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Returns", href: "/returns" },
        { label: ret.clientName },
      ]}
      right={<OwnerBadge owner="client" />}
    >
      <div className="mx-auto max-w-3xl px-6 py-8">
        <SectionLabel>
          {ret.formType} · tax year {ret.taxYear}
        </SectionLabel>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{ret.clientName}</h1>
        <p className="mt-2 text-sm text-muted">
          {ret.preparerName} is preparing this · reviewed by {ret.reviewerName}
        </p>

        <Card className="mt-5 p-5">
          <h2 className="text-[15px] font-medium">Nothing to review yet</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            No documents have arrived, so the return has not been started. There is
            nothing here to verify until {ret.clientName.split(" ")[0]} sends their
            first form — showing an empty 1040 would only invite someone to fill it in
            from memory.
          </p>

          {outstanding.length > 0 && (
            <>
              <SectionLabel className="mt-4">Waiting on the client</SectionLabel>
              <ul className="mt-2 space-y-1.5">
                {outstanding.map((t) => (
                  <li key={t.id} className="text-sm">
                    <span className="font-medium">{t.title}</span>
                    {t.blocking && (
                      <Chip tone="warn" className="ml-2">
                        blocks everything else
                      </Chip>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/returns/${ret.id}/messages`}>
              <Button variant="primary" size="sm">
                Message the client
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm">Back to the dashboard</Button>
            </Link>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */

function SectionButton({
  label,
  count,
  attention = 0,
  active,
  onClick,
}: {
  label: string;
  count: number;
  attention?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm transition-colors",
        active
          ? "border-r-2 border-accent bg-accentsoft font-medium text-accentink"
          : "text-muted hover:bg-locksoft hover:text-ink"
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {attention > 0 ? (
        <span className="tnum rounded-full bg-warnsoft px-1.5 text-[11px] font-semibold text-warn">
          {attention}
        </span>
      ) : (
        <span className="tnum text-[11px] text-faint">{count}</span>
      )}
    </button>
  );
}


/* -------------------------------------------------------------------------- */

function LineTable({
  lines,
  selectedId,
  changedIds,
  onSelect,
  grouped,
}: {
  lines: ReturnLine[];
  selectedId?: string;
  changedIds: Set<string>;
  onSelect: (id: string) => void;
  grouped: boolean;
}) {
  const { threads } = useStore();

  const openThreadCount = (line: ReturnLine) => {
    if (!line.threadId) return 0;
    const t = threads.find((x) => x.id === line.threadId);
    if (!t) return 0;
    return t.items.filter((i) => i.kind === "request" && i.status !== "resolved").length;
  };

  return (
    <ul>
      {lines.map((line, index) => {
        // Derived from position rather than a variable mutated mid-render,
        // which React's compiler rightly rejects.
        const showHeader = grouped && line.section !== lines[index - 1]?.section;
        const meta = FIELD_STATE[line.state];
        const open = openThreadCount(line);
        const isSelected = line.id === selectedId;

        return (
          <li key={line.id}>
            {showHeader && (
              <SectionLabel className="bg-panel px-5 py-2">{line.section}</SectionLabel>
            )}
            <button
              onClick={() => onSelect(line.id)}
              aria-current={isSelected ? "true" : undefined}
              className={cx(
                "flex w-full items-center gap-3 border-b border-hair border-l-[3px] px-5 py-2.5 text-left transition-colors",
                isSelected
                  ? "border-l-accent bg-accentsoft"
                  : cx(
                      "border-l-transparent hover:bg-panel",
                      meta.rowTint
                    ),
                changedIds.has(line.id) && !isSelected && "bg-accentsoft/50"
              )}
            >
              <span className="tnum w-9 shrink-0 text-xs text-faint">{line.id}</span>

              <span className="min-w-0 flex-1 text-sm">
                {line.label}
                {changedIds.has(line.id) && (
                  <span className="ml-2 rounded-full bg-accentsoft px-1.5 py-0.5 text-[10px] font-semibold text-accentink">
                    recalculated
                  </span>
                )}
              </span>

              {open > 0 && (
                <span
                  title={`${open} open question about this line`}
                  className="shrink-0 rounded-full border border-lockedge bg-locksoft px-2 py-0.5 text-[11px] text-muted"
                >
                  {open} open
                </span>
              )}

              <span
                className={cx(
                  "tnum w-24 shrink-0 text-right text-sm",
                  line.amount === null && "text-faint"
                )}
              >
                {formatMoney(line.amount)}
              </span>

              <span className="flex w-[112px] shrink-0 justify-end">
                <StatePill state={line.state} confidence={line.confidence} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
