"use client";

import { useState } from "react";
import { Shell } from "@/components/Shell";
import { Avatar, Button, Card, Chip, EmptyState } from "@/components/ui";
import { relativeTime } from "@/lib/mockData";
import { useStore } from "@/lib/store";
import type { Thread, ThreadItem } from "@/lib/types";

/* ---------------------------------------------------------------------------
   The client's side of the conversation (challenge 02).

   This is the same thread the firm reads, with the internal layer removed —
   one conversation, filtered, rather than two conversations that can tell
   different stories. The filter is a single rule applied at the top of the
   render: anything a colleague wrote to a colleague never reaches this page.

   Requests the firm owns are not shown verbatim either. They are written for
   staff ("add to the return"), so the client gets the fact — we're on it —
   without the internal phrasing.
--------------------------------------------------------------------------- */

const RETURN_ID = "ret-chen-2025";

/** What a conversation is about, in the client's words. */
const PLAIN_SUBJECT: Record<string, string> = {
  "12b": "Your charitable donations",
  "19": "The credit for your daughter",
  "1a": "Your pay",
  "3b": "Your investment income",
  "25a": "Tax already taken from your pay",
  "q-chen-3": "Your family details",
};

function subjectOf(thread: Thread): string {
  if (!thread.anchor) return "Your return";
  return PLAIN_SUBJECT[thread.anchor.id] ?? "Your return";
}

/** The permission boundary, in one line. */
function clientVisible(items: ThreadItem[]): ThreadItem[] {
  return items.filter((i) => i.kind !== "message" || i.visibility !== "internal");
}

export default function ClientMessages() {
  const { getReturn, threads } = useStore();
  const ret = getReturn(RETURN_ID);

  const crumbs = [
    { label: "Your 2025 return", href: "/home" },
    { label: "Messages" },
  ];

  if (!ret) {
    return (
      <Shell crumbs={crumbs}>
        <EmptyState title="We couldn't open your messages" />
      </Shell>
    );
  }

  const myThreads = threads
    .filter((t) => t.returnId === RETURN_ID)
    .map((t) => ({ thread: t, items: clientVisible(t.items) }))
    .filter((t) => t.items.length > 0);

  const waitingOnYou = myThreads.reduce(
    (n, { items }) =>
      n +
      items.filter(
        (i) => i.kind === "request" && i.owner === "client" && i.status !== "resolved"
      ).length,
    0
  );

  return (
    <Shell crumbs={crumbs}>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {ret.preparerName} is preparing your return. Anything you write here goes
          straight to them.
        </p>
        {waitingOnYou > 0 && (
          <p className="mt-2.5">
            <Chip tone="warn">
              {waitingOnYou} question{waitingOnYou === 1 ? "" : "s"} waiting on you
            </Chip>
          </p>
        )}

        <div className="mt-6 space-y-4">
          {myThreads.map(({ thread, items }) => (
            <Card key={thread.id} className="p-0">
              <div className="border-b border-hair px-5 py-3">
                <h2 className="text-sm font-semibold">{subjectOf(thread)}</h2>
              </div>

              <div className="space-y-4 px-5 py-4">
                {items.map((item) => (
                  <Item
                    key={item.id}
                    item={item}
                    threadId={thread.id}
                    clientName={ret.clientName}
                  />
                ))}
              </div>

              <Composer threadId={thread.id} />
            </Card>
          ))}

          {myThreads.length === 0 && (
            <Card>
              <EmptyState
                title="No messages yet"
                detail="When we need something, or you have a question, it will show up here."
              />
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */

function Item({
  item,
  threadId,
  clientName,
}: {
  item: ThreadItem;
  threadId: string;
  clientName: string;
}) {
  const { resolveRequest } = useStore();

  if (item.kind === "system") {
    return (
      <p className="text-center text-xs text-faint">
        {item.body} · {relativeTime(item.at)}
      </p>
    );
  }

  if (item.kind === "message") {
    // Anything written from the client side of the wall is "you" — the demo
    // account name belongs to the signed-in person, not to a third party.
    const mine = item.authorRole === "client" || item.author === clientName;
    return (
      <div className="flex gap-3">
        <Avatar name={item.author} size={28} tone={mine ? "ok" : "accent"} />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 text-sm font-medium">
            {mine ? "You" : item.author}
            <span className="text-xs font-normal text-faint">
              {relativeTime(item.at)}
            </span>
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-ink">{item.body}</p>
        </div>
      </div>
    );
  }

  /* A request the firm is holding. The client gets the state, not the
     staff-worded task. */
  if (item.owner !== "client") {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-panel px-3.5 py-2.5">
        <Chip tone={item.status === "resolved" ? "ok" : "accent"}>
          {item.status === "resolved" ? "Sorted" : "We're on it"}
        </Chip>
        <p className="text-sm text-muted">Nothing needed from you here.</p>
      </div>
    );
  }

  if (item.status === "resolved") {
    return (
      <div className="rounded-lg border border-okedge bg-oksoft px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="ok">Answered</Chip>
          <span className="text-xs text-faint">
            {item.resolvedAt ? relativeTime(item.resolvedAt) : ""}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-ink">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          Thank you — we&apos;ve got what we need.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-accentedge bg-canvas px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="warn">Your turn</Chip>
        <span className="text-xs text-faint">
          {item.askedBy} asked {relativeTime(item.askedAt)}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug">{item.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{item.detail}</p>
      {item.quickReplies && item.quickReplies.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.quickReplies.map((r, i) => (
            <Button
              key={r}
              variant={i === 0 ? "primary" : "default"}
              onClick={() => resolveRequest(threadId, item.id, r)}
            >
              {r}
            </Button>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-faint">
        Or write your own answer below — either works.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Composer({ threadId }: { threadId: string }) {
  const { sendMessage } = useStore();
  const [body, setBody] = useState("");

  return (
    <form
      className="flex items-end gap-2 border-t border-hair bg-panel px-5 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        const text = body.trim();
        if (!text) return;
        // Never "internal" from this side of the wall — a client cannot write
        // a note the firm hides from them.
        sendMessage(threadId, text, "client");
        setBody("");
      }}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={`reply-${threadId}`} className="sr-only">
          Write a reply
        </label>
        <textarea
          id={`reply-${threadId}`}
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a reply…"
          className="w-full resize-none rounded-md border border-line bg-canvas px-3 py-2 text-sm placeholder:text-faint"
        />
      </div>
      <Button type="submit" variant="primary" disabled={!body.trim()}>
        Send
      </Button>
    </form>
  );
}
