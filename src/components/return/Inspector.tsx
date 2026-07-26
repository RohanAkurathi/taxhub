"use client";

import Link from "next/link";
import { useState } from "react";
import type { PipelineStep, ReturnLine, TaxReturn } from "@/lib/types";
import { FIELD_STATE, ROLE, formatMoney } from "@/lib/design";
import { documentById, relativeTime, roleLabelForName } from "@/lib/mockData";
import { downstreamOf } from "@/lib/calc";
import { getWarningsForLine } from "@/lib/mockAI";
import { useStore } from "@/lib/store";
import {
  Avatar,
  Button,
  Card,
  Chip,
  DocumentView,
  SectionLabel,
  StatePill,
  cx,
} from "@/components/ui";

/* ---------------------------------------------------------------------------
   The inspector.

   Selecting any line — verified, calculated, flagged, or deliberately blank —
   answers the same four questions in the same order:

     Where did this number come from?
     Who has worked on it?
     What is being said about it?
     What can I do?

   Keeping that order fixed for every kind of line is what makes traceability
   feel like a property of the product rather than a feature you visit.
--------------------------------------------------------------------------- */

/** A link to the conversation, naming which thread it should open on. */
function threadHref(returnId: string, threadId?: string) {
  return threadId
    ? `/returns/${returnId}/messages?about=${threadId}`
    : `/returns/${returnId}/messages`;
}

export function Inspector({
  ret,
  line,
  onSelectLine,
}: {
  ret: TaxReturn;
  line: ReturnLine;
  onSelectLine: (id: string) => void;
}) {
  const {
    confirmSuggestion,
    verifyLine,
    editLine,
    resolveFlag,
    approveLine,
    raiseFlag,
    role,
    undoable,
    undoLast,
  } = useStore();
  const [sendingBack, setSendingBack] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [checkedEvidence, setCheckedEvidence] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  /*
   * A new selection is a new decision — "I have looked at the evidence" must
   * never carry across lines, or the confirm gate would be defeated simply by
   * having opened some other line's document first.
   *
   * Reset during render rather than in an effect: an effect would let one
   * frame paint with the previous line's evidence flag still true.
   */
  const [seenLineId, setSeenLineId] = useState(line.id);
  if (seenLineId !== line.id) {
    setSeenLineId(line.id);
    setCheckedEvidence(false);
    setEditing(false);
    setShowHistory(false);
    setSendingBack(false);
    setFlagNote("");
    setDraft(line.amount === null ? "" : String(line.amount));
  }

  /*
   * A reviewer is not doing a preparer's job with the same buttons. They are
   * not building the return — they are deciding whether to put their name on
   * someone else's work, so their verbs are approve and send back. Showing
   * them "Confirm" and "Edit" would quietly invite them to fix things
   * themselves, which is exactly what a second pair of eyes must not do.
   */
  const isReviewer = role === "reviewer";

  const meta = FIELD_STATE[line.state];
  const warnings = getWarningsForLine(ret.id, line.id);
  const lowConfidence = (line.confidence ?? 1) < 0.85;

  // For a low-confidence reading, confirming is gated behind actually looking
  // at the source. One click on the highlighted box is a small price for the
  // difference between "a human approved this" and "a human clicked past it".
  const confirmBlocked = lowConfidence && !checkedEvidence;

  return (
    <aside className="app-scroll w-[340px] shrink-0 border-l border-line bg-panel px-5 py-5">
      <h2 className="text-[15px] font-semibold leading-snug">
        <span className="text-faint">Line {line.id}</span> · {line.label}
      </h2>

      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
        <span className="tnum text-2xl font-semibold">{formatMoney(line.amount)}</span>
        <StatePill state={line.state} confidence={line.confidence} />
      </div>

      {!meta.editable && line.lockReason && (
        <p className="mt-2 text-xs leading-relaxed text-muted">{line.lockReason}</p>
      )}

      {/* The AI's disagreement, stated as a comparison rather than a diff. --- */}
      {line.aiSuggestion && (
        <Card tone="warn" className="mt-3 p-3">
          <SectionLabel className="text-warn">Needs your decision</SectionLabel>
          <div className="mt-2 flex items-end gap-4">
            <div>
              <p className="text-[11px] text-muted">The document appears to say</p>
              <p className="tnum text-lg font-semibold text-warn">
                {formatMoney(line.aiSuggestion.value)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted">The return currently says</p>
              <p className="tnum text-lg">{formatMoney(line.amount)}</p>
            </div>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-muted">
            {line.aiSuggestion.rationale}
          </p>
          {line.aiSuggestion.corroboration && (
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              <strong className="font-medium text-ink">Cross-check:</strong>{" "}
              {line.aiSuggestion.corroboration}{" "}
              {/* A corroboration you cannot open is just another claim. Where
                  the firm holds last year's return, the prior-year figure is
                  followable to the filed document that states it. */}
              {ret.priorYearReturnId && (
                <Link
                  href={`/returns/${ret.priorYearReturnId}?line=${line.id}`}
                  className="whitespace-nowrap font-medium text-accentink underline-offset-2 hover:underline"
                >
                  See last year&rsquo;s return ↗
                </Link>
              )}
            </p>
          )}
        </Card>
      )}

      {/* A person's flag, always attributed. ------------------------------- */}
      {line.flag && (
        <Card tone="flag" className="mt-3 p-3">
          <div className="flex items-center gap-2">
            <Avatar name={line.flag.byName} size={20} tone="flag" />
            <span className="text-xs font-medium">
              {line.flag.byName}
              <span className="font-normal text-muted"> · {line.flag.byRole}</span>
            </span>
            <span className="ml-auto text-[11px] text-faint">
              {relativeTime(line.flag.at)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed">{line.flag.note}</p>
        </Card>
      )}

      {/* 1 — Where did this come from? ------------------------------------ */}
      <section className="mt-5 border-t border-hair pt-4">
        <SectionLabel>Where it came from</SectionLabel>
        <div className="mt-2">
          <ProvenanceView
            line={line}
            highlight={checkedEvidence}
            onCheckEvidence={() => setCheckedEvidence(true)}
            onSelectLine={onSelectLine}
          />
        </div>
      </section>

      {/* 2 — Who has worked on it? --------------------------------------- */}
      <section className="mt-5 border-t border-hair pt-4">
        <SectionLabel>Who&rsquo;s worked on it</SectionLabel>
        <p className="mt-1 text-[11px] leading-relaxed text-faint">
          Every number travels the same road: the AI reads it, the preparer checks it,
          the reviewer signs off.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {line.pipeline.map((step, i) => (
            <PipelineChip key={step.actor} step={step} showArrow={i > 0} />
          ))}
        </div>
        {line.pipeline.find((p) => p.note && p.status !== "waiting") && (
          <ul className="mt-2 space-y-0.5">
            {line.pipeline
              .filter((p) => p.note && p.status !== "waiting")
              .map((p) => (
                <li key={p.actor} className="text-[11px] text-muted">
                  <span className="font-medium text-ink">{p.actorName}</span>
                  {/* Was printing the raw enum, so this read "· preparer" in
                      lowercase machine-speak. Same source, human wording. */}
                  <span className="text-faint">
                    {" · "}
                    {p.actor === "ai" ? "Automated" : ROLE[p.actor].label}
                  </span>{" "}
                  — {p.note}
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* The AI's wider observations about this line. --------------------- */}
      {warnings.length > 0 && (
        <section className="mt-5 border-t border-hair pt-4">
          <SectionLabel>What the AI noticed</SectionLabel>
          {warnings.map((w) =>
            w.severity === "info" ? (
              // Context, not a problem. It earns a line, not a card — otherwise
              // everything on this panel looks equally urgent.
              <details key={w.id} className="group mt-2">
                <summary className="cursor-pointer list-none text-xs text-muted marker:content-none hover:text-ink">
                  <span className="text-faint">·</span> {w.title}
                  <span className="ml-1 text-faint group-open:hidden">— more</span>
                </summary>
                <p className="mt-1.5 pl-3 text-xs leading-relaxed text-muted">
                  {w.detail}
                </p>
              </details>
            ) : (
              <Card key={w.id} tone="warn" className="mt-2 p-3">
                <Chip tone="warn">{w.severity === "serious" ? "check before filing" : "worth a look"}</Chip>
                <p className="mt-1.5 text-xs font-medium">{w.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{w.detail}</p>
                <p className="mt-1.5 text-xs leading-relaxed">
                  <strong className="font-medium">Suggested:</strong> {w.suggestedAction}
                </p>
                <p className="mt-1.5 text-[11px] text-faint">Found by {w.method}.</p>
              </Card>
            )
          )}
        </section>
      )}

      {/* 3 — What is being said about it? -------------------------------- */}
      {line.threadId && (
        <section className="mt-5 border-t border-hair pt-4">
          <SectionLabel>Conversation</SectionLabel>
          <ThreadPreview threadId={line.threadId} returnId={ret.id} />
        </section>
      )}

      {/* 4 — What can I do? ---------------------------------------------- */}
      <section className="mt-5 border-t border-hair pt-4">
        <SectionLabel>What you can do</SectionLabel>

        {isReviewer ? (
          /* ---------------- Reviewer: approve, or send it back ------------- */
          sendingBack ? (
            <div className="mt-2">
              <label className="text-xs text-muted" htmlFor="flag-note">
                What does the preparer need to do?
              </label>
              <textarea
                id="flag-note"
                rows={3}
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                placeholder="e.g. Confirm the consulting is a trade or business before the deduction stands."
                className="mt-1 w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm"
                autoFocus
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                This holds the line and goes back to {ret.preparerName}. Nothing on
                this return can be filed while it is open.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!flagNote.trim()}
                  onClick={() => {
                    raiseFlag(ret.id, line.id, flagNote.trim());
                    setSendingBack(false);
                    setFlagNote("");
                  }}
                >
                  Send back
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => {
                    setSendingBack(false);
                    setFlagNote("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <div className="flex flex-wrap gap-2">
                {line.flag ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      resolveFlag(
                        ret.id,
                        line.id,
                        line.flag!.resolution ??
                          `Cleared by ${line.flag!.byName} on line ${line.id}.`
                      )
                    }
                  >
                    Clear my flag
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={line.state === "needs_review" && !checkedEvidence}
                    title={
                      line.state === "needs_review" && !checkedEvidence
                        ? "Look at the source before approving an uncertain figure"
                        : undefined
                    }
                    onClick={() => approveLine(ret.id, line.id)}
                  >
                    Approve this line
                  </Button>
                )}
                <Button size="sm" onClick={() => setSendingBack(true)}>
                  Send back to {ret.preparerName.split(" ")[0]}
                </Button>
                <Link href={threadHref(ret.id, line.threadId)}>
                  <Button variant="quiet" size="sm">
                    Discuss
                  </Button>
                </Link>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                You are reviewing, not preparing. Corrections go back to{" "}
                {ret.preparerName.split(" ")[0]} rather than being made here, so the
                return keeps a single author.
              </p>
            </div>
          )
        ) : editing ? (
          <div className="mt-2">
            <label className="text-xs text-muted" htmlFor="edit-amount">
              New amount
            </label>
            <input
              id="edit-amount"
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="tnum mt-1 w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm"
              autoFocus
            />
            {downstreamOf(line.id).length > 0 && (
              <p className="mt-1.5 text-[11px] text-muted">
                Changing this will recalculate{" "}
                {downstreamOf(line.id)
                  .map((d) => `line ${d}`)
                  .join(", ")}
                .
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const v = Number(draft);
                  if (Number.isFinite(v)) editLine(ret.id, line.id, v);
                  setEditing(false);
                }}
              >
                Save
              </Button>
              <Button variant="quiet" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {line.aiSuggestion && (
              <Button
                variant="primary"
                size="sm"
                disabled={confirmBlocked}
                title={
                  confirmBlocked
                    ? "Check the highlighted value on the document first"
                    : undefined
                }
                onClick={() => confirmSuggestion(ret.id, line.id)}
              >
                Confirm {formatMoney(line.aiSuggestion.value)}
              </Button>
            )}

            {line.flag && (
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  resolveFlag(
                    ret.id,
                    line.id,
                    // The note has to describe THIS flag. An earlier version
                    // wrote one hardcoded sentence, which cheerfully recorded
                    // the wrong resolution against every other flagged line.
                    line.flag!.resolution ??
                      `Resolved ${line.flag!.byName}'s question on line ${line.id}.`
                  )
                }
              >
                Resolve this
              </Button>
            )}

            {!line.aiSuggestion &&
              !line.flag &&
              meta.editable &&
              line.state !== "verified" && (
                <Button variant="primary" size="sm" onClick={() => verifyLine(ret.id, line.id)}>
                  Mark verified
                </Button>
              )}

            {meta.editable ? (
              <Button size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}

            {/* Carry the line's own conversation across. Without it the
                composer opened on whichever thread was most recently active,
                so "Ask the client" about line 2b could post under line 12b. */}
            <Link href={threadHref(ret.id, line.threadId)}>
              <Button variant="quiet" size="sm">
                Ask the client
              </Button>
            </Link>
          </div>
        )}

        {/* Gated on the suggestion, not just on confidence: confirming does not
            clear `confidence`, so after the flagship demo this sentence used to
            sit there explaining a Confirm button that no longer existed. */}
        {!isReviewer && confirmBlocked && line.aiSuggestion && !editing && (
          <p className="mt-2 text-[11px] leading-relaxed text-warn">
            This reading is uncertain, so confirming is disabled until you have looked at
            the source. Click the highlighted value on the document above.
          </p>
        )}

        {!isReviewer && !meta.editable && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            To change this line, edit one of the lines it is calculated from. It will
            follow automatically.
          </p>
        )}
      </section>

      {/* The audit trail. ------------------------------------------------- */}
      <section className="mt-5 border-t border-line pt-3">
        <button
          onClick={() => setShowHistory((s) => !s)}
          aria-expanded={showHistory}
          className="flex w-full items-center justify-between text-left"
        >
          <SectionLabel>History · {line.history.length}</SectionLabel>
          <span aria-hidden="true" className="text-xs text-faint">
            {showHistory ? "hide" : "show"}
          </span>
        </button>
        {showHistory && (
          <ol className="mt-2 space-y-2">
            {line.history.length === 0 && (
              <li className="text-xs text-faint">
                Nothing has changed on this line since the return was created.
              </li>
            )}
            {/*
              Newest first. The store prepends live changes while the seeded
              entries are oldest-first, so rendering in array order produced a
              history that jumped "just now → last week → yesterday".
            */}
            {[...line.history]
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((h, i) => (
              <li key={i} className="border-l-2 border-hair pl-2.5 text-xs">
                <p className="leading-snug">{h.detail}</p>
                <p className="mt-0.5 text-[11px] text-faint">
                  {h.actor}{" "}
                  <span className="opacity-80">({roleLabelForName(h.actor)})</span> ·{" "}
                  {relativeTime(h.at)}
                  {h.from !== undefined && h.to !== undefined && h.from !== null && (
                    <>
                      {" "}
                      · <span className="tnum">{formatMoney(Number(h.from))}</span> →{" "}
                      <span className="tnum">{formatMoney(Number(h.to))}</span>
                    </>
                  )}
                </p>
              </li>
              ))}
          </ol>
        )}
        {/* The claim above is only worth making if it is true, so the control
            that proves it sits directly under it. */}
        {undoable && undoable.returnId === ret.id && (
          <Button size="sm" className="mt-2.5" onClick={undoLast}>
            Undo the last change
          </Button>
        )}
        <p className="mt-2.5 text-[11px] leading-relaxed text-faint">
          The uploaded document is never altered. Every change is stored separately, which
          is what makes this history — and undoing any of it — possible.
        </p>
      </section>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */

function PipelineChip({ step, showArrow }: { step: PipelineStep; showArrow: boolean }) {
  const tone = {
    done: "bg-oksoft text-ok",
    attention: "bg-warnsoft text-warn",
    waiting: "bg-locksoft text-lock",
    flagged: "bg-flagsoft text-flag",
  }[step.status];
  const glyph = {
    done: "✓",
    attention: "▲",
    waiting: "·",
    flagged: "⚑",
  }[step.status];
  /* A first name on its own is only meaningful to someone who already knows
     the team, and this row is precisely where a reader is working out who is
     accountable for a number. So the role rides with the name everywhere it
     appears — it was previously in a `title` tooltip, which is to say nowhere.
     `actor` is already the role, so this cannot drift from the pipeline data. */
  const short = step.actor === "ai" ? "AI" : step.actorName.split(" ")[0];
  const roleLabel = step.actor === "ai" ? "Automated" : ROLE[step.actor].label;
  const isAI = step.actor === "ai";

  return (
    <>
      {showArrow && (
        <span aria-hidden="true" className="text-lockedge">
          →
        </span>
      )}
      <span
        title={`${isAI ? "AI" : step.actorName} (${roleLabel}): ${step.note ?? step.status}`}
        className={cx(
          "inline-flex flex-col items-start rounded-lg px-2.5 py-1 leading-tight",
          tone
        )}
      >
        <span className="flex items-center gap-1.5 text-xs font-medium">
          {short} <span aria-hidden="true">{glyph}</span>
        </span>
        <span className="text-[10px] font-medium opacity-70">{roleLabel}</span>
      </span>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Renders whichever kind of origin this line has. Every branch ends up
 * answering the same question, which is why they share one heading upstream.
 */
function ProvenanceView({
  line,
  highlight,
  onCheckEvidence,
  onSelectLine,
}: {
  line: ReturnLine;
  highlight: boolean;
  onCheckEvidence: () => void;
  onSelectLine: (id: string) => void;
}) {
  const p = line.provenance;

  if (p.kind === "document") {
    const doc = documentById(p.documentId);
    if (!doc) return null;
    return (
      <div>
        <p className="mb-2 text-xs text-muted">{p.citation}</p>
        <DocumentView doc={doc} highlightBoxId={p.boxId} onBoxClick={onCheckEvidence} />
        {highlight && (
          <p className="mt-1.5 text-[11px] font-medium text-ok">
            ✓ You checked this value against the document.
          </p>
        )}
        {p.transformation && (
          <p className="mt-2 rounded-md bg-accentsoft px-2.5 py-1.5 text-xs text-accentink">
            <strong className="font-medium">Applied:</strong> {p.transformation}
          </p>
        )}
      </div>
    );
  }

  if (p.kind === "answer") {
    return (
      <Card className="border-l-[3px] border-l-accentedge p-3">
        <p className="text-xs text-muted">{p.question}</p>
        <p className="mt-1 text-sm font-medium">&ldquo;{p.answer}&rdquo;</p>
        <p className="mt-1.5 text-[11px] text-faint">
          {p.answeredBy} · {relativeTime(p.answeredAt)}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          A client&rsquo;s answer is a source like any document, and is treated as one.
        </p>
      </Card>
    );
  }

  if (p.kind === "calculation") {
    /*
     * Rendered as an adding-machine tape rather than a flow diagram: each
     * input on its own row with its operator, a rule, then the result. This
     * is how the arithmetic would look worked in the margin of a paper
     * return, which is the visual language the documents already use — and
     * every row is a working link to the line it names.
     */
    const opFor = (lineId: string, index: number): string => {
      if (index === 0) return "";
      const at = p.formula.indexOf(lineId);
      if (at === -1) return "+";
      const before = p.formula.slice(0, at);
      return /[−-]\s*(Line\s*)?$/.test(before) ? "−" : "+";
    };
    const singleInput = p.inputs.length === 1;

    return (
      <div className="overflow-hidden rounded-sm border border-lockedge bg-white">
        <table className="w-full text-xs">
          <tbody>
            {p.inputs.map((inp, i) => (
              <tr key={inp.lineId}>
                <td className="tnum w-5 py-1.5 pl-3 text-muted" aria-hidden="true">
                  {singleInput ? "" : opFor(inp.lineId, i)}
                </td>
                <td className="py-1.5 pr-2">
                  <button
                    onClick={() => onSelectLine(inp.lineId)}
                    className="text-left font-medium text-ink hover:text-accentink hover:underline"
                  >
                    {inp.label}
                  </button>
                  <span className="ml-1.5 text-faint">line {inp.lineId}</span>
                </td>
                <td className="tnum py-1.5 pr-3 text-right text-ink">
                  {formatMoney(inp.amount)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="border-t border-ink/60 py-1.5 pl-3 font-medium" aria-hidden="true">
                =
              </td>
              <td className="border-t border-ink/60 py-1.5 pr-2 font-semibold">
                {line.label}
              </td>
              <td className="tnum border-t border-ink/60 py-1.5 pr-3 text-right font-semibold">
                {formatMoney(line.amount)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="border-t border-hair bg-panel px-3 py-1.5 text-[11px] text-faint">
          {singleInput ? p.formula : "Recalculates on its own when any input line changes."}
        </p>
      </div>
    );
  }

  if (p.kind === "rule") {
    return (
      <Card className="p-3">
        <p className="text-xs font-medium">{p.rule}</p>
        <p className="mt-1 text-xs text-muted">{p.detail}</p>
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <p className="text-xs leading-relaxed text-muted">{p.reason}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-faint">
        A blank line still has a reason. Recording it is what stops the next person
        wondering whether something was missed.
      </p>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function ThreadPreview({ threadId, returnId }: { threadId: string; returnId: string }) {
  const { threads } = useStore();
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return null;

  const open = thread.items.filter(
    (i) => i.kind === "request" && i.status !== "resolved"
  ).length;
  const recent = thread.items.slice(-3);

  return (
    <div className="mt-2">
      <ul className="space-y-1.5">
        {recent.map((item) => {
          if (item.kind === "message") {
            return (
              <li
                key={item.id}
                className={cx(
                  "rounded-md px-2.5 py-1.5 text-xs leading-relaxed",
                  item.visibility === "internal"
                    ? "border-l-[3px] border-l-warnedge bg-warnsoft/40 text-warn"
                    : "bg-canvas"
                )}
              >
                <span className="font-medium">
                  {item.visibility === "internal" && "⊘ "}
                  {item.author}
                </span>
                <span className="opacity-70">
                  {" "}
                  ({roleLabelForName(item.author).toLowerCase()})
                </span>
                : {item.body.slice(0, 90)}
                {item.body.length > 90 && "…"}
              </li>
            );
          }
          if (item.kind === "request") {
            return (
              <li
                key={item.id}
                className="rounded-md border border-warnedge bg-warnsoft/40 px-2.5 py-1.5 text-xs"
              >
                <span className="font-medium">{item.title}</span>
                <span className="ml-1 text-muted">
                  · {item.status === "resolved" ? "resolved" : `waiting on the ${item.owner}`}
                </span>
              </li>
            );
          }
          return (
            <li key={item.id} className="px-2.5 text-xs text-faint">
              {item.body}
            </li>
          );
        })}
      </ul>
      <Link href={threadHref(returnId, threadId)}>
        <Button size="sm" className="mt-2">
          Open the conversation {open > 0 && `· ${open} open`}
        </Button>
      </Link>
    </div>
  );
}
