"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  OwnerBadge,
  SectionLabel,
  cx,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import { daysSince, relativeTime } from "@/lib/mockData";
import { agingTone, returnSummaryById } from "@/lib/mockVolume";
import type { Owner, RequestStatus, ThreadAnchor } from "@/lib/types";

/* ---------------------------------------------------------------------------
   Open items — the firm-wide answer to "what is outstanding, and who owes it".

   The failure mode this screen is built against is the generic inbox: a stream
   of messages that is read rather than worked, where an item leaves the list
   when someone opens it instead of when the work is done. So there are no
   unread dots, no senders, and no previews. Every row is a unit of work with
   three properties — an owner, an age, and one next action — and it disappears
   only when the underlying request is resolved in the store.

   The two groups are ownership, not folders. Sorting is oldest-first inside
   each group because the ones quietly rotting are the entire point of the page;
   newest-first would bury exactly what this list exists to surface.
--------------------------------------------------------------------------- */

interface OpenItem {
  requestId: string;
  threadId: string;
  returnId: string;
  clientName: string;
  context: string;
  title: string;
  detail: string;
  status: RequestStatus;
  owner: Owner;
  askedBy: string;
  askedAt: string;
  daysWaiting: number;
  anchor?: ThreadAnchor;
  resolution?: { writesToLine: string; value: string; note: string };
}

/** Request status has its own vocabulary — it is not a field state. */
function StatusChip({ status }: { status: RequestStatus }) {
  switch (status) {
    case "waiting":
      return <Chip tone="warn">No reply yet</Chip>;
    case "answered":
      // Green because the person we asked has done their part; what is left is
      // the firm writing the answer onto the return.
      return <Chip tone="ok">Answered</Chip>;
    case "asked":
      return <Chip tone="accent">Asked</Chip>;
    default:
      return <Chip tone="ok">Resolved</Chip>;
  }
}

/**
 * Age is the signal this page is built on, so it gets a color.
 * Hot uses the blocked red deliberately: past four days an unanswered request
 * is not "waiting", it is holding the return still.
 */
function AgeChip({ days }: { days: number }) {
  const tone = agingTone(days);
  const label =
    days <= 0 ? "asked today" : days === 1 ? "1 day" : `${days} days`;
  return (
    <Chip
      tone={tone === "hot" ? "danger" : tone === "warm" ? "warn" : "neutral"}
      title={
        tone === "hot"
          ? "This has been sitting long enough to put the return at risk"
          : "How long this item has been waiting"
      }
    >
      <span className="tnum">{label}</span>
      {days > 0 && <span className="opacity-70">waiting</span>}
    </Chip>
  );
}

export default function OpenItemsPage() {
  const { threads, getReturn, remindRequest, resolveRequest } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = useMemo<OpenItem[]>(() => {
    return threads
      .flatMap((thread) =>
        thread.items
          .filter(
            (i): i is Extract<typeof i, { kind: "request" }> =>
              i.kind === "request" && i.status !== "resolved"
          )
          .map((req) => {
            // Hero returns carry full detail; everything else in the firm's book
            // exists only as a summary row. Either is enough for a client name.
            const full = getReturn(thread.returnId);
            const summary = returnSummaryById(thread.returnId);
            return {
              requestId: req.id,
              threadId: thread.id,
              returnId: thread.returnId,
              clientName:
                full?.clientName ?? summary?.clientName ?? "Unknown client",
              context: full
                ? `${full.formType} · ${full.taxYear}`
                : summary
                ? `${summary.formType} · ${summary.taxYear}`
                : "",
              title: req.title,
              detail: req.detail,
              status: req.status,
              owner: req.owner,
              askedBy: req.askedBy,
              askedAt: req.askedAt,
              daysWaiting: daysSince(req.askedAt),
              anchor: req.anchor,
              resolution: req.resolution,
            } satisfies OpenItem;
          })
      )
      .sort((a, b) => a.askedAt.localeCompare(b.askedAt)); // oldest first
  }, [threads, getReturn]);

  const onClients = items.filter((i) => i.owner === "client");
  const onFirm = items.filter((i) => i.owner !== "client");
  const oldest = items.reduce(
    (max, i) => (i.daysWaiting > max ? i.daysWaiting : max),
    0
  );
  const oldestItem = items.find((i) => i.daysWaiting === oldest);

  return (
    <Shell
      crumbs={[{ label: "Open items" }]}
      right={
        <Chip tone={items.length ? "warn" : "ok"}>
          <span className="tnum">{items.length}</span> open
        </Chip>
      }
    >
      <div className="mx-auto max-w-5xl px-6 py-8">
        <SectionLabel>Across the firm</SectionLabel>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Open items</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Not an inbox. Every row is a piece of work with an owner, an age and one
          next action — it leaves this list when the work is done, not when someone
          reads it.
        </p>

        {/* Summary strip -------------------------------------------------- */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card className="p-3.5">
            <p className="tnum text-2xl font-semibold">{onClients.length}</p>
            <p className="mt-0.5 text-sm text-muted">waiting on a client</p>
          </Card>
          <Card className="p-3.5">
            <p className="tnum text-2xl font-semibold">{onFirm.length}</p>
            <p className="mt-0.5 text-sm text-muted">waiting on the firm</p>
          </Card>
          <Card className="p-3.5">
            <p className="tnum text-2xl font-semibold">
              {items.length ? oldest : "—"}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {items.length
                ? `days — oldest is ${oldestItem?.clientName}`
                : "nothing is waiting"}
            </p>
          </Card>
        </div>

        {items.length === 0 ? (
          <Card className="mt-6">
            <EmptyState
              title="Nothing is outstanding"
              detail="No client and no one at the firm owes an answer right now. New requests appear here the moment they are raised on a return."
              action={
                <Link href="/returns" className="mt-1">
                  <Button size="sm">Go to returns</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            <Group
              title="Waiting on a client"
              caption="We have asked; they have not come back yet. A reminder is the only lever we have."
              items={onClients}
              expanded={expanded}
              setExpanded={setExpanded}
              onRemind={remindRequest}
              onResolve={resolveRequest}
            />
            <Group
              title="Waiting on the firm"
              caption="Ours to move. Nobody is blocking these except us."
              items={onFirm}
              expanded={expanded}
              setExpanded={setExpanded}
              onRemind={remindRequest}
              onResolve={resolveRequest}
            />
          </>
        )}
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */

function Group({
  title,
  caption,
  items,
  expanded,
  setExpanded,
  onRemind,
  onResolve,
}: {
  title: string;
  caption: string;
  items: OpenItem[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  onRemind: (threadId: string, requestId: string) => void;
  onResolve: (threadId: string, requestId: string) => void;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="tnum text-sm text-faint">{items.length}</span>
      </div>
      <p className="mt-0.5 text-sm text-muted">{caption}</p>

      {items.length === 0 ? (
        <Card className="mt-3 px-4 py-5 text-sm text-muted">
          Nothing here — everything in this group has been dealt with.
        </Card>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <Row
              key={item.requestId}
              item={item}
              open={expanded === item.requestId}
              onToggle={() =>
                setExpanded(expanded === item.requestId ? null : item.requestId)
              }
              onRemind={onRemind}
              onResolve={onResolve}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Row({
  item,
  open,
  onToggle,
  onRemind,
  onResolve,
}: {
  item: OpenItem;
  open: boolean;
  onToggle: () => void;
  onRemind: (threadId: string, requestId: string) => void;
  onResolve: (threadId: string, requestId: string) => void;
}) {
  const panelId = `open-item-${item.requestId}`;
  const hot = agingTone(item.daysWaiting) === "hot";
  // Only a line anchor can be addressed by the ?line= param. A document or
  // questionnaire anchor still points at the right return, but asking the
  // workspace for a line id it does not have would silently open the first
  // line instead — a wrong number is worse than a general destination.
  const anchorHref = item.anchor
    ? item.anchor.kind === "line"
      ? `/returns/${item.returnId}?line=${encodeURIComponent(item.anchor.id)}`
      : `/returns/${item.returnId}`
    : undefined;

  return (
    <li>
      <Card
        // The tint is the aging signal, not an unread state: it fades as soon as
        // the item is answered, never when it is merely looked at.
        tone={hot ? "danger" : item.owner === "client" ? "warn" : "plain"}
        className="px-3.5 py-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            className="-m-1 flex min-w-0 flex-1 items-start gap-2 rounded-md p-1 text-left hover:bg-locksoft"
          >
            <span
              aria-hidden="true"
              className={cx(
                "mt-0.5 shrink-0 text-xs text-faint transition-transform",
                open && "rotate-90"
              )}
            >
              ▶
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">
                {item.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {item.clientName}
                {item.context && (
                  <span className="text-faint"> · {item.context}</span>
                )}
              </span>
            </span>
          </button>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <StatusChip status={item.status} />
            <OwnerBadge owner={item.owner} />
            <AgeChip days={item.daysWaiting} />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-5">
          <div className="flex flex-wrap items-center gap-2">
            {item.anchor && anchorHref && (
              <Link
                href={anchorHref}
                title={
                  item.anchor.kind === "line"
                    ? "Open the return at this line"
                    : "Open the return this is attached to"
                }
                className="rounded-full"
              >
                <Chip tone="accent" className="hover:border-accent">
                  <span aria-hidden="true">↳</span>
                  {item.anchor.label}
                </Chip>
              </Link>
            )}
            <span className="text-xs text-faint">
              asked by {item.askedBy} · {relativeTime(item.askedAt)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* A reminder only means something when the ball is in the client's
                court; on firm-owned rows we offer the action that closes it. */}
            {item.owner === "client" ? (
              <Button
                size="sm"
                onClick={() => onRemind(item.threadId, item.requestId)}
              >
                Send reminder
              </Button>
            ) : item.resolution ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => onResolve(item.threadId, item.requestId)}
              >
                Apply to line {item.resolution.writesToLine}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onResolve(item.threadId, item.requestId)}
              >
                Mark as done
              </Button>
            )}
            <Link href={`/returns/${item.returnId}/messages`}>
              <Button size="sm" variant="quiet">
                Open conversation
              </Button>
            </Link>
          </div>
        </div>

        {open && (
          <div
            id={panelId}
            className="mt-3 border-t border-hair pl-5 pt-3 text-sm leading-relaxed"
          >
            <p className="text-muted">{item.detail}</p>

            {item.anchor && anchorHref && (
              <p className="mt-2 text-xs text-muted">
                Anchored to{" "}
                <Link
                  href={anchorHref}
                  className="font-medium text-accentink hover:underline"
                >
                  {item.anchor.label}
                </Link>{" "}
                on {item.clientName}&rsquo;s return, so the answer lands on the
                number it belongs to.
              </p>
            )}

            {item.resolution && (
              <p className="mt-2 text-xs text-muted">
                When this closes, line{" "}
                <span className="tnum">{item.resolution.writesToLine}</span>{" "}
                becomes <span className="tnum">{item.resolution.value}</span> —{" "}
                {item.resolution.note}
              </p>
            )}
          </div>
        )}
      </Card>
    </li>
  );
}
