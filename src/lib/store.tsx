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
  | { kind: "staff"; role: Extract<Role, "preparer" | "reviewer" | "admin"> }
  /**
   * The client experience. `as` names whose account is being viewed:
   *   "reyes" — Jordan's own return: a firm employee who is also a client of
   *             the firm, and whose account is brand new and empty.
   *   "chen"  — Sarah's return, several weeks in, so the same screens can be
   *             seen once onboarding is behind you.
   */
  | { kind: "self"; role: "client"; as: "reyes" | "chen" };

export const CLIENT_ACCOUNTS = {
  reyes: { returnId: "ret-reyes-2025", name: "Jordan Reyes" },
  chen: { returnId: "ret-chen-2025", name: "Sarah Chen" },
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
          state: previous !== suggested ? "edited" : "verified",
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
        const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
        const target = returns.find((r) => r.id === returnId);

        if (target) {
          const updated = target.lines.map((l) =>
            l.id === lineId
              ? {
                  ...l,
                  amount: Number.isFinite(numeric) ? numeric : l.amount,
                  state: "verified" as const,
                  aiSuggestion: undefined,
                  flag: undefined,
                  history: [
                    {
                      at: new Date().toISOString(),
                      actor: "Client",
                      action: "answered" as const,
                      detail: `Confirmed by the client and written to line ${lineId}`,
                      from: l.amount,
                      to: Number.isFinite(numeric) ? numeric : l.amount,
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
        pushToast({
          title: "Answer applied to the return",
          detail: `Line ${lineId} now reads ${value}, and the flag is cleared.`,
          tone: "ok",
        });
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
      setTasks((cur) =>
        cur.map((t) =>
          t.id === taskId
            ? { ...t, status: "done" as const, completedAt: new Date().toISOString() }
            : t
        )
      );
      pushToast({
        title: "Got it — thank you",
        detail: "We'll take it from here and let you know if we need anything else.",
        tone: "ok",
      });
    },
    [pushToast]
  );

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
      raiseFlag,
      sendMessage,
      resolveRequest,
      remindRequest,
      remindedRequests,
      completeTask,
      lastChanges,
      clearChanges: () => setLastChanges([]),
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
      raiseFlag,
      sendMessage,
      resolveRequest,
      remindRequest,
      remindedRequests,
      completeTask,
      lastChanges,
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
