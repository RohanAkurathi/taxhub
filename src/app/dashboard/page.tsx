"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { Card, Grade, OwnerBadge, SectionLabel, cx , Segmented } from "@/components/ui";
import { STAGE } from "@/lib/design";
import {
  FILING_DEADLINE,
  daysSince,
  daysUntil,
  openRequestsFor,
  relativeTime,
} from "@/lib/mockData";
import {
  ALL_RETURNS,
  MY_RETURNS,
  agingTone,
  boardBuckets,
  computePriority,
  filterReturns,
} from "@/lib/mockVolume";
import { useStore } from "@/lib/store";
import type { Owner, ReturnSummary } from "@/lib/types";

/* ---------------------------------------------------------------------------
   The preparer's home screen (challenges 06 + 07).

   The columns are OWNERSHIP, not process stage. A stage board ("in
   preparation", "in review", "ready to file") tells you where work is; it does
   not tell you what to do, because three of its columns are other people's
   problems. Sorting by whose move it is answers the only question a preparer
   asks at 9am: what can I actually move right now.

   The same board serves a manager: switching Mine → Team widens the same
   ranking to the whole firm rather than opening a second product.
--------------------------------------------------------------------------- */

/** Cards shown per column before we start hiding things. */
const COLUMN_CAP = 6;

/** Whose dashboard this is. Matches CURRENT_USER_ID in mockData. */
const ME = "Jordan Reyes";

/** The reviewer whose queue the reviewer view shows. */
const REVIEWER = "Dana Whitfield";

export default function DashboardPage() {
  const { returns, threads, remindRequest, role } = useStore();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [reminded, setReminded] = useState<string[]>([]);

  /*
   * The three hand-authored returns live in the store and change as you work
   * on them. Re-deriving their summary here — rather than reading the frozen
   * row out of ALL_RETURNS — is what makes the dashboard honest: resolve a
   * client request inside a return and it stops being blocked, its readiness
   * moves, and it re-ranks on this board on the way back.
   */
  const liveById = useMemo(() => {
    const map = new Map<string, ReturnSummary>();
    for (const r of returns) {
      const owner: Owner = r.blocked ? "client" : STAGE[r.stage].owner;
      const blockedDays = r.blocked ? daysSince(r.blocked.since) : undefined;
      const openItems = threads
        .filter((t) => t.returnId === r.id)
        .flatMap((t) => t.items)
        .filter((i) => i.kind === "request" && i.status !== "resolved").length;

      const { score, reason } = computePriority({
        stage: r.stage,
        owner,
        dueDate: r.dueDate,
        blockedDays,
        openItems,
        readinessScore: r.readiness.score,
      });

      map.set(r.id, {
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
      });
    }
    return map;
  }, [returns, threads]);

  // filterReturns sorts by priority by default, so the board and the returns
  // list rank identically — one ordering rule, not two that drift.
  const isReviewer = role === "reviewer";

  const rows = useMemo(() => {
    // "Mine" means different books for different jobs: the preparer's is what
    // they prepare, the reviewer's is what awaits their sign-off. Showing a
    // reviewer someone else's prep queue under the label "Mine" was a lie.
    const base =
      scope === "mine"
        ? isReviewer
          ? ALL_RETURNS.filter((r) => r.reviewerName === REVIEWER)
          : MY_RETURNS
        : ALL_RETURNS;
    return filterReturns(
      base.map((r) => liveById.get(r.id) ?? r),
      { sort: "priority" }
    );
  }, [scope, liveById, isReviewer]);

  const buckets = useMemo(() => boardBuckets(rows), [rows]);
  const mine = scope === "mine";
  const mineCount = isReviewer
    ? ALL_RETURNS.filter((r) => r.reviewerName === REVIEWER).length
    : MY_RETURNS.length;

  /*
   * A reviewer's day is a different shape from a preparer's. They are not
   * building returns, they are clearing a queue of other people's finished
   * work — so the same data is bucketed by approval state instead of by whose
   * move it is, and the language changes with it. Same board, same ranking,
   * different job.
   */
  const awaitingReview = useMemo(
    () => rows.filter((r) => r.stage === "in_review"),
    [rows]
  );
  const readyToFile = useMemo(
    () => rows.filter((r) => r.stage === "ready_to_file"),
    [rows]
  );
  const stillBeingBuilt = useMemo(
    () => rows.filter((r) => r.stage === "in_preparation" || r.stage === "extracting"),
    [rows]
  );

  // "Filed this week" is a record of what closed, not a queue, so it reads
  // most-recent-first rather than by priority (every filed return scores 0).
  const filedThisWeek = useMemo(
    () =>
      buckets.done
        .filter((r) => daysSince(r.lastActivity) <= 7)
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)),
    [buckets.done]
  );

  const daysToDeadline = daysUntil(FILING_DEADLINE);
  const openCount = rows.filter((r) => r.stage !== "filed").length;
  const onExtension = rows.filter(
    (r) => r.stage !== "filed" && daysUntil(r.dueDate) > 45
  ).length;
  const processing = buckets.processing.length;

  // rows is priority-sorted, so the first blocked row is the worst one.
  const worst = rows.find((r) => (r.blockedDays ?? 0) > 0);
  // For a reviewer the equivalent is whatever has sat in their queue longest.
  const oldestInReview = [...awaitingReview].sort((a, b) =>
    a.lastActivity.localeCompare(b.lastActivity)
  )[0];

  function sendReminder(r: ReturnSummary) {
    const open = openRequestsFor(r.id)[0];
    remindRequest(open?.threadId ?? `thread-${r.id}`, open?.item.id ?? `req-${r.id}`);
    setReminded((cur) => [...cur, r.id]);
  }

  const reviewerColumns: {
    key: string;
    title: string;
    rows: ReturnSummary[];
    href: string;
    empty: string;
    emphasis?: boolean;
  }[] = [
    {
      key: "awaiting",
      title: "Awaiting your approval",
      rows: awaitingReview,
      href: `/returns?stage=in_review&scope=${scope}`,
      empty: "Your queue is clear.",
      emphasis: true,
    },
    {
      key: "building",
      title: "Still being prepared",
      rows: stillBeingBuilt,
      href: `/returns?owner=preparer&scope=${scope}`,
      empty: "Nothing in preparation.",
    },
    {
      key: "ready",
      title: "Approved, ready to file",
      rows: readyToFile,
      href: `/returns?stage=ready_to_file&scope=${scope}`,
      empty: "Nothing waiting to be filed.",
    },
    {
      key: "filed",
      title: "Filed this week",
      rows: filedThisWeek,
      href: `/returns?stage=filed&scope=${scope}`,
      empty: "Nothing filed in the last seven days.",
    },
  ];

  const preparerColumns: {
    key: string;
    title: string;
    rows: ReturnSummary[];
    href: string;
    empty: string;
    emphasis?: boolean;
  }[] = [
    {
      key: "yours",
      // Under Team the same bucket is every preparer's queue, not yours, so it
      // must not claim to be your move — the board would be lying by a word.
      title: mine ? "Your move" : "With a preparer",
      rows: buckets.yourMove,
      href: `/returns?owner=preparer&scope=${scope}`,
      empty: mine
        ? "Nothing is sitting with you. Genuinely."
        : "Nothing is sitting with a preparer.",
      emphasis: true,
    },
    {
      key: "client",
      title: "Waiting on client",
      rows: buckets.waitingOnClient,
      href: `/returns?owner=client&scope=${scope}`,
      empty: "No client is holding anything up.",
    },
    {
      key: "reviewer",
      title: "With reviewer",
      rows: buckets.atReviewer,
      href: `/returns?owner=reviewer&scope=${scope}`,
      empty: "Nothing is with a reviewer.",
    },
    {
      key: "filed",
      title: "Filed this week",
      rows: filedThisWeek,
      href: `/returns?stage=filed&scope=${scope}`,
      empty: "Nothing filed in the last seven days.",
    },
  ];

  const columns = isReviewer ? reviewerColumns : preparerColumns;

  return (
    <Shell
      crumbs={[
        { label: "Home", href: "/" },
        { label: scope === "mine" ? "My dashboard" : "Team dashboard" },
      ]}
    >
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <SectionLabel>
          {isReviewer
            ? mine
              ? `Reviewer · ${REVIEWER}`
              : "The firm · everything in review"
            : mine
            ? `Preparer · ${ME}`
            : "The firm · all preparers"}
        </SectionLabel>
        <h1 className="mt-1.5 text-xl font-semibold tracking-tight">
          {isReviewer
            ? "What is waiting on your approval"
            : mine
            ? "What needs you today"
            : "What needs the firm today"}
        </h1>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {isReviewer
              ? "Nothing here is yours to build. It is finished work waiting for a second pair of eyes."
              : "Ordered by what is most likely to slip, not by what arrived last."}
          </p>
          <Segmented
            label="Whose returns to show"
            value={scope}
            onChange={setScope}
            options={[
              {
                value: "mine",
                label: isReviewer ? "My review queue" : "My returns",
                count: mineCount,
              },
              { value: "team", label: "The whole firm", count: ALL_RETURNS.length },
            ]}
          />
        </div>

        {/* Header strip ------------------------------------------------- */}
        <Card className="mt-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-x-9 gap-y-3">
              <Stat
                value={daysToDeadline}
                label="days to the April 15 deadline"
                tone={daysToDeadline <= 3 ? "danger" : daysToDeadline <= 10 ? "warn" : "accent"}
              />
              {isReviewer ? (
                <>
                  <Stat value={awaitingReview.length} label="waiting on your approval" />
                  <Stat value={readyToFile.length} label="approved and ready to file" />
                </>
              ) : (
                <>
                  <Stat
                    value={openCount}
                    label={mine ? "open returns in your book" : "open returns at the firm"}
                  />
                  <Stat
                    value={buckets.yourMove.length}
                    label={mine ? "are your move right now" : "are sitting with a preparer"}
                  />
                </>
              )}
            </div>
          </div>

          {(processing > 0 || onExtension > 0) && (
            <p className="mt-3 border-t border-hair pt-2.5 text-xs text-muted">
              {processing > 0 && (
                <>
                  <Link
                    href={`/returns?owner=system&scope=${scope}`}
                    className="font-medium text-accentink hover:underline"
                  >
                    {processing} with the AI
                  </Link>
                  {onExtension > 0 && " · "}
                </>
              )}
              {onExtension > 0 && <>{onExtension} on extension to October</>}
              <span className="text-faint"> — neither needs anything from you today.</span>
            </p>
          )}
        </Card>

        {/* What to do first --------------------------------------------- */}
        {isReviewer
          ? oldestInReview && (
              <Card tone="warn" className="mt-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <SectionLabel>Start here</SectionLabel>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink">
                      <Link
                        href={`/returns/${oldestInReview.id}`}
                        className="font-semibold hover:text-accentink hover:underline"
                      >
                        {oldestInReview.clientName}
                      </Link>
                      &rsquo;s {oldestInReview.formType} has been waiting on you for{" "}
                      <span className="tnum font-semibold">
                        {daysSince(oldestInReview.lastActivity)}
                      </span>{" "}
                      days. The preparer cannot file it until you sign it off.
                    </p>
                  </div>
                  <Link href={`/returns/${oldestInReview.id}`} className="shrink-0">
                    <span className="inline-block rounded-md border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accentink">
                      Review it now
                    </span>
                  </Link>
                </div>
              </Card>
            )
          : worst && (
              <Card
                tone={agingTone(worst.blockedDays) === "hot" ? "danger" : "warn"}
                className="mt-4 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SectionLabel>
                        {mine ? "Needs you first" : "Needs someone first"}
                      </SectionLabel>
                      <OwnerBadge owner={worst.owner} />
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink">
                      <Link
                        href={`/returns/${worst.id}`}
                        className="font-semibold hover:text-accentink hover:underline"
                      >
                        {worst.clientName}
                      </Link>
                      &rsquo;s {worst.formType} has stood still for{" "}
                      <span className="tnum font-semibold">{worst.blockedDays}</span> days.{" "}
                      {worst.blockedReason}. Nothing else on it can move until that lands.
                    </p>
                  </div>

                  <button
                    onClick={() => sendReminder(worst)}
                    disabled={reminded.includes(worst.id)}
                    className={cx(
                      "shrink-0 rounded-md border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accentink",
                      "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent"
                    )}
                  >
                    {reminded.includes(worst.id) ? "Reminder sent" : "Send reminder"}
                  </button>
                </div>
              </Card>
            )}

        {/* The board ---------------------------------------------------- */}
        <div className="mt-4 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => {
            const shown = col.rows.slice(0, COLUMN_CAP);
            const hidden = col.rows.length - shown.length;
            return (
              <section
                key={col.key}
                aria-label={col.title}
                className={cx(
                  "rounded-xl border p-3",
                  col.emphasis
                    ? "border-accentedge bg-accentsoft/50"
                    : "border-line bg-canvas"
                )}
              >
                <div className="flex items-baseline justify-between gap-2 px-0.5 pb-2.5">
                  <h2
                    className={cx(
                      "text-sm font-semibold",
                      col.emphasis ? "text-accentink" : "text-ink"
                    )}
                  >
                    {col.title}
                  </h2>
                  <span className="tnum text-xs text-faint">{col.rows.length}</span>
                </div>

                {shown.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-faint">{col.empty}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {shown.map((r) => (
                      <ReturnCard
                        key={r.id}
                        row={r}
                        emphasis={Boolean(col.emphasis)}
                        reminded={reminded.includes(r.id)}
                        onRemind={() => sendReminder(r)}
                      />
                    ))}
                  </ul>
                )}

                {/* With 240 returns, quietly truncating would be a lie. */}
                {hidden > 0 && (
                  <Link
                    href={col.href}
                    className="mt-2 block rounded-md border border-dashed border-line px-3 py-2 text-center text-xs font-medium text-muted transition-colors hover:border-accentedge hover:text-accentink"
                  >
                    +{hidden} more hidden — see all {col.rows.length}
                  </Link>
                )}
              </section>
            );
          })}
        </div>

        {/* Legend -------------------------------------------------------- */}
        <Card className="mt-4 p-4">
          <SectionLabel>How to read this board</SectionLabel>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ok" />
              Touched in the last 2 days
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-warnedge" />
              Sitting 2–4 days
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-danger" />
              Stuck 4 days or more
            </span>
            <span className="flex items-center gap-2">
              <Grade grade="B" size="sm" />
              How close the return is to going out
            </span>
          </div>
          <p className="mt-3 max-w-3xl border-t border-hair pt-2.5 text-xs leading-relaxed text-muted">
            The columns are whose move it is, not what stage a return is in. A return
            sitting with a client is not staff work however urgent it looks, so it never
            appears in the first column — the most a reminder can do for it is move it
            back to a preparer sooner.
          </p>
        </Card>
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */

function Stat({
  value,
  label,
  tone = "ink",
}: {
  value: number;
  label: string;
  tone?: "ink" | "accent" | "warn" | "danger";
}) {
  const tones = {
    ink: "text-ink",
    accent: "text-accentink",
    warn: "text-warn",
    danger: "text-danger",
  };
  return (
    <div>
      <span className={cx("tnum text-2xl font-semibold leading-none", tones[tone])}>
        {value}
      </span>
      <span className="mt-1 block text-xs text-muted">{label}</span>
    </div>
  );
}

/** How long this return has been standing still, and how alarming that is. */
function AgingDot({ days, name }: { days: number; name: string }) {
  const tone = agingTone(days);
  const detail =
    tone === "fresh"
      ? "Moved in the last 2 days"
      : tone === "warm"
      ? `Standing still for ${days} days`
      : `Stuck for ${days} days`;
  return (
    <span
      role="img"
      aria-label={`${name}: ${detail}`}
      title={detail}
      className={cx(
        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
        tone === "fresh" ? "bg-ok" : tone === "warm" ? "bg-warnedge" : "bg-danger"
      )}
    />
  );
}

/**
 * The one next step, named as a verb.
 *
 * Nothing here offers "File now": in this data `ready_to_file` is waiting on a
 * client's signature, so a filing button would be a button that cannot file.
 * A control that lies about what it does is worse than no control.
 *
 * The same rule governs other people's work. A return being prepared by another
 * preparer, or sitting with a reviewer who is not you, has no step you can take
 * on it — so the button says what it actually does, which is open it.
 */
function nextStep(r: ReturnSummary): { label: string; kind: "open" | "remind" } {
  if (r.stage === "filed") return { label: "View the filed return", kind: "open" };
  if (r.owner === "preparer") {
    if (r.preparerName !== ME) return { label: "Open the return", kind: "open" };
    return {
      label: r.readinessScore < 55 ? "Start preparing" : "Continue preparing",
      kind: "open",
    };
  }
  if (r.owner === "reviewer") {
    return r.reviewerName === ME
      ? { label: "Start review", kind: "open" }
      : { label: "See the review", kind: "open" };
  }
  if (r.stage === "ready_to_file") return { label: "Ask for signature", kind: "remind" };
  return { label: "Send reminder", kind: "remind" };
}

function ReturnCard({
  row,
  emphasis,
  reminded,
  onRemind,
}: {
  row: ReturnSummary;
  emphasis: boolean;
  reminded: boolean;
  onRemind: () => void;
}) {
  const step = nextStep(row);
  const agingDays = row.blockedDays ?? daysSince(row.lastActivity);
  const dueIn = daysUntil(row.dueDate);
  // Terse enough to sit beside the form type and open-item count without
  // truncating, which is what a card this size can actually hold.
  const dueLabel = dueIn > 45 ? "on extension" : `${dueIn}d left`;

  // Only the actionable column gets a filled button. Everywhere else the next
  // step is real but secondary, and shouting about it would flatten the board.
  const actionClasses = cx(
    "inline-flex w-full items-center justify-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
    emphasis
      ? "border-accent bg-accent text-white hover:bg-accentink disabled:hover:bg-accent"
      : "border-line bg-canvas text-ink hover:border-lockedge hover:bg-panel",
    "disabled:cursor-not-allowed disabled:opacity-50"
  );

  return (
    <li
      title={
        row.priorityReason === "on track"
          ? "On track — nothing pressing"
          : `Ranked by ${row.priorityReason}`
      }
      className="relative rounded-lg border border-line bg-canvas p-3 transition-colors hover:border-accentedge"
    >
      <div className="flex items-start gap-2">
        <AgingDot days={agingDays} name={row.clientName} />
        <div className="min-w-0 flex-1">
          {/* Stretched link: the whole card is clickable, but it stays a real
              <a>, and the action button below sits above it on its own layer. */}
          <Link
            href={`/returns/${row.id}`}
            className="block truncate text-sm font-medium text-ink after:absolute after:inset-0 hover:text-accentink"
          >
            {row.clientName}
          </Link>
          {/* One meta line, not three. Everything that is true of most cards
              is compressed here; only genuinely urgent signals earn a row of
              their own below. */}
          <p className="mt-0.5 text-xs leading-snug text-muted">
            {row.formType} ·{" "}
            {row.stage === "filed"
              ? `filed ${relativeTime(row.lastActivity)}`
              : dueLabel}
            {row.openItems > 0 && row.stage !== "filed" && (
              <> · {row.openItems} open</>
            )}
          </p>
        </div>
        <Grade grade={row.readinessGrade} size="sm" />
      </div>

      {row.blockedReason && (
        <p className="mt-2 text-xs leading-snug text-warn">
          {row.blockedReason}
          {row.blockedDays ? (
            <span className="text-faint"> · {row.blockedDays} days</span>
          ) : null}
        </p>
      )}

      <div className="relative z-10 mt-2.5">
        {step.kind === "remind" ? (
          <button onClick={onRemind} disabled={reminded} className={actionClasses}>
            {reminded ? "Reminder sent" : step.label}
          </button>
        ) : (
          <Link href={`/returns/${row.id}`} className={actionClasses}>
            {step.label}
          </Link>
        )}
      </div>

    </li>
  );
}
