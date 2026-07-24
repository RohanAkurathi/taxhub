"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  OwnerBadge,
  SectionLabel,
  cx,
} from "@/components/ui";
import { ROLE, STAGE } from "@/lib/design";
import { daysSince, relativeTime } from "@/lib/mockData";
import { returnSummaryById } from "@/lib/mockVolume";
import { useStore } from "@/lib/store";
import type {
  RequestStatus,
  Role,
  Thread,
  ThreadItem,
  Visibility,
} from "@/lib/types";

/* ---------------------------------------------------------------------------
   One conversation per return (challenge 02).

   The fragmentation this screen removes is not "too many apps" — it is that a
   question, the answer to it, and the number it changes normally live in three
   different systems. So everything about this return is merged into a single
   chronological flow, and every item states what it is anchored to. A request
   card links to the exact line it settles, and resolving it writes the answer
   onto that line for real.

   The second idea here is that the permission boundary must be visible before
   you type, not after you send. Internal notes are a different shape, a
   different color, and the composer physically changes when you switch to
   them — and "Client's view" proves the boundary in one click.
--------------------------------------------------------------------------- */

type Entry = { item: ThreadItem; thread: Thread; at: string };

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Formatted by hand rather than with toLocaleDateString: the page is rendered
 *  on the server and again in the browser, and a locale/timezone difference
 *  between the two would produce a hydration mismatch on every day divider. */
function dayLabel(at: string): string {
  const days = daysSince(at);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  const d = new Date(at);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function itemTime(item: ThreadItem): string {
  return item.kind === "request" ? item.askedAt : item.at;
}

/**
 * What the firm keeps to itself: internal notes, and any request that is still
 * being worked between staff. A request the client has been asked to answer is
 * theirs to see, and so is one that has already been settled.
 */
function isInternal(item: ThreadItem): boolean {
  if (item.kind === "message") return item.visibility === "internal";
  if (item.kind === "request") return item.owner !== "client" && item.status !== "resolved";
  return false;
}

function avatarTone(role: Role): "accent" | "flag" | "ok" | "neutral" {
  if (role === "client") return "ok";
  if (role === "reviewer") return "flag";
  if (role === "preparer") return "accent";
  return "neutral";
}

/** @mentions are the one piece of formatting internal notes actually use. */
function withMentions(body: string) {
  return body.split(/(@[A-Za-z][\w'-]*)/g).map((part, i) =>
    part.startsWith("@") ? (
      <strong key={i} className="font-semibold text-ink">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const REQUEST_STATUS: Record<
  RequestStatus,
  { staff: string; client: string; tone: "accent" | "warn" | "ok" }
> = {
  asked: { staff: "Asked", client: "We've asked", tone: "accent" },
  waiting: { staff: "Waiting on the client", client: "Waiting on you", tone: "warn" },
  answered: { staff: "Answered — needs you", client: "Answered", tone: "accent" },
  resolved: { staff: "Settled", client: "Done", tone: "ok" },
};

/* -------------------------------------------------------------------------- */

export default function Page(props: PageProps<"/returns/[id]/messages">) {
  const { id } = use(props.params);
  const { threads, getReturn, role, sendMessage, resolveRequest, remindRequest } =
    useStore();

  const ret = getReturn(id);
  const summary = returnSummaryById(id);
  const clientName = ret?.clientName ?? summary?.clientName ?? "This client";
  const firstName = clientName.split(" ")[0];

  // A client can only ever be in the client's view, so there is nothing to
  // toggle for them — the control is simply absent rather than disabled.
  const [previewClient, setPreviewClient] = useState(false);
  const clientView = previewClient || role === "client";

  const returnThreads = useMemo(
    () => threads.filter((t) => t.returnId === id),
    [threads, id]
  );

  const entries = useMemo(() => {
    const all: Entry[] = returnThreads.flatMap((thread) =>
      thread.items.map((item) => ({ item, thread, at: itemTime(item) }))
    );
    return all.sort((a, b) => a.at.localeCompare(b.at));
  }, [returnThreads]);

  const visibleEntries = clientView ? entries.filter((e) => !isInternal(e.item)) : entries;

  const openCount = visibleEntries.filter(
    (e) => e.item.kind === "request" && e.item.status !== "resolved"
  ).length;

  const days = useMemo(() => {
    const out: { key: string; label: string; entries: Entry[] }[] = [];
    for (const e of entries) {
      const key = new Date(e.at).toDateString();
      const last = out[out.length - 1];
      if (last && last.key === key) last.entries.push(e);
      else out.push({ key, label: dayLabel(e.at), entries: [e] });
    }
    return out;
  }, [entries]);

  const crumbs = [
    { label: "Dashboard", href: "/dashboard" },
    { label: clientName, href: `/returns/${id}` },
    { label: "Conversation" },
  ];

  const right = (
    <div className="flex items-center gap-2">
      <Chip tone={openCount ? "warn" : "ok"}>
        {openCount} open request{openCount === 1 ? "" : "s"}
      </Chip>
      {role !== "client" && (
        <button
          onClick={() => setPreviewClient((v) => !v)}
          aria-pressed={previewClient}
          title="See this conversation exactly as the client sees it"
          className={cx(
            "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
            previewClient
              ? "border-okedge bg-oksoft text-ok"
              : "border-line bg-canvas text-muted hover:border-lockedge"
          )}
        >
          Client&rsquo;s view
        </button>
      )}
    </div>
  );

  if (!returnThreads.length) {
    // No toggle here: with nothing in the thread, "Client's view" would change
    // nothing on screen, and a control that does nothing is worse than none.
    return (
      <Shell crumbs={crumbs}>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <EmptyState
            title="No conversation on this return yet"
            detail={
              ret
                ? `Nothing has been asked or noted on ${clientName}'s return. Questions raised on a line start a conversation here.`
                : "This return is part of the firm's wider book. Only the three demo returns carry a full conversation."
            }
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
    <Shell crumbs={crumbs} right={right}>
      <div className="mx-auto max-w-3xl px-6 py-7">
        {/* Header ------------------------------------------------------- */}
        <SectionLabel>Conversation</SectionLabel>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{clientName}</h1>
          {ret && (
            <>
              <Chip tone="neutral">
                {ret.formType} · {ret.taxYear}
              </Chip>
              <Chip tone="accent">
                {clientView ? STAGE[ret.stage].client : STAGE[ret.stage].staff}
              </Chip>
            </>
          )}
          <Link
            href={`/returns/${id}`}
            className="text-sm text-accentink hover:underline"
          >
            Open the return →
          </Link>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {clientView
            ? `Everything ${firstName} can see about this return, in one place.`
            : `Every question, note and answer on this return — client-facing and firm-only — in one thread.`}
        </p>

        {clientView && (
          <div className="mt-4 rounded-lg border border-okedge bg-oksoft px-3.5 py-2.5 text-sm text-ok">
            <span className="font-medium">This is exactly what {firstName} sees.</span>{" "}
            Internal notes and firm-only requests are hidden, and the reply box is
            replaced by {firstName}&rsquo;s own.
          </div>
        )}

        {/* Conversation -------------------------------------------------- */}
        <div className="mt-6 space-y-6">
          {days.map((day) => (
            <section key={day.key}>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
                  {day.label}
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="space-y-3">
                <DayItems
                  entries={day.entries}
                  returnId={id}
                  clientView={clientView}
                  firstName={firstName}
                  onRemind={remindRequest}
                  onResolve={resolveRequest}
                />
              </div>
            </section>
          ))}
        </div>

        {/* Composer ------------------------------------------------------ */}
        <div className="mt-7">
          {clientView ? (
            <ClientReplies entries={visibleEntries} onResolve={resolveRequest} />
          ) : (
            <Composer
              threads={returnThreads}
              firstName={firstName}
              onSend={sendMessage}
            />
          )}
        </div>
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */
/* The flow                                                                    */
/* -------------------------------------------------------------------------- */

function DayItems({
  entries,
  returnId,
  clientView,
  firstName,
  onRemind,
  onResolve,
}: {
  entries: Entry[];
  returnId: string;
  clientView: boolean;
  firstName: string;
  onRemind: (threadId: string, requestId: string) => void;
  onResolve: (threadId: string, requestId: string, answer?: string) => void;
}) {
  // In the client's view, consecutive firm-only items collapse into a single
  // marker. Showing the gap rather than silently closing it is the point: the
  // client's view is a redaction of one conversation, not a second one.
  const rows: (Entry | { hidden: Entry[] })[] = [];
  for (const e of entries) {
    if (clientView && isInternal(e.item)) {
      const last = rows[rows.length - 1];
      if (last && "hidden" in last) last.hidden.push(e);
      else rows.push({ hidden: [e] });
    } else {
      rows.push(e);
    }
  }

  return (
    <>
      {rows.map((row, i) => {
        if ("hidden" in row) return <HiddenMarker key={`h-${i}`} hidden={row.hidden} />;
        const { item, thread } = row;

        if (item.kind === "system") return <SystemLine key={item.id} item={item} />;

        if (item.kind === "request")
          return (
            <RequestCard
              key={item.id}
              item={item}
              threadId={thread.id}
              anchor={item.anchor ?? thread.anchor}
              returnId={returnId}
              clientView={clientView}
              firstName={firstName}
              onRemind={onRemind}
              onResolve={onResolve}
            />
          );

        if (item.visibility === "internal")
          return <InternalNote key={item.id} item={item} />;

        return <Bubble key={item.id} item={item} clientView={clientView} />;
      })}
    </>
  );
}

function HiddenMarker({ hidden }: { hidden: Entry[] }) {
  const notes = hidden.filter((h) => h.item.kind === "message").length;
  const requests = hidden.length - notes;
  const parts: string[] = [];
  if (notes) parts.push(`${notes} internal note${notes === 1 ? "" : "s"}`);
  if (requests) parts.push(`${requests} firm-only request${requests === 1 ? "" : "s"}`);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs text-faint">
      <span aria-hidden="true">⊘</span>
      <span>{parts.join(" and ")} hidden</span>
    </div>
  );
}

function SystemLine({ item }: { item: Extract<ThreadItem, { kind: "system" }> }) {
  return (
    <p className="flex items-baseline gap-2 px-1 text-xs text-faint">
      <span aria-hidden="true">⊙</span>
      <span className="flex-1">{item.body}</span>
      <span className="shrink-0">{relativeTime(item.at)}</span>
    </p>
  );
}

function InternalNote({ item }: { item: Extract<ThreadItem, { kind: "message" }> }) {
  return (
    <div className="ml-10 rounded-r-lg border-l-2 border-warnedge bg-warnsoft/50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span aria-hidden="true" className="text-warn">
          ⊘
        </span>
        <span className="font-semibold text-warn">Firm only</span>
        <span className="text-lockedge" aria-hidden="true">
          ·
        </span>
        <span className="font-medium text-ink">{item.author}</span>
        <span className="text-faint">{ROLE[item.authorRole].label}</span>
        <span className="text-faint">{relativeTime(item.at)}</span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-ink">{withMentions(item.body)}</p>
    </div>
  );
}

function Bubble({
  item,
  clientView,
}: {
  item: Extract<ThreadItem, { kind: "message" }>;
  clientView: boolean;
}) {
  // "Mine" flips with the view, so the direction of a message is always read
  // from the position of whoever is looking at the screen.
  const fromClient = item.authorRole === "client";
  const mine = clientView ? fromClient : !fromClient;

  return (
    <div className={cx("flex items-start gap-2", mine && "flex-row-reverse")}>
      <Avatar name={item.author} size={28} tone={avatarTone(item.authorRole)} />
      <div className="max-w-[80%]">
        <div
          className={cx(
            "flex items-baseline gap-2 text-xs",
            mine && "flex-row-reverse"
          )}
        >
          <span className="font-medium text-ink">{item.author}</span>
          <span className="text-faint">{ROLE[item.authorRole].label}</span>
          <span className="text-faint">{relativeTime(item.at)}</span>
        </div>
        <div
          className={cx(
            "mt-1 rounded-xl border px-3 py-2 text-sm leading-relaxed",
            mine
              ? "border-accentedge bg-accentsoft text-ink"
              : "border-line bg-canvas text-ink"
          )}
        >
          {item.body}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Requests — the bridge between the conversation and the return               */
/* -------------------------------------------------------------------------- */

function RequestCard({
  item,
  threadId,
  anchor,
  returnId,
  clientView,
  firstName,
  onRemind,
  onResolve,
}: {
  item: Extract<ThreadItem, { kind: "request" }>;
  threadId: string;
  anchor: Thread["anchor"];
  returnId: string;
  clientView: boolean;
  firstName: string;
  onRemind: (threadId: string, requestId: string) => void;
  onResolve: (threadId: string, requestId: string, answer?: string) => void;
}) {
  const resolved = item.status === "resolved";
  const status = REQUEST_STATUS[item.status];
  const tone = resolved ? "ok" : item.owner === "client" ? "warn" : "plain";

  return (
    <Card tone={tone} className="p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={status.tone}>{clientView ? status.client : status.staff}</Chip>
        {!clientView && <OwnerBadge owner={item.owner} />}
        <span className="ml-auto text-xs text-faint">
          Asked by {item.askedBy} · {relativeTime(item.askedAt)}
        </span>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-ink">{item.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{item.detail}</p>

      {anchor && (
        <div className="mt-2.5">
          <AnchorChip anchor={anchor} returnId={returnId} clientView={clientView} />
        </div>
      )}

      {resolved && (
        <p className="mt-2.5 rounded-lg border border-okedge bg-oksoft px-3 py-2 text-xs leading-relaxed text-ok">
          <span className="font-semibold">Answered.</span>{" "}
          {item.resolution
            ? clientView
              ? `Thanks — we've applied your answer to your return, and nothing is holding it up any more.`
              : `${item.resolution.value} was written to line ${item.resolution.writesToLine} on the return, and the flag there is cleared. ${item.resolution.note}`
            : clientView
            ? "Thanks — nothing further is needed from you on this."
            : "Nothing on the return needed to change."}
        </p>
      )}

      {/* Actions. A request with nothing a person can do about it here renders
          no buttons at all rather than disabled ones. */}
      {!resolved && !clientView && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.owner === "client" ? (
            <>
              <Button size="sm" onClick={() => onRemind(threadId, item.id)}>
                Send reminder
              </Button>
              <Button
                size="sm"
                variant="primary"
                title="Demo shortcut: applies the answer exactly as the client replying would"
                onClick={() => onResolve(threadId, item.id)}
              >
                Simulate {firstName} answering
              </Button>
            </>
          ) : item.resolution ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onResolve(threadId, item.id)}
            >
              Apply the answer to line {item.resolution.writesToLine}
            </Button>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/**
 * The bidirectional link. A request names the line it settles, and clicking it
 * lands on that exact line of the return — which is what stops a conversation
 * and a number from being two separate objects.
 */
function AnchorChip({
  anchor,
  returnId,
  clientView,
}: {
  anchor: NonNullable<Thread["anchor"]>;
  returnId: string;
  clientView: boolean;
}) {
  // A client never reads "line 2b" — they read what the number is.
  const plain = anchor.label.split("·").pop()!.trim();

  if (clientView || anchor.kind !== "line") {
    return <Chip tone="neutral">{clientView ? plain : anchor.label}</Chip>;
  }

  return (
    <Link
      href={`/returns/${returnId}?line=${anchor.id}`}
      aria-label={`Open ${anchor.label} on the return`}
      className="inline-block rounded-full transition-opacity hover:opacity-80"
    >
      <Chip tone="accent" title="Jump to this line on the return">
        <span aria-hidden="true">↗</span>
        {anchor.label}
      </Chip>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Composers                                                                   */
/* -------------------------------------------------------------------------- */

function Composer({
  threads,
  firstName,
  onSend,
}: {
  threads: Thread[];
  firstName: string;
  onSend: (threadId: string, body: string, visibility: Visibility) => void;
}) {
  const [tab, setTab] = useState<Visibility>("client");
  const [body, setBody] = useState("");
  // A return can have several conversations anchored to different lines. The
  // reply defaults to the most recently active one, and the anchor is always
  // named — you can never post into a context you cannot see.
  const [threadId, setThreadId] = useState(() => mostRecent(threads).id);

  const internal = tab === "internal";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    onSend(threadId, text, tab);
    setBody("");
  }

  return (
    <form
      onSubmit={submit}
      className={cx(
        "rounded-xl border-2 p-3 transition-colors",
        internal ? "border-warnedge bg-warnsoft/30" : "border-accentedge bg-canvas"
      )}
    >
      <div role="tablist" aria-label="Who will read this" className="flex gap-1.5">
        {(
          [
            { key: "client" as const, label: `Reply to ${firstName}` },
            { key: "internal" as const, label: "Internal note" },
          ]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              tab === t.key
                ? t.key === "internal"
                  ? "border-warnedge bg-warnsoft text-warn"
                  : "border-accentedge bg-accentsoft text-accentink"
                : "border-transparent text-muted hover:bg-locksoft"
            )}
          >
            {t.key === "internal" && (
              <span aria-hidden="true" className="mr-1">
                ⊘
              </span>
            )}
            {t.label}
          </button>
        ))}
      </div>

      {threads.length > 1 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-faint">About</span>
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === threadId}
              onClick={() => setThreadId(t.id)}
              className={cx(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                t.id === threadId
                  ? "border-lockedge bg-locksoft text-ink"
                  : "border-line bg-canvas text-muted hover:border-lockedge"
              )}
            >
              {t.anchor?.label ?? "This return"}
            </button>
          ))}
        </div>
      )}

      <label className="sr-only" htmlFor="composer-body">
        {internal ? "Internal note" : `Reply to ${firstName}`}
      </label>
      <textarea
        id="composer-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        rows={3}
        placeholder={
          internal
            ? "Notes for the file, or a question for a colleague. Use @ to mention someone."
            : `Write to ${firstName} in plain language.`
        }
        className={cx(
          "mt-2.5 w-full resize-none rounded-lg border bg-canvas px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-faint",
          internal ? "border-warnedge" : "border-line"
        )}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p
          className={cx(
            "flex items-center gap-1.5 text-xs font-medium",
            internal ? "text-warn" : "text-accentink"
          )}
        >
          <span aria-hidden="true">{internal ? "⊘" : "●"}</span>
          {internal
            ? "Only GreenGrowth staff will ever see this."
            : `${firstName} will see this and get an email.`}
        </p>
        <Button type="submit" variant="primary" size="sm" disabled={!body.trim()}>
          {internal ? "Save internal note" : `Send to ${firstName}`}
        </Button>
      </div>
    </form>
  );
}

function mostRecent(threads: Thread[]): Thread {
  return threads.reduce((best, t) => {
    const latest = (x: Thread) =>
      x.items.reduce((m, i) => (itemTime(i) > m ? itemTime(i) : m), "");
    return latest(t) > latest(best) ? t : best;
  }, threads[0]);
}

/* -------------------------------------------------------------------------- */

/** What replaces the composer in the client's view: their side of the screen. */
function ClientReplies({
  entries,
  onResolve,
}: {
  entries: Entry[];
  onResolve: (threadId: string, requestId: string, answer?: string) => void;
}) {
  const [typed, setTyped] = useState<Record<string, string>>({});

  const open = entries.filter(
    (e): e is Entry & { item: Extract<ThreadItem, { kind: "request" }> } =>
      e.item.kind === "request" && e.item.status !== "resolved"
  );

  if (!open.length) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted">
          Nothing needs you right now. We&rsquo;ll message you here if that changes.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <SectionLabel>Your reply</SectionLabel>
      {open.map(({ item, thread }) => {
        const key = item.id;
        const value = typed[key] ?? "";
        // Only the replies that actually carry an answer are offered as one
        // tap. "Let me type it" is the input below, not a button that would
        // settle a number nobody confirmed.
        const oneTap = item.quickReplies?.filter((r) => /\d/.test(r)) ?? [];
        return (
          <Card key={key} tone="warn" className="p-3.5">
            <p className="text-sm font-medium text-ink">{item.title}</p>
            {oneTap.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {oneTap.map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant="primary"
                    onClick={() => onResolve(thread.id, item.id, r)}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const answer = value.trim();
                if (!answer) return;
                onResolve(thread.id, item.id, answer);
                setTyped((t) => ({ ...t, [key]: "" }));
              }}
              className="mt-2.5 flex gap-2"
            >
              <label className="sr-only" htmlFor={`answer-${key}`}>
                Your answer to: {item.title}
              </label>
              <input
                id={`answer-${key}`}
                value={value}
                onChange={(e) => setTyped((t) => ({ ...t, [key]: e.target.value }))}
                placeholder="Or type your answer"
                className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm text-ink placeholder:text-faint"
              />
              <Button type="submit" size="sm" disabled={!value.trim()}>
                Send
              </Button>
            </form>
          </Card>
        );
      })}
    </div>
  );
}
