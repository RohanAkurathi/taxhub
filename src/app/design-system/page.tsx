"use client";

import { useState } from "react";
import { Shell } from "@/components/Shell";
import {
  Button,
  Card,
  Chip,
  ConfidenceNote,
  Grade,
  OwnerBadge,
  SectionLabel,
  StatePill,
  cx,
} from "@/components/ui";
import {
  FIELD_STATE,
  FIELD_STATE_ORDER,
  STAGE,
  STAGE_ORDER,
  formatMoney,
} from "@/lib/design";
import type { FieldState, Owner } from "@/lib/types";

/* ---------------------------------------------------------------------------
   The interaction system (challenge 08), written down so a team can build
   against it rather than guess.

   This page renders from the same `FIELD_STATE`, `STAGE` and `OWNER_LABEL`
   tables the product renders from. It is therefore incapable of documenting a
   badge that does not exist, or of going stale when one changes — which is the
   only reason a design-system page is worth having.
--------------------------------------------------------------------------- */

/** What a user may actually DO with a value in each state. */
const STATE_ACTIONS: Record<FieldState, string> = {
  verified: "Open it to see who checked it, when, and against which document. A preparer can still change it — verification is a fact about the past, not a padlock — but changing it moves the line to Edited, and the old verification stays in the history rather than disappearing.",
  ai_extracted: "Click the amount to jump to the exact box on the document it was read from. Confirm it in one click to make it Verified, or type over it. A return cannot be filed while lines nobody confirmed are still sitting here.",
  needs_review: "This is the work. Open it, compare the AI's reading against the source, then confirm, correct, or ask the client. It cannot be accepted in bulk, and it holds the return out of Ready to file until someone decides.",
  flagged: "Only a resolution clears it. Read the note, reply in the thread attached to the line, then resolve — which records the answer and returns the line to Verified. Editing the number does not clear the flag; a person raised it, so a person closes it.",
  edited: "Same permissions as Verified. The AI's original reading is kept in the line's history and can be restored from there, so an override is never a silent overwrite.",
  calculated: "You cannot type into it, and we do not render a greyed-out box pretending you could. Click it to see the formula and the lines feeding it. To change it, change a source line — this one follows on its own, and tells you it moved.",
  rule: "You cannot type into it. Click it to see which rule produced it and which input drove the rule — filing status, age, dependants. Change that input and the rule re-runs.",
  empty: "A blank is a decision, not an omission. Click it to read why it is blank and who confirmed that. Typing a value in is allowed and moves the line to Edited.",
  locked: "Read-only for everyone, admins included. The return has been filed. Changing a filed number means filing an amendment, which creates a new return — the original stays exactly as it was sent.",
};

const OWNERS: Owner[] = ["preparer", "reviewer", "client", "system", "none"];

const OWNER_MEANING: Record<Owner, string> = {
  preparer: "It is in your queue and nobody else is waiting on anybody. Blue, because it is live work.",
  reviewer: "Handed to a second accountant. You can still read everything; you cannot advance it.",
  client: "Nothing the firm does moves this forward. Amber, because it needs a human who is not in the building.",
  system: "The AI is reading documents. Minutes, not days. Gray, because there is nothing to do but wait.",
  none: "Closed. Filed, resolved, or answered. Green, and it stops appearing in queues.",
};

/* The six hues, stated once. Everything else on this page is a consequence. */
const HUES: { tone: "accent" | "warn" | "ok" | "flag" | "neutral" | "danger"; name: string; means: string }[] = [
  { tone: "accent", name: "Blue", means: "AI produced it, or it is live and active" },
  { tone: "warn", name: "Amber", means: "A human has to do something" },
  { tone: "ok", name: "Green", means: "A person verified it, or it is done" },
  { tone: "flag", name: "Violet", means: "A person flagged it, or it awaits approval" },
  { tone: "neutral", name: "Gray", means: "Locked or calculated — not yours to change" },
  { tone: "danger", name: "Red", means: "Blocked. Never used decoratively" },
];

const AFFORDANCES: { signal: string; means: string; example: string }[] = [
  {
    signal: "A thin border",
    means: "A boundary between two things. It says nothing about whether you may click.",
    example: "Cards, table rows, the document frame.",
  },
  {
    signal: "A soft filled background",
    means: "A state, in the hue for that state. A fill is never a promise that clicking will do something.",
    example: "The amber tint on a row that needs checking.",
  },
  {
    signal: "A solid accent fill with white text",
    means: "The one action that moves this screen's work forward. At most one per screen.",
    example: "Confirm this reading. Send request.",
  },
  {
    signal: "Underline on hover",
    means: "Navigation. You are going somewhere, and the breadcrumb will change.",
    example: "Breadcrumb segments, client names, line references.",
  },
  {
    signal: "Pointer cursor",
    means: "The only universal promise in the product that a click has a consequence. Applied to every button, link, and clickable document box — and to nothing else.",
    example: "A box on a W-2 that reveals which line it feeds.",
  },
  {
    signal: "A value that reveals on click",
    means: "Every number carries provenance. Clicking an amount opens where it came from; it never starts an edit.",
    example: "Clicking $85,000 opens the W-2, Box 1.",
  },
  {
    signal: "An input box",
    means: "You may type here, right now. If a field cannot be typed into, no box is drawn.",
    example: "Editing a line you are permitted to override.",
  },
  {
    signal: "A disabled control",
    means: "Reserved for an action that is genuinely yours but not yet valid — an empty message box, an unanswered required question. Never used to express permission.",
    example: "Send, before anything has been typed.",
  },
];

const NEGATIVES: { rule: string; because: string }[] = [
  {
    rule: "A locked field never renders a disabled input.",
    because: "It renders as plain text with the reason beside it. A greyed-out box still looks like a box, so it invites a click and then refuses it — which reads as a bug, not a policy.",
  },
  {
    rule: "Color is never the only signal.",
    because: "Every state carries a glyph and a word as well as a hue, so the system survives color-blindness, a grayscale printout, and a projector. Turn color off below and read it again.",
  },
  {
    rule: "A state pill is never a button.",
    because: "Status and action are different jobs. If something can be done, there is a real button next to the pill saying what it does.",
  },
  {
    rule: "Gray does not mean unimportant.",
    because: "It means not yours to change. A calculated total is often the most important number on the page.",
  },
  {
    rule: "Red is reserved for blocked.",
    because: "If red also meant delete, or overdue, or simply emphasis, a genuinely stuck return would stop standing out.",
  },
  {
    rule: "An action a role cannot take is not rendered and then refused.",
    because: "It is absent. A client's sidebar has fewer rooms; nobody is shown a door and then told it is locked.",
  },
  {
    rule: "Amber is rationed.",
    because: "It is the single attention color. If everything that might matter were amber, nothing would be — so only states with needsAttention set may use it.",
  },
];

const CONFIDENCE_TIERS: { value: number; band: string; behavior: string }[] = [
  {
    value: 0.99,
    band: "95% and above",
    behavior:
      "Applied quietly. The line shows AI-read and nothing else. High confidence that shouts trains people to click through warnings, which is exactly the habit that lets a real error past.",
  },
  {
    value: 0.88,
    band: "85% to 94%",
    behavior:
      "Applied, but the source box is shown alongside it so a preparer can spot-check in one glance without opening anything.",
  },
  {
    value: 0.68,
    band: "Below 85%",
    behavior:
      "Never applied unattended. The line goes to Check, the value is held rather than written, and the return cannot reach Ready to file while it sits there.",
  },
];

/* -------------------------------------------------------------------------- */

export default function DesignSystemPage() {
  // Color is a redundancy, not the message. This proves it on demand.
  const [mono, setMono] = useState(false);

  return (
    <Shell
      crumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Design system" },
      ]}
    >
      <div className="mx-auto max-w-4xl px-6 py-10">
        <SectionLabel>Reference</SectionLabel>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          Clickable, editable, or neither — decided once, applied everywhere.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          A tax return is a grid of numbers where some are typed by a person, some are
          read by a machine, some are arithmetic, and some are law. If a user has to
          click one to find out which, the interface has failed. This page is the rule
          set that prevents that, and it renders from the same tables the product
          renders from, so it cannot drift out of date.
        </p>

        {/* The rule ------------------------------------------------------- */}
        <Card className="mt-8 p-5">
          <SectionLabel>The rule</SectionLabel>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            One hue per concept, applied identically on every surface — the dashboard,
            the return, the document viewer and the client portal.
          </p>
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {HUES.map((h) => (
              <div key={h.name} className="flex items-baseline gap-3">
                <dt className="w-20 shrink-0">
                  <Chip tone={h.tone}>{h.name}</Chip>
                </dt>
                <dd className="text-sm leading-relaxed text-muted">{h.means}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 border-t border-hair pt-4 text-sm leading-relaxed text-muted">
            <strong className="font-medium text-ink">
              Color is never the only signal.
            </strong>{" "}
            Every state also carries a glyph and a word — <span aria-hidden="true">▲</span>{" "}
            Check, <span aria-hidden="true">✓</span> Verified,{" "}
            <span aria-hidden="true">∑</span> Calculated. Read in grayscale, printed in
            black and white, or seen by someone who cannot distinguish amber from green,
            the system still works. The grayscale switch below is not a gimmick; it is
            the acceptance test for every new state.
          </p>
        </Card>

        {/* Grayscale switch ----------------------------------------------- */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Every state a value can be in
            </h2>
            <p className="mt-1 text-sm text-muted">
              Nine states, in the order a preparer meets them. This list is{" "}
              <code className="rounded bg-locksoft px-1 py-0.5 text-xs">
                FIELD_STATE_ORDER
              </code>
              ; nothing here is written twice.
            </p>
          </div>
          <Button
            onClick={() => setMono((m) => !m)}
            variant={mono ? "primary" : "default"}
            size="sm"
            title="Removes all color from the catalog below"
          >
            {mono ? "Bring color back" : "Read it without color"}
          </Button>
        </div>

        {/* Everything inside this wrapper must survive losing its hue. */}
        <div className={cx(mono && "grayscale")}>
          {/* State catalog ---------------------------------------------- */}
          <Card className="mt-4 divide-y divide-hair">
            {FIELD_STATE_ORDER.map((state) => {
              const meta = FIELD_STATE[state];
              return (
                <div
                  key={state}
                  className="grid gap-3 p-5 md:grid-cols-[13.5rem_1fr]"
                >
                  <div className="flex flex-col items-start gap-2">
                    <StatePill state={state} />
                    <div className="flex flex-wrap gap-1.5">
                      {/* Gray means "not yours to change", so only read-only earns it. */}
                      <Chip tone={meta.editable ? "accent" : "neutral"}>
                        {meta.editable ? "Editable" : "Read-only"}
                      </Chip>
                      {meta.needsAttention ? (
                        <Chip tone="warn">Needs attention</Chip>
                      ) : (
                        <Chip tone="neutral">No action needed</Chip>
                      )}
                    </div>
                    {state === "empty" && (
                      <p className="text-[11px] leading-relaxed text-faint">
                        Renders almost invisibly on purpose — a blank line should not
                        compete with a real one.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm leading-relaxed text-ink">{meta.meaning}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      <span className="font-medium text-ink">What you can do:</span>{" "}
                      {STATE_ACTIONS[state]}
                    </p>
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Same state, three contexts ----------------------------------- */}
          <section className="mt-10">
            <h2 className="text-lg font-semibold tracking-tight">
              The same state, in three places
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              Consistency is only worth claiming if you can show it. Below is one real
              situation — a 1099-INT photographed at an angle, one digit lost to glare —
              as it appears in three parts of the product. The pill, the glyph{" "}
              <span aria-hidden="true">▲</span>, the word Check and the amber are
              identical in all three. Only the density changes.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {/* 1. Inside the return */}
              <div>
                <SectionLabel>1 · In the return</SectionLabel>
                <div
                  className={cx(
                    "mt-2 rounded-lg border border-line px-3 py-2.5",
                    FIELD_STATE.needs_review.rowTint
                  )}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="tnum text-xs text-faint">2b</span>
                    <span className="flex-1 text-sm">Taxable interest</span>
                    <span className="tnum text-sm font-medium">
                      {formatMoney(1462)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <StatePill state="needs_review" confidence={0.68} />
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  A row has room for the number and the reason, so the confidence rides
                  along with the pill.
                </p>
              </div>

              {/* 2. On the dashboard */}
              <div>
                <SectionLabel>2 · On the dashboard</SectionLabel>
                <Card className="mt-2 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">Marcus Rivera</p>
                      <p className="text-xs text-muted">1040 · 2025 · due in 21 days</p>
                    </div>
                    <Grade grade="B" size="sm" />
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <StatePill state="needs_review" compact />
                    <span className="text-xs text-muted">1 line to check</span>
                  </div>
                </Card>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  A card in a list of 240 has no room for a percentage, so the pill goes
                  compact — the glyph and hue survive, the label moves to the tooltip.
                </p>
              </div>

              {/* 3. On the document */}
              <div>
                <SectionLabel>3 · On the document</SectionLabel>
                <div className="mt-2 rounded-lg border-2 border-lockedge bg-canvas p-3">
                  <p className="text-xs font-semibold">1099-INT · Chase Bank N.A.</p>
                  <div className="mt-2 rounded border border-warnedge bg-warnsoft/40 px-2 py-1.5">
                    <span className="block text-[10px] uppercase tracking-wide text-faint">
                      Box 1 · Interest income
                    </span>
                    <span className="tnum text-sm font-medium">$1,4?2.00</span>
                    <span className="ml-1.5 text-[10px] font-semibold text-warn">
                      unclear
                    </span>
                  </div>
                  <div className="mt-2">
                    <StatePill state="needs_review" confidence={0.68} />
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  On the page itself the amber lands on the box, not the row — the
                  uncertainty belongs to a specific set of pixels.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Affordances ----------------------------------------------------- */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">
            What each signal is allowed to mean
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Users learn these in the first minute whether we define them or not. Defining
            them means they learn the right ones.
          </p>

          <Card className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <caption className="sr-only">
                Visual signals and their fixed meanings in Tax Hub
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-4 py-2.5 font-medium text-faint">
                    Signal
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-faint">
                    What it means here
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-faint">
                    Where you see it
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {AFFORDANCES.map((a) => (
                  <tr key={a.signal}>
                    <th
                      scope="row"
                      className="px-4 py-3 text-left align-top font-medium whitespace-nowrap"
                    >
                      {a.signal}
                    </th>
                    <td className="px-4 py-3 align-top leading-relaxed text-muted">
                      {a.means}
                    </td>
                    <td className="px-4 py-3 align-top leading-relaxed text-faint">
                      {a.example}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* The negative rules matter more than the positive ones. */}
          <h3 className="mt-8 text-sm font-semibold">
            And what these signals are forbidden to mean
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {NEGATIVES.map((n) => (
              <Card key={n.rule} className="p-4">
                <p className="text-sm font-medium text-ink">{n.rule}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{n.because}</p>
              </Card>
            ))}
          </div>

          <LockedVsEditableDemo />
        </section>

        {/* Ownership ------------------------------------------------------- */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">Whose move is it?</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Separate from state. A line can be perfectly verified and still be
            nobody&rsquo;s move; a return can be flawless and stuck for three weeks because the client
            has not signed. Ownership answers &ldquo;is this mine?&rdquo; and drives every
            queue, filter and count in the product.
          </p>
          <Card className="mt-4 divide-y divide-hair">
            {OWNERS.map((owner) => (
              <div
                key={owner}
                className="grid gap-2 px-5 py-3.5 md:grid-cols-[11rem_1fr] md:items-baseline"
              >
                <div>
                  <OwnerBadge owner={owner} />
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  {OWNER_MEANING[owner]}
                </p>
              </div>
            ))}
          </Card>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            These badges are written from the firm&rsquo;s side of the desk — &ldquo;Your
            move&rdquo; means the preparer&rsquo;s. Clients never see them. They get the
            client wording below instead, generated from the same value.
          </p>
        </section>

        {/* Status vocabulary ----------------------------------------------- */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">
            One truth, two vocabularies
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            There is one pipeline with one stage value. Staff wording and client wording
            are two renderings of it, not two fields — which is why they cannot drift
            apart and tell two different people two different stories.
          </p>
          <Card className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">
                Each pipeline stage as staff see it and as clients read it
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-4 py-2.5 font-medium text-faint">
                    What staff see
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-faint">
                    What the client reads
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-faint">
                    Whose move
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {STAGE_ORDER.map((stage) => (
                  <tr key={stage}>
                    <th
                      scope="row"
                      className="px-4 py-3 text-left align-middle font-medium whitespace-nowrap"
                    >
                      {STAGE[stage].staff}
                    </th>
                    <td className="px-4 py-3 align-middle text-muted">
                      {STAGE[stage].client}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <OwnerBadge owner={STAGE[stage].owner} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            One stage is deliberately not shown to clients at all: &ldquo;AI
            extraction&rdquo; is folded into &ldquo;We&rsquo;re preparing your
            return&rdquo;. A client does not need to know that a machine finished before
            a person started — that is a detail of how the firm works, not of how their
            return is going.
          </p>
        </section>

        {/* Confidence ------------------------------------------------------- */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">
            How confident the AI is, said out loud
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            A raw score is never printed on its own. A preparer does not need to know the
            model returned 0.68; they need to know whether to go and look. So confidence
            is banded, and the band decides the behavior — not just the wording.
          </p>
          <Card className="mt-4 divide-y divide-hair">
            {CONFIDENCE_TIERS.map((t) => (
              <div
                key={t.value}
                className="grid gap-3 p-5 md:grid-cols-[13.5rem_1fr] md:items-baseline"
              >
                <div className="flex flex-col items-start gap-1.5">
                  <ConfidenceNote value={t.value} />
                  <span className="text-xs text-faint">{t.band}</span>
                </div>
                <p className="text-sm leading-relaxed text-muted">{t.behavior}</p>
              </div>
            ))}
          </Card>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            The tiering is the point: high confidence stays quiet so that low confidence
            can be loud, and low confidence does not merely warn — it blocks. An AI that
            is unsure is not permitted to write a number onto a tax return and hope
            somebody notices.
          </p>
        </section>

        {/* How to extend ---------------------------------------------------- */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">Adding to this system</h2>
          <Card className="mt-3 p-5">
            <ol className="space-y-2.5 text-sm leading-relaxed text-muted">
              <li>
                <strong className="text-ink">1.</strong> Add the state to the{" "}
                <code className="rounded bg-locksoft px-1 py-0.5 text-xs">FieldState</code>{" "}
                union in{" "}
                <code className="rounded bg-locksoft px-1 py-0.5 text-xs">
                  src/lib/types.ts
                </code>
                . TypeScript will then refuse to build until every table below is
                complete — which is the enforcement mechanism, not a formality.
              </li>
              <li>
                <strong className="text-ink">2.</strong> Add a row to{" "}
                <code className="rounded bg-locksoft px-1 py-0.5 text-xs">FIELD_STATE</code>{" "}
                in{" "}
                <code className="rounded bg-locksoft px-1 py-0.5 text-xs">
                  src/lib/design.ts
                </code>
                : a label, a meaning, a glyph, badge classes drawn only from the six hues,
                and honest{" "}
                <code className="rounded bg-locksoft px-1 py-0.5 text-xs">editable</code>{" "}
                and{" "}
                <code className="rounded bg-locksoft px-1 py-0.5 text-xs">
                  needsAttention
                </code>{" "}
                flags. Those two booleans drive real behavior — whether an input renders,
                and whether the line counts against readiness.
              </li>
              <li>
                <strong className="text-ink">3.</strong> Place it in{" "}
                <code className="rounded bg-locksoft px-1 py-0.5 text-xs">
                  FIELD_STATE_ORDER
                </code>
                . That is the whole change. Every pill, row tint, filter and count picks
                it up, including this page.
              </li>
              <li>
                <strong className="text-ink">4.</strong> Write no bespoke styling in a
                component. If a screen needs a state to look different, the screen is
                wrong or the state is missing — those are the only two options.
              </li>
            </ol>
            <p className="mt-4 border-t border-hair pt-3 text-sm leading-relaxed text-muted">
              The test for whether a new state deserves to exist: name its glyph and its
              one-word label, and say what a user can do with a value in it. If any of
              the three is hard, it is not a state — it is a note.
            </p>
          </Card>
        </section>
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The rule from the table above, made pressable.
 *
 * Self-contained on purpose: it demonstrates the affordance contract without
 * writing to a real client's return from a reference page. Everything it claims
 * — click-to-edit on an editable line, no input at all on a locked one, and the
 * calculated total following on its own — is the same behavior the return
 * screen implements against the store.
 */
function LockedVsEditableDemo() {
  const [wages, setWages] = useState(85000);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("85000");
  const [showFormula, setShowFormula] = useState(false);

  const consulting = 12000;
  const total = wages + consulting;

  const commit = () => {
    const next = Number(draft.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(next)) setWages(next);
    setEditing(false);
  };

  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold">Try the difference</h3>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
        Two rows. One you may change, one you may not. Neither of them tells you which
        by greying something out — the editable one accepts a click into an input, and
        the locked one answers the question you were actually asking.
      </p>

      <Card className="mt-3 divide-y divide-hair">
        {/* Editable line ------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-3 p-4">
          <span className="tnum w-8 text-xs text-faint">1a</span>
          <span className="min-w-0 flex-1 text-sm">Wages, salaries, tips</span>
          <StatePill state="verified" />
          {editing ? (
            <span className="flex items-center gap-1.5">
              <label htmlFor="demo-wages" className="sr-only">
                Wages, salaries, tips amount
              </label>
              <input
                id="demo-wages"
                autoFocus
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="tnum w-28 rounded-md border border-accentedge bg-canvas px-2 py-1 text-right text-sm"
              />
              <Button size="sm" variant="primary" onClick={commit}>
                Save
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <button
              onClick={() => {
                setDraft(String(wages));
                setEditing(true);
              }}
              className="tnum rounded-md border border-transparent px-2 py-1 text-sm font-medium hover:border-line hover:bg-panel"
            >
              {formatMoney(wages)}
              <span className="ml-2 text-xs font-normal text-muted">click to edit</span>
            </button>
          )}
        </div>

        {/* Calculated line ------------------------------------------------ */}
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="tnum w-8 text-xs text-faint">9</span>
            <span className="min-w-0 flex-1 text-sm">Total income</span>
            <StatePill state="calculated" />
            <button
              onClick={() => setShowFormula((s) => !s)}
              aria-expanded={showFormula}
              className="tnum rounded-md border border-transparent px-2 py-1 text-sm font-medium hover:border-line hover:bg-panel"
            >
              {formatMoney(total)}
              <span className="ml-2 text-xs font-normal text-muted">
                {showFormula ? "hide the math" : "why can't I edit this?"}
              </span>
            </button>
          </div>
          {showFormula && (
            <div className="mt-3 rounded-lg border border-lockedge bg-locksoft px-3 py-2.5">
              <p className="text-sm text-ink">
                This line is added up from the ones above it, so there is nothing here to
                type into.
              </p>
              <p className="tnum mt-1.5 text-xs text-muted">
                line 1a {formatMoney(wages)} + line 8 {formatMoney(consulting)} ={" "}
                {formatMoney(total)}
              </p>
              <p className="mt-1.5 text-xs text-muted">
                Change line 1a above and watch this follow. That is the whole reason it is
                not editable — two people typing the same total in two places is how
                returns stop adding up.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
