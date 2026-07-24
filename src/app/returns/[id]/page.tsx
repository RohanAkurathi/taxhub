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
  ProgressBar,
  SectionLabel,
  StatePill,
  cx,
} from "@/components/ui";
import { FIELD_STATE, STAGE, formatMoney } from "@/lib/design";
import { daysUntil, openRequestsFor, relativeTime } from "@/lib/mockData";
import { getWarnings } from "@/lib/mockAI";
import { useStore } from "@/lib/store";
import { RETURN_SECTIONS, type ReturnLine, type ReturnSection } from "@/lib/types";

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

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading return…</div>}>
      <ReturnWorkspace returnId={id} />
    </Suspense>
  );
}

function ReturnWorkspace({ returnId }: { returnId: string }) {
  const { getReturn, lastChanges, clearChanges } = useStore();
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
    const t = setTimeout(clearChanges, 6000);
    return () => clearTimeout(t);
  }, [lastChanges, clearChanges]);

  if (!ret) {
    return (
      <Shell crumbs={[{ label: "Returns", href: "/returns" }, { label: "Not found" }]}>
        <EmptyState
          title="That return isn't in the prototype"
          detail="Only three returns are built out in full. Try Marcus Rivera's."
          action={
            <Link href="/returns/ret-rivera-2025">
              <Button variant="primary" size="sm">
                Open Marcus Rivera's return
              </Button>
            </Link>
          }
        />
      </Shell>
    );
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
      right={
        <div className="flex items-center gap-2">
          {ret.blocked && <Chip tone="danger">Blocked</Chip>}
          <Chip tone={attentionLines.length ? "warn" : "ok"}>
            {attentionLines.length
              ? `${attentionLines.length} need${attentionLines.length === 1 ? "s" : ""} attention`
              : "Nothing outstanding"}
          </Chip>
          <Link href={`/returns/${ret.id}/messages`}>
            <Button size="sm">
              Conversation{openRequests.length > 0 && ` · ${openRequests.length}`}
            </Button>
          </Link>
        </div>
      }
    >
      {/* Return-level summary ------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-4 border-b border-hair bg-panel px-5 py-3">
        <Grade grade={ret.readiness.grade} />
        <div className="min-w-[220px] flex-1">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs text-muted">
              {ret.readiness.linesSettled} of {ret.readiness.linesTotal} lines settled
              {openRequests.length > 0 &&
                ` · ${openRequests.length} question${openRequests.length === 1 ? "" : "s"} out with the client`}
            </span>
            <span className="text-xs text-faint">
              {STAGE[ret.stage].staff} · due in {dueIn} days
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
        </div>
      )}

      <div className="flex items-start">
        {/* Section outline ---------------------------------------------- */}
        <nav className="w-44 shrink-0 border-r border-line py-4" aria-label="Return sections">
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 border-b border-hair px-5 py-2">
            <SectionLabel>
              {onlyAttention ? "Lines needing attention" : "Every line on this return"}
            </SectionLabel>
            <div className="ml-auto flex overflow-hidden rounded-md border border-line">
              <FilterButton
                active={!onlyAttention}
                onClick={() => setOnlyAttention(false)}
              >
                All {ret.lines.length}
              </FilterButton>
              <FilterButton
                active={onlyAttention}
                onClick={() => setOnlyAttention(true)}
              >
                Needs attention {attentionLines.length}
              </FilterButton>
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

function FilterButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-accentsoft text-accentink" : "bg-canvas text-muted hover:bg-panel"
      )}
    >
      {children}
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

  let lastSection: string | null = null;

  return (
    <ul>
      {lines.map((line) => {
        const showHeader = grouped && line.section !== lastSection;
        if (showHeader) lastSection = line.section;
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
