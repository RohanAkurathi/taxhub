"use client";

import Link from "next/link";
import { Shell } from "@/components/Shell";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ProgressBar,
  SectionLabel,
  cx,
} from "@/components/ui";
import {
  CLIENT_JOURNEY,
  STAGE,
  clientMilestoneIndex,
  formatMoney,
} from "@/lib/design";
import { documentsFor, relativeTime, tasksFor } from "@/lib/mockData";
import { useStore } from "@/lib/store";
import type { ClientTask, Stage, ThreadItem } from "@/lib/types";

/* ---------------------------------------------------------------------------
   The client's home — challenge 03, and the client half of challenge 06.

   Two jobs, in this order:
     1. Orientation. The journey strip sits above everything as permanent
        context, so "where is my return, and whose move is it" is answered
        before anything is asked of you.
     2. One action. Exactly one item is dominant at a time; everything else is
        deliberately quiet.

   Vocabulary note: this page reads the same `stage` and `owner` values the
   firm's screens read, then renders them through a client dictionary — the
   STAGE.staff / STAGE.client split, extended to ownership. OWNER_LABEL is the
   firm's phrasing ("Your move" means the preparer's move), which would be
   actively wrong here. One pipeline, two vocabularies, no second status field
   that can drift out of sync.
--------------------------------------------------------------------------- */


const JOURNEY_COPY: Record<Stage, { turn: string; detail: string }> = {
  docs_pending: { turn: "Your turn", detail: "You send us your forms" },
  extracting: { turn: "Our turn", detail: "We read through what you sent" },
  in_preparation: { turn: "Our turn", detail: "We fill in your return" },
  in_review: { turn: "Our turn", detail: "A second accountant checks our work" },
  ready_to_file: { turn: "Your turn", detail: "You sign, then we send it in" },
  filed: { turn: "All done", detail: "Your return is with the IRS" },
};

const TASK_CTA: Record<ClientTask["kind"], string> = {
  upload: "Add your file",
  questionnaire: "Answer the questions",
  esign: "Read it over and sign",
  review: "Confirm this",
};

type OpenQuestion = {
  threadId: string;
  request: Extract<ThreadItem, { kind: "request" }>;
};

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export default function ClientHome() {
  const { getReturn, tasks, threads, completeTask, resolveRequest, clientReturnId } = useStore();
  const ret = getReturn(clientReturnId);

  if (!ret) {
    return (
      <Shell crumbs={[{ label: "Your 2025 return" }]}>
        <EmptyState
          title="We couldn't open your return"
          detail="Give us a moment and try again, or send us a message."
        />
      </Shell>
    );
  }

  // tasksFor() is the frozen seed; the store holds the live copy that
  // completeTask writes to. Reading order from one and status from the other
  // keeps the list stable while still reacting to a click.
  const myTasks = tasksFor(clientReturnId).map(
    (seed) => tasks.find((t) => t.id === seed.id) ?? seed
  );
  const doneTasks = myTasks.filter((t) => t.status === "done");
  const openTasks = myTasks.filter((t) => t.status !== "done");
  const nextTask = openTasks[0];
  const minutesLeft = openTasks.reduce((s, t) => s + (t.estimateMinutes ?? 0), 0);

  // A question the firm has asked and is waiting on is just as much "your
  // move" as an unfinished checklist item — so it belongs on this page, not
  // only in Messages. Without it, the calm panel below would be a lie.
  const questions: OpenQuestion[] = threads
    .filter((t) => t.returnId === clientReturnId)
    .flatMap((t) => t.items.map((item) => ({ threadId: t.id, item })))
    .filter(
      (x): x is { threadId: string; item: Extract<ThreadItem, { kind: "request" }> } =>
        x.item.kind === "request" &&
        x.item.owner === "client" &&
        x.item.status !== "resolved"
    )
    .map((x) => ({ threadId: x.threadId, request: x.item }));

  const milestone = clientMilestoneIndex(ret.stage);
  const nothingOutstanding = questions.length === 0 && openTasks.length === 0;
  // Exactly one thing on this page is ever loud. A question outranks a
  // checklist item, because a person is already waiting on the answer — so
  // when one is open, even the next task drops back to a quiet row.
  const quietQuestions = questions.slice(1);
  const dominantTask = questions.length === 0 ? nextTask : undefined;
  const listTasks = myTasks.filter((t) => t.id !== dominantTask?.id);
  const docCount = documentsFor(clientReturnId).length;
  // Steps still ahead. Sliced past the current milestone, because the strip
  // above already says "you are here" — repeating it under "what happens next"
  // reads as though the current stage hasn't started. At `filed` this is empty,
  // which is why the block below is conditional rather than always rendered.
  const upcoming = CLIENT_JOURNEY.slice(milestone + 1);

  const secondLine = questions.length
    ? `There ${plural(questions.length, "is one question", `are ${questions.length} questions`)} waiting for you below.`
    : openTasks.length
    ? `${openTasks.length} ${plural(openTasks.length, "thing is", "things are")} still on your list.`
    : "Nothing needed from you right now.";

  return (
    <Shell crumbs={[{ label: "Your 2025 return" }]}>
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header ------------------------------------------------------- */}
        <SectionLabel>{ret.clientName} · tax year {ret.taxYear}</SectionLabel>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Your {ret.taxYear} return
        </h1>
        <p className="mt-2 text-[17px] leading-relaxed text-ink">
          {/*
            Once the client has finished their part, saying "we need documents
            from you" is simply untrue — the stage has not advanced yet on the
            firm's side, but from where the client is standing the handover has
            already happened, and the sentence has to say so.
          */}
          {nothingOutstanding && ret.stage === "docs_pending"
            ? "Thank you — that's everything we needed."
            : `${STAGE[ret.stage].client}.`}{" "}
          <span className="text-muted">{secondLine}</span>
        </p>
        <p className="mt-1.5 text-sm text-muted">
          {ret.preparerName} is looking after it · last update{" "}
          {relativeTime(ret.lastActivity)}
        </p>

        {/* Journey ------------------------------------------------------ */}
        <Card className="mt-6 p-5">
          <SectionLabel>How your return is going</SectionLabel>
          <ol className="mt-3 grid gap-4 sm:grid-cols-5">
            {CLIENT_JOURNEY.map((m, i) => {
              const done = i < milestone;
              const current = i === milestone;
              const copy = JOURNEY_COPY[m.key];
              return (
                <li key={m.key} aria-current={current ? "step" : undefined}>
                  <div
                    className={cx(
                      "h-1.5 w-full rounded-full",
                      done ? "bg-ok" : current ? "bg-accent" : "bg-hair"
                    )}
                  />
                  <p
                    className={cx(
                      "mt-2 flex items-center gap-1.5 text-sm font-medium",
                      done ? "text-ok" : current ? "text-accentink" : "text-faint"
                    )}
                  >
                    {done && <span aria-hidden="true">✓</span>}
                    {m.label}
                  </p>
                  <p
                    className={cx(
                      "mt-0.5 text-xs leading-relaxed",
                      current ? "text-muted" : "text-faint"
                    )}
                  >
                    {copy.detail}
                  </p>
                  {current ? (
                    <span className="mt-1.5 inline-flex items-center rounded-full border border-accentedge bg-accentsoft px-2 py-0.5 text-[11px] font-semibold text-accentink">
                      You are here
                    </span>
                  ) : (
                    <span
                      className={cx(
                        "mt-1.5 block text-[11px] font-medium",
                        done ? "text-ok" : "text-faint"
                      )}
                    >
                      {done ? "Done" : copy.turn}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {/* Actions -------------------------------------------------- */}
          <div className="lg:col-span-2">
            {nothingOutstanding ? (
              /* The page's second life. Once onboarding is finished, a
                 checklist with nothing on it is noise — so the same space
                 becomes reassurance instead. */
              <Card tone="ok" className="p-6">
                <h2 className="text-lg font-semibold text-ok">
                  Nothing needed from you right now
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">
                  We&apos;ll email you the moment it&apos;s your turn again. You
                  don&apos;t need to check back.
                </p>
                {upcoming.length > 0 && (
                  <div className="mt-4 border-t border-okedge pt-3">
                    <SectionLabel>What happens next</SectionLabel>
                    <ol className="mt-2 space-y-2">
                      {upcoming.map((m, i) => (
                        <li key={m.key} className="flex gap-2.5 text-sm">
                          <span className="tnum mt-0.5 text-xs text-faint">
                            {i + 1}
                          </span>
                          <span>
                            <span className="font-medium">{m.label}</span>
                            <span className="block text-xs text-muted">
                              {JOURNEY_COPY[m.key].detail} ·{" "}
                              {JOURNEY_COPY[m.key].turn.toLowerCase()}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </Card>
            ) : questions.length > 0 ? (
              <div className="space-y-3">
                <SectionLabel>
                  {questions.length === 1
                    ? "A question for you"
                    : "Questions for you"}
                </SectionLabel>
                <NextQuestion
                  q={questions[0]}
                  onAnswer={(reply) =>
                    resolveRequest(questions[0].threadId, questions[0].request.id, reply)
                  }
                />
                {quietQuestions.length > 0 && (
                  <Card className="divide-y divide-hair p-0">
                    {quietQuestions.map((q) => (
                      <QuietRow
                        key={q.request.id}
                        title={q.request.title}
                        detail="We'll come back to this once you've answered the one above."
                      />
                    ))}
                  </Card>
                )}
              </div>
            ) : null}

            {/* Checklist ------------------------------------------------ */}
            <div className={nothingOutstanding || questions.length > 0 ? "mt-6" : ""}>
              <div className="flex items-baseline justify-between gap-3">
                <SectionLabel>Your checklist</SectionLabel>
                <p className="tnum text-xs text-muted">
                  {doneTasks.length} of {myTasks.length} done
                  {openTasks.length
                    ? ` · about ${minutesLeft} ${plural(minutesLeft, "minute", "minutes")} left`
                    : " · nothing left to do"}
                </p>
              </div>
              <div className="mt-2">
                <ProgressBar
                  value={
                    myTasks.length ? (doneTasks.length / myTasks.length) * 100 : 0
                  }
                  tone="ok"
                />
              </div>

              {/* The one task that is your move gets the whole treatment:
                  bigger, bordered, and the only primary button on the page. */}
              {dominantTask && (
                <div className="mt-3">
                  <NextTask
                    task={dominantTask}
                    onDone={() => completeTask(dominantTask.id)}
                  />
                </div>
              )}

              {listTasks.length > 0 && (
                <Card className="mt-3 divide-y divide-hair p-0">
                  {listTasks.map((t) =>
                    t.status === "done" ? (
                      /* Finished work collapses to a single green line. It stays
                         visible because "did I already do that?" is the second
                         question a client asks. */
                      <div
                        key={t.id}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm"
                      >
                        <span aria-hidden="true" className="text-ok">
                          ✓
                        </span>
                        <span className="min-w-0 flex-1 truncate text-muted">
                          {t.title}
                        </span>
                        <span className="shrink-0 text-xs text-faint">
                          {t.completedAt ? relativeTime(t.completedAt) : "done"}
                        </span>
                      </div>
                    ) : (
                      <QuietRow
                        key={t.id}
                        title={t.title}
                        detail={t.help}
                        optional={t.optional}
                      />
                    )
                  )}
                </Card>
              )}
            </div>
          </div>

          {/* Side rail ------------------------------------------------- */}
          <div className="space-y-4">
            {ret.outcome && (
              <Card className="p-5">
                <SectionLabel>
                  {ret.outcome.kind === "refund"
                    ? "Your estimated refund"
                    : "What you'll likely owe"}
                </SectionLabel>
                <p className="tnum mt-1.5 text-3xl font-semibold tracking-tight">
                  {formatMoney(ret.outcome.amount)}
                </p>
                {ret.outcome.provisional && (
                  <div className="mt-2">
                    <Chip tone="warn">Estimate — this can still change</Chip>
                  </div>
                )}
                <p className="mt-2.5 text-xs leading-relaxed text-muted">
                  This is our best guess while we finish. If it changes,
                  we&apos;ll tell you why.
                </p>
                <Link
                  href="/home/return"
                  className="mt-3 inline-block text-sm font-medium text-accentink hover:underline"
                >
                  See what&apos;s on your return →
                </Link>
              </Card>
            )}

            <Card className="p-0">
              <Link
                href="/home/documents"
                className="block border-b border-hair px-4 py-3 hover:bg-panel"
              >
                <p className="text-sm font-medium">Your documents</p>
                <p className="mt-0.5 text-xs text-muted">
                  {docCount} {plural(docCount, "thing", "things")}{" "}
                  you&apos;ve sent us
                </p>
              </Link>
              <Link href="/home/messages" className="block px-4 py-3 hover:bg-panel">
                <p className="flex items-center gap-2 text-sm font-medium">
                  Messages
                  {questions.length > 0 && (
                    <Chip tone="warn">
                      {questions.length}{" "}
                      {plural(questions.length, "question", "questions")}
                    </Chip>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Talk to {ret.preparerName.split(" ")[0]} about anything
                </p>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */

function NextQuestion({
  q,
  onAnswer,
}: {
  q: OpenQuestion;
  onAnswer: (reply: string) => void;
}) {
  const replies = q.request.quickReplies ?? [];
  // A plain element rather than <Card>: the dominant action owns its own
  // border weight, and overriding a Card's border color would depend on
  // stylesheet ordering rather than intent.
  return (
    <div className="rounded-xl border-2 border-accentedge bg-canvas p-5">
      <Chip tone="warn">Your turn</Chip>
      <h2 className="mt-2.5 text-lg font-semibold leading-snug">
        {q.request.title}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{q.request.detail}</p>
      {replies.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {replies.map((r, i) => (
            <Button
              key={r}
              variant={i === 0 ? "primary" : "default"}
              onClick={() => onAnswer(r)}
            >
              {r}
            </Button>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Not sure?{" "}
        <Link href="/home/messages" className="text-accentink hover:underline">
          Write to {q.request.askedBy.split(" ")[0]} instead
        </Link>
      </p>
    </div>
  );
}

function NextTask({ task, onDone }: { task: ClientTask; onDone: () => void }) {
  return (
    <div className="rounded-xl border-2 border-accentedge bg-canvas p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="warn">Your turn</Chip>
        {task.optional && <Chip tone="neutral">Optional</Chip>}
      </div>
      <h2 className="mt-2.5 text-lg font-semibold leading-snug">{task.title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{task.help}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onDone}>
          {TASK_CTA[task.kind]}
        </Button>
        {task.kind === "upload" && (
          <span className="text-xs text-faint">
            demo — marks it received without a real file
          </span>
        )}
        {task.optional && (
          <Button onClick={onDone}>Doesn&apos;t apply to me</Button>
        )}
        {task.estimateMinutes && (
          <span className="text-xs text-faint">
            about {task.estimateMinutes}{" "}
            {plural(task.estimateMinutes, "minute", "minutes")}
          </span>
        )}
      </div>
    </div>
  );
}

function QuietRow({
  title,
  detail,
  optional,
}: {
  title: string;
  detail: string;
  optional?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-muted">
        {title}
        {optional && <Chip tone="neutral">Optional</Chip>}
      </p>
      <p className="mt-0.5 text-xs text-faint">
        {detail}

      </p>
    </div>
  );
}
