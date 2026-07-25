"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AuditEntry,
  Role,
  TaxReturn,
  Thread,
  ThreadItem,
  Visibility,
} from "./types";
import {
  CLIENT_TASKS,
  HERO_RETURNS,
  THREADS,
  computeReadiness,
  openRequestsFor,
} from "./mockData";
import { recalculate, type RecalcChange } from "./calc";
import type { ClientTask } from "./types";

/* ---------------------------------------------------------------------------
   Application state.

   Everything lives in memory. There is no backend, and a refresh resets the
   world — which is the correct trade for a prototype whose job is to prove an
   interaction model.

   What is genuinely wired up, and worth knowing when reading this file:
     · confirming or editing a line rewrites its state, appends to its audit
       history, and recalculates every dependent line
     · resolving a request writes its answer onto the line it is anchored to
       and clears any flag there
     · readiness, open-item counts, and the dashboard all derive from that
       same state, so they move together
--------------------------------------------------------------------------- */

export type ActingContext =
  | {
      kind: "staff";
      role: Extract<Role, "preparer" | "seasonal" | "reviewer" | "admin">;
    }
  /**
   * The client experience. `as` names whose account is being viewed:
   *   "reyes" — Jordan's own return: a firm employee who is also a client of
   *             the firm, and whose account is brand new and empty.
   *   "chen"  — Sarah's return, several weeks in, so the same screens can be
   *             seen once onboarding is behind you.
   */
  | {
      kind: "self";
      role: Extract<Role, "client" | "business_owner">;
      as: "reyes" | "chen" | "petrov";
    };

export const CLIENT_ACCOUNTS = {
  reyes: { returnId: "ret-reyes-2025", name: "Jordan Reyes" },
  chen: { returnId: "ret-chen-2025", name: "Sarah Chen" },
  petrov: { returnId: "ret-petrov-2025", name: "Elena Petrov" },
} as const;

interface Toast {
  id: number;
  title: string;
  detail?: string;
  tone: "ok" | "info" | "warn";
}

interface Store {
  /* Identity + role (challenge 05) */
  acting: ActingContext;
  setActing: (a: ActingContext) => void;
  role: Role;
  userName: string;
  /** Which return the client portal is showing. Never hardcode this. */
  clientReturnId: string;
  clientName: string;

  /* Data */
  returns: TaxReturn[];
  threads: Thread[];
  tasks: ClientTask[];
  getReturn: (id: string) => TaxReturn | undefined;

  /* Actions on the return */
  confirmSuggestion: (returnId: string, lineId: string) => void;
  verifyLine: (returnId: string, lineId: string) => void;
  editLine: (returnId: string, lineId: string, value: number) => void;
  resolveFlag: (returnId: string, lineId: string, note: string) => void;
  /** A reviewer's sign-off — a different claim from a preparer's check. */
  approveLine: (returnId: string, lineId: string) => void;
  raiseFlag: (returnId: string, lineId: string, note: string) => void;

  /* Actions on the conversation (challenge 02) */
  sendMessage: (threadId: string, body: string, visibility: Visibility) => void;
  resolveRequest: (threadId: string, requestId: string, answer?: string) => void;
  remindRequest: (threadId: string, requestId: string) => void;
  /** Requests already chased this session, so nobody nudges twice. */
  remindedRequests: string[];

  /* Client side (challenge 03) */
  completeTask: (taskId: string) => void;

  /* Last recalculation, so the UI can explain what moved */
  lastChanges: RecalcChange[];
  clearChanges: () => void;
  /** The last change, if it can still be put back. */
  undoable: { returnId: string; label: string } | null;
  undoLast: () => void;

  toasts: Toast[];
  dismissToast: (id: number) => void;
}

const StoreContext = createContext<Store | null>(null);

const THREADS_LOOKUP = (all: Thread[], id: string) => all.find((t) => t.id === id);

let toastSeq = 0;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [acting, setActing] = useState<ActingContext>({
    kind: "staff",
    role: "preparer",
  });
  const [returns, setReturns] = useState<TaxReturn[]>(HERO_RETURNS);
  const [threads, setThreads] = useState<Thread[]>(THREADS);
  const [tasks, setTasks] = useState<ClientTask[]>(CLIENT_TASKS);
  const [lastChanges, setLastChanges] = useState<RecalcChange[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [remindedRequests, setRemindedRequests] = useState<string[]>([]);
  /*
   * The last change, kept whole.
   *
   * The audit trail records WHAT happened; undo needs the line as it stood
   * BEFORE it happened. Keeping the prior line object is the cheapest honest
   * way to make "every correction is reversible" a fact rather than a claim —
   * and it is the same shape a transform table would replay from.
   */
  const [undoable, setUndoable] = useState<{
    returnId: string;
    line: TaxReturn["lines"][number];
    label: string;
  } | null>(null);

  const account =
    acting.kind === "self" ? CLIENT_ACCOUNTS[acting.as] : CLIENT_ACCOUNTS.reyes;
  const clientReturnId = account.returnId;
  const clientName = account.name;

  const userName = "Jordan Reyes";
  const actorName =
    acting.kind === "staff" && acting.role === "reviewer"
      ? "Dana Whitfield"
      : "Jordan Reyes";

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastSeq;
    setToasts((cur) => [...cur, { ...t, id }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((cur) => cur.filter((x) => x.id !== id));
  }, []);

  /**
   * Applies a change to one line, recalculates, and refreshes readiness.
   *
   * The recalculation is computed here rather than inside the setState
   * updater: React may invoke an updater more than once, so triggering another
   * state change from within one silently loses the result.
   */
  const mutateLine = useCallback(
    (
      returnId: string,
      lineId: string,
      apply: (line: TaxReturn["lines"][number]) => TaxReturn["lines"][number]
    ) => {
      const current = returns.find((r) => r.id === returnId);
      if (!current) return;

      const before = current.lines.find((l) => l.id === lineId);
      if (before) {
        setUndoable({ returnId, line: before, label: `line ${lineId}` });
      }

      const updated = current.lines.map((l) => (l.id === lineId ? apply(l) : l));
      const { lines, changes } = recalculate(updated);

      setLastChanges(changes);
      setReturns((cur) =>
        cur.map((r) =>
          r.id === returnId
            ? {
                ...r,
                lines,
                readiness: computeReadiness(lines, openRequestsFor(r.id).length),
                lastActivity: new Date().toISOString(),
              }
            : r
        )
      );
    },
    [returns]
  );

  const entry = useCallback(
    (
      action: AuditEntry["action"],
      detail: string,
      from?: number | string | null,
      to?: number | string | null
    ): AuditEntry => ({
      at: new Date().toISOString(),
      actor: actorName,
      action,
      detail,
      from,
      to,
    }),
    [actorName]
  );

  const confirmSuggestion = useCallback(
    (returnId: string, lineId: string) => {
      mutateLine(returnId, lineId, (line) => {
        const suggested = line.aiSuggestion?.value ?? line.amount ?? 0;
        const previous = line.amount;
        return {
          ...line,
          amount: suggested,
          /* Always verified. Confirming means the human read the source and
             agreed with the machine — which is the definition of verified.
             This used to badge "Edited" whenever the value moved, but the
             design system defines edited as "a person overrode the AI", so
             the flagship action asserted the opposite of what just happened.
             Overriding is editLine's job, and it sets "edited" itself. */
          state: "verified",
          aiSuggestion: undefined,
          pipeline: line.pipeline.map((p) =>
            p.actor === "ai"
              ? { ...p, status: "done" as const, note: "Reading confirmed" }
              : p.actor === "preparer"
              ? {
                  ...p,
                  status: "done" as const,
                  note: "Confirmed against the source",
                  at: new Date().toISOString(),
                }
              : p
          ),
          history: [
            entry(
              "verified",
              previous !== suggested
                ? "Confirmed the AI's reading against the source document"
                : "Verified against the source document",
              previous,
              suggested
            ),
            ...line.history,
          ],
        };
      });
      pushToast({
        title: "Confirmed",
        detail: "The change is logged and dependent lines have been recalculated.",
        tone: "ok",
      });
    },
    [mutateLine, entry, pushToast]
  );

  const verifyLine = useCallback(
    (returnId: string, lineId: string) => {
      mutateLine(returnId, lineId, (line) => ({
        ...line,
        state: "verified",
        pipeline: line.pipeline.map((p) =>
          p.actor === "preparer"
            ? {
                ...p,
                status: "done" as const,
                note: "Verified",
                at: new Date().toISOString(),
              }
            : p
        ),
        history: [entry("verified", "Checked against the source"), ...line.history],
      }));
      pushToast({ title: "Marked verified", tone: "ok" });
    },
    [mutateLine, entry, pushToast]
  );

  const editLine = useCallback(
    (returnId: string, lineId: string, value: number) => {
      mutateLine(returnId, lineId, (line) => ({
        ...line,
        amount: value,
        state: "edited",
        aiSuggestion: undefined,
        history: [
          entry("edited", "Value changed by hand", line.amount, value),
          ...line.history,
        ],
      }));
      pushToast({
        title: "Value updated",
        detail: "The original reading is preserved in this line's history.",
        tone: "info",
      });
    },
    [mutateLine, entry, pushToast]
  );

  const resolveFlag = useCallback(
    (returnId: string, lineId: string, note: string) => {
      mutateLine(returnId, lineId, (line) => ({
        ...line,
        state: "verified",
        flag: undefined,
        pipeline: line.pipeline.map((p) =>
          p.actor === "reviewer"
            ? { ...p, status: "done" as const, note: "Flag cleared" }
            : p
        ),
        history: [entry("resolved", note), ...line.history],
      }));
      pushToast({
        title: "Flag resolved",
        detail: "Dana has been notified and the note is on the record.",
        tone: "ok",
      });
    },
    [mutateLine, entry, pushToast]
  );

  /**
   * A reviewer signing off on a line.
   *
   * Deliberately not the same call as `verifyLine`: a preparer checking their
   * own work and a reviewer approving it are different claims, and collapsing
   * them would make the audit trail unable to tell you which one happened.
   */
  const approveLine = useCallback(
    (returnId: string, lineId: string) => {
      mutateLine(returnId, lineId, (line) => ({
        ...line,
        state: "verified",
        flag: undefined,
        pipeline: line.pipeline.map((p) =>
          p.actor === "reviewer"
            ? {
                ...p,
                status: "done" as const,
                note: "Approved",
                at: new Date().toISOString(),
              }
            : p
        ),
        history: [
          entry("verified", "Approved by the reviewer"),
          ...line.history,
        ],
      }));
      pushToast({
        title: "Approved",
        detail: "Signed off. Nothing further is needed on this line.",
        tone: "ok",
      });
    },
    [mutateLine, entry, pushToast]
  );

  const raiseFlag = useCallback(
    (returnId: string, lineId: string, note: string) => {
      mutateLine(returnId, lineId, (line) => ({
        ...line,
        state: "flagged",
        flag: {
          byName: actorName,
          byRole: acting.kind === "staff" ? acting.role : "client",
          at: new Date().toISOString(),
          note,
        },
        pipeline: line.pipeline.map((p) =>
          p.actor === "reviewer"
            ? { ...p, status: "flagged" as const, note: "Flagged just now" }
            : p
        ),
        history: [entry("flagged", note), ...line.history],
      }));
      pushToast({ title: "Flagged for follow-up", tone: "warn" });
    },
    [mutateLine, entry, pushToast, actorName, acting]
  );

  const sendMessage = useCallback(
    (threadId: string, body: string, visibility: Visibility) => {
      setThreads((cur) =>
        cur.map((t) =>
          t.id === threadId
            ? {
                ...t,
                items: [
                  ...t.items,
                  {
                    kind: "message" as const,
                    id: `m-${Date.now()}`,
                    author: actorName,
                    authorRole: acting.kind === "self" ? "client" : acting.role,
                    visibility,
                    body,
                    at: new Date().toISOString(),
                  } satisfies ThreadItem,
                ],
              }
            : t
        )
      );
      pushToast({
        title: visibility === "internal" ? "Internal note added" : "Message sent",
        detail:
          visibility === "internal"
            ? "Only firm staff can see this."
            : "The client has been notified by email.",
        tone: visibility === "internal" ? "warn" : "ok",
      });
    },
    [actorName, acting, pushToast]
  );

  /**
   * Resolving a request is the moment collaboration and the return meet:
   * the answer is written onto the line the request was anchored to.
   */
  const resolveRequest = useCallback(
    (threadId: string, requestId: string, answer?: string) => {
      // Work out the consequence before mutating anything, so the write-back
      // target is plain data rather than something captured in a setState
      // callback.
      const thread = THREADS_LOOKUP(threads, threadId);
      const request = thread?.items.find(
        (i): i is Extract<ThreadItem, { kind: "request" }> =>
          i.kind === "request" && i.id === requestId
      );
      const writeTo =
        thread && request?.resolution
          ? {
              returnId: thread.returnId,
              lineId: request.resolution.writesToLine,
              value: answer ?? request.resolution.value,
            }
          : null;

      setThreads((cur) =>
        cur.map((t) => {
          if (t.id !== threadId) return t;
          return {
            ...t,
            items: t.items.map((i) => {
              if (i.kind !== "request" || i.id !== requestId) return i;
              return {
                ...i,
                status: "resolved" as const,
                owner: "none" as const,
                resolvedAt: new Date().toISOString(),
              };
            }),
          };
        })
      );

      if (writeTo) {
        const { returnId, lineId, value } = writeTo;
        /* The client's own words take precedence over the seeded resolution, so
           this has to survive an answer like "I paid cash" or "I'll upload it".
           Stripping non-numerics from those leaves "", and Number("") is 0 —
           which is finite, so the old guard let it through and wrote $0 onto
           the return, marked the line verified and cleared the flag.
           An answer that names no figure is still a useful answer; it just
           isn't a value, so it is recorded without touching the amount. */
        const digits = String(value).replace(/[^0-9.-]/g, "");
        const numeric = digits === "" ? NaN : Number(digits);
        const isAmount = Number.isFinite(numeric);
        const target = returns.find((r) => r.id === returnId);

        if (target) {
          const updated = target.lines.map((l) =>
            l.id === lineId
              ? {
                  ...l,
                  amount: isAmount ? numeric : l.amount,
                  // Only a figure settles the line. Anything else leaves it
                  // exactly as it was for the preparer to act on.
                  state: isAmount ? ("verified" as const) : l.state,
                  aiSuggestion: isAmount ? undefined : l.aiSuggestion,
                  flag: isAmount ? undefined : l.flag,
                  history: [
                    {
                      at: new Date().toISOString(),
                      actor: "Client",
                      action: "answered" as const,
                      detail: isAmount
                        ? `Confirmed by the client and written to line ${lineId}`
                        : `Client answered: “${value}” — no figure to write, left for the preparer`,
                      from: l.amount,
                      to: isAmount ? numeric : l.amount,
                    },
                    ...l.history,
                  ],
                }
              : l
          );
          const { lines, changes } = recalculate(updated);
          setLastChanges(changes);
          setReturns((cur) =>
            cur.map((r) =>
              r.id === returnId
                ? {
                    ...r,
                    lines,
                    blocked: undefined,
                    readiness: computeReadiness(lines, 0),
                    lastActivity: new Date().toISOString(),
                  }
                : r
            )
          );
        }
        pushToast(
          isAmount
            ? {
                title: "Answer applied to the return",
                detail: `Line ${lineId} now reads ${value}, and the flag is cleared.`,
                tone: "ok",
              }
            : {
                title: "Answer recorded",
                detail: `There was no figure in it, so line ${lineId} is unchanged and still with the preparer.`,
                tone: "ok",
              }
        );
      } else {
        pushToast({ title: "Request resolved", tone: "ok" });
      }
    },
    [pushToast, threads, returns]
  );

  const remindRequest = useCallback(
    (threadId: string, requestId: string) => {
      // Recording which request was chased is what would drive "reminded 2h
      // ago" and stop two people nudging the same client on the same day.
      setRemindedRequests((cur) =>
        cur.includes(requestId) ? cur : [...cur, requestId]
      );
      const thread = THREADS_LOOKUP(threads, threadId);
      const request = thread?.items.find(
        (i): i is Extract<ThreadItem, { kind: "request" }> =>
          i.kind === "request" && i.id === requestId
      );
      pushToast({
        title: "Reminder sent",
        detail: request
          ? `${request.title} — the client will get an email and a portal notification.`
          : "The client will get an email and a portal notification.",
        tone: "info",
      });
    },
    [pushToast, threads]
  );

  const completeTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);

      setTasks((cur) =>
        cur.map((t) =>
          t.id === taskId
            ? { ...t, status: "done" as const, completedAt: new Date().toISOString() }
            : t
        )
      );

      /* Finishing the last required task is a real handover, so the return has
         to move. Without this the journey strip stayed frozen on "Your
         documents · you are here" with no ticks, directly above a panel saying
         nothing was needed — the two halves of the same card disagreeing.

         Advancing the one stored `stage` is what makes it move, rather than a
         second progress value in the view that could drift from the firm's.
         Optional tasks are excluded: a skipped "add any 1099s" must not hold
         the return still. */
      if (task) {
        const stillOwed = tasks.filter(
          (t) =>
            t.returnId === task.returnId &&
            t.id !== taskId &&
            t.status !== "done" &&
            !t.optional
        );
        if (stillOwed.length === 0) {
          setReturns((cur) =>
            cur.map((r) =>
              r.id === task.returnId && r.stage === "docs_pending"
                ? {
                    ...r,
                    stage: "extracting" as const,
                    lastActivity: new Date().toISOString(),
                  }
                : r
            )
          );
        }
      }

      pushToast({
        title: "Got it — thank you",
        detail: "We'll take it from here and let you know if we need anything else.",
        tone: "ok",
      });
    },
    [tasks, pushToast]
  );

  /** Puts a line back exactly as it stood, and recalculates around it. */
  const undoLast = useCallback(() => {
    if (!undoable) return;
    const target = returns.find((r) => r.id === undoable.returnId);
    if (!target) return;

    const restored = target.lines.map((l) =>
      l.id === undoable.line.id ? undoable.line : l
    );
    const { lines, changes } = recalculate(restored);
    setLastChanges(changes);
    setReturns((cur) =>
      cur.map((r) =>
        r.id === undoable.returnId
          ? {
              ...r,
              lines,
              readiness: computeReadiness(lines, openRequestsFor(r.id).length),
              lastActivity: new Date().toISOString(),
            }
          : r
      )
    );
    setUndoable(null);
    pushToast({
      title: "Change undone",
      detail: `${undoable.label} is back as it was, and the totals have followed.`,
      tone: "info",
    });
  }, [undoable, returns, pushToast]);

  const getReturn = useCallback(
    (id: string) => returns.find((r) => r.id === id),
    [returns]
  );

  const value = useMemo<Store>(
    () => ({
      acting,
      setActing,
      role: acting.kind === "self" ? "client" : acting.role,
      userName,
      clientReturnId,
      clientName,
      returns,
      threads,
      tasks,
      getReturn,
      confirmSuggestion,
      verifyLine,
      editLine,
      resolveFlag,
      approveLine,
      raiseFlag,
      sendMessage,
      resolveRequest,
      remindRequest,
      remindedRequests,
      completeTask,
      lastChanges,
      clearChanges: () => setLastChanges([]),
      undoable: undoable
        ? { returnId: undoable.returnId, label: undoable.label }
        : null,
      undoLast,
      toasts,
      dismissToast,
    }),
    [
      acting,
      userName,
      clientReturnId,
      clientName,
      returns,
      threads,
      tasks,
      getReturn,
      confirmSuggestion,
      verifyLine,
      editLine,
      resolveFlag,
      approveLine,
      raiseFlag,
      sendMessage,
      resolveRequest,
      remindRequest,
      remindedRequests,
      completeTask,
      lastChanges,
      undoable,
      undoLast,
      toasts,
      dismissToast,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
