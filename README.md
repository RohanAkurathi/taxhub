# Tax Hub

A prototype client-and-CPA tax platform, built for the GreenGrowth AI Engineer case study.

**Live demo:** _(add your Vercel URL here)_ · **Walkthrough video:** _(add link here)_

---

## Run it

One command. Node 20 or newer is the only requirement.

```bash
git clone https://github.com/RohanAkurathi/taxhub.git && cd taxhub && npm run setup
```

That installs dependencies and starts the dev server at **http://localhost:3000**.

Already cloned? Just `npm run setup`. Already installed? Just `npm run dev`.

### Or run it without installing anything

| | |
| --- | --- |
| **Deploy your own copy** | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RohanAkurathi/taxhub) |
| **Open in a browser IDE** | [github.dev](https://github.dev/RohanAkurathi/taxhub) · [Codespaces](https://codespaces.new/RohanAkurathi/taxhub) |

There is no database, no API keys, and no environment variables. Every screen runs
off hardcoded data, so a fresh clone works immediately and offline.

### Other commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run preview` | Production build, then serve it |
| `npm run check` | TypeScript and ESLint (both are clean) |

---

## The one-paragraph version

Ten challenges were set. I did not build ten demos — I built one platform, because
the ten problems are the same product seen from different angles. A number's
provenance (01), the language for its state (08), and the way the AI's uncertainty
is expressed (10) are three views of a single decision about what a value *is*.
Everything below follows from modelling that once, properly, and letting the
screens render it.

---

## On the stack

The brief was explicit that the frontend is what's being graded, that
production infrastructure is not expected, and that hardcoded data and a faked
AI are the *ideal* use of the time. So this is a TypeScript/React frontend with
no backend at all — building a Flask service underneath it would have spent the
budget on the one part nobody asked to see.

Tailwind is used because it's in the role's required skills, and the design
tokens are defined once in `globals.css` rather than scattered as utility
soup. Where a real backend belongs is set out under
[going to production](#if-this-were-going-to-production-here), against the
Python/Flask/PostgreSQL stack the role actually maintains.

---

## Start here

| Where | What it shows |
| --- | --- |
| `/` | A one-screen orientation with four entry points |
| `/dashboard` | "What should I work on right now" across 240 returns |
| `/returns/ret-rivera-2025` | **The main screen.** The whole return, every line traced to its source |
| `/returns/ret-rivera-2025/messages` | The conversation layer, with the internal/client wall |
| `/home` | The same firm, seen by a client |
| `/design-system` | The interaction rules, as a working reference |

### The 90-second demo path

1. Open `/returns/ret-rivera-2025`. Click any line — including a calculated one
   (line 9), a blank one (line 7), and one sourced from a questionnaire answer
   (line 26). Each answers the same four questions.
2. Select **line 2b**. The AI read `$1,432` from a smudged 1099-INT at 68%
   confidence; the return says `$1,240`. The **Confirm** button is disabled.
3. Click the highlighted box on the document. Confirm unlocks.
4. Confirm. Six downstream lines recalculate, the banner reports each change, the
   refund drops from $1,333 to $1,291, and the readiness grade rises.
5. Switch to **Reviewer** (top right) and open Elena Petrov's 1120-S — 41 lines
   and 40 documents. The verbs change to approve and send back, and Documents
   filters to the four files the AI struggled with.
6. Go to `/returns/ret-rivera-2025/messages` and toggle **Client's view** — every
   internal note disappears, and the status even re-words itself.
7. Switch to **Myself (client)** to see the same firm from the other side, on a
   brand-new account.

---

## What is real, and what is simulated

The brief asked for this explicitly, so here it is without hedging.

### Simulated

- **The AI. No model is called anywhere.** Extractions, confidence scores,
  rationales and warnings are hardcoded in [`src/lib/mockAI.ts`](src/lib/mockAI.ts).
  That file's purpose is to pin down the *response contract* a real
  document-understanding service would fill, so the interface could be designed
  and judged against a realistic shape.
- **Documents.** There is no OCR and no PDF. Source documents are rendered as
  styled HTML from hardcoded field data (`DocumentView` in `src/components/ui.tsx`).
  This was deliberate rather than lazy: it lets a specific box be highlighted
  exactly, at any size, which is the part of traceability that actually needed
  proving.
- **Persistence.** Everything lives in React state. A refresh resets the world.
- **Auth.** The role switcher changes context directly. There are no accounts.
- **Volume.** 237 of the 240 returns are generated by a seeded PRNG
  (`src/lib/mockVolume.ts`). Three are hand-authored in full detail.

### Real

- **The state machine on every value** — nine states, defined once in
  `src/lib/design.ts` and rendered from that table everywhere. This is what stops
  "needs review" looking one way on the dashboard and another inside a return.
- **The tax math.** `src/lib/calc.ts` implements the 2025 single-filer brackets
  and a dependency graph across the 1040. When you confirm line 2b, the
  recalculation is genuinely computed — that is why the refund moves by $42 and
  not by a number I typed in.
- **The audit trail.** Values are never mutated blindly; every change appends a
  history entry with actor, action, and before/after. The uploaded document is
  treated as immutable.
- **Prioritization.** `computePriority` ranks 240 returns by deadline pressure,
  days blocked, and whose move it is. Every card shows the reason for its rank,
  so the ordering is arguable rather than magic.
- **Search and filtering** over the full 240, with filter state in the URL.
- **The permission boundary.** Internal notes are filtered by `visibility`, not
  hidden with CSS.

---

## How the ten challenges are covered

| # | Challenge | Where | The decision worth defending |
| --- | --- | --- | --- |
| 01 | Source document traceability | Return workspace inspector | Provenance is a *required field on every line*, with five kinds: document box, client answer, calculation, tax rule, and deliberate blank. A blank line still has a story — recording it is what stops the next person wondering if something was missed. |
| 02 | Client & CPA collaboration | `/returns/[id]/messages`, `/requests` | One conversation per return, not an inbox. Internal notes interleave in place. Requests are objects with an owner and a status that **resolve back onto the return line** they are anchored to. |
| 03 | Where to start | `/home` | The journey timeline is permanent context; the checklist is the action. One task is visually dominant at a time. After onboarding the checklist area becomes a status panel — one screen, both lives. |
| 04 | Getting lost | Breadcrumbs, deep links, anchor chips | The selected line lives in the URL. A request's anchor chip jumps to the exact line; the line's inspector links back to the conversation. A number and the discussion about it are one object seen from two sides. |
| 05 | Role-aware experiences | Shell + role switcher | One skeleton; role changes which rooms exist. Permissions are communicated by architecture, not by an error after a click. A reviewer's **verbs differ from a preparer's** — approve and send back, never confirm and edit — because a second pair of eyes that quietly fixes things is not a second pair of eyes. Includes the firm employee who is also a client of the firm. |
| 06 | Return status & progress | `STAGE` table, client journey | One pipeline, two vocabularies, rendered from the same value — so they cannot drift. Staff read "In preparation"; the client reads "We're preparing your return". |
| 07 | An actionable dashboard | `/dashboard` | Columns are **ownership**, not process stage, because the only question that matters at 8am is whose move it is. Ranking is explainable on every card. Truncation is always stated. |
| 08 | Clickable vs editable | `/design-system` + everywhere | One hue per concept, and color is never the only signal — every state also carries a glyph and a word, so it survives greyscale. A locked field renders as text with a reason, never a disabled input, because a greyed-out box invites clicking. |
| 09 | Complexity made navigable | `/returns`, return outline, `/returns/[id]/documents` | Volume at two scales: 240 returns across the firm, and a single business return carrying 41 lines and 40 documents. Both stay navigable through sectioning, search, and filters that are lenses rather than defaults. The return shows **all** lines by default — a preparer must be able to sign their name to every one. |
| 10 | Trustworthy AI | Inspector, warnings, confirm gate | Confidence is tiered, not dumped. Below 85% the AI may not populate a field unattended, and confirming is gated behind clicking the value on the source. Every suggestion carries a rationale and independent corroboration. |

---

## Three decisions I would defend in a room

**1. The review screen shows the whole return, not a queue of problems.**
An earlier version showed only the flagged lines — it was faster, and wrong. A
preparer signs their name to every number, and cannot do that through an
interface that only ever shows them the broken ones. Because the healthy lines
render calm, the two that need attention are still impossible to miss. "Needs
attention" exists as a filter; it is never the default.

**2. Confirming a low-confidence value requires clicking the source.**
The obvious design is a one-click accept. But a tax return is a legal document,
and there is a real difference between *a human approved this* and *a human
clicked past it*. Requiring one click on the highlighted box is a small price for
making that difference true. High-confidence values stay quiet and cost nothing —
the friction is applied precisely where the risk is.

**3. The AI is never allowed to silently write an uncertain value.**
Below the threshold it must surface a suggestion beside the current value and
wait. A plausible guess in a tax return is worse than an obvious gap, because the
gap gets caught.

---

## Privacy, explainability and auditability

A tax platform holds about the most sensitive personal data there is — SSNs,
income, dependents, bank details — so these were treated as design constraints
from the first screen rather than a compliance pass at the end.

| Requirement | How it is built in |
| --- | --- |
| **Explainability** | No number is displayed without its origin. Provenance is a required field on every line, and the interface makes the AI state *why* it read what it read, plus independent corroboration. There is no path to a value whose derivation cannot be shown. |
| **Auditability** | The uploaded document is immutable; every change is an appended entry with actor, action, timestamp, and before/after. The audit trail is the storage model, not a log written alongside it — which is what makes it trustworthy under scrutiny. |
| **Human accountability** | The AI may not populate a field below the confidence threshold, and confirming an uncertain reading requires opening the source. Every value ends up attributable to a named person, which is what a preparer signing a return actually needs. |
| **Data minimization** | Every message carries a `visibility` field, and the client view is built by filtering the set rather than rendering everything and hiding some of it. In this prototype that filter runs client-side because there is no server; the point is that the boundary lives in the data model, so moving it behind an API is a change of location, not of design. |
| **Right to explanation** | The client-facing return view exists specifically so a taxpayer can see every figure on their own return and where it came from, in plain language — the practical form of GDPR Article 22's explanation right. |

Not built, and honestly out of scope for a prototype: encryption at rest, PII
redaction in logs, retention schedules, consent records, and DSAR tooling.

---

## If this were going to production here

GreenGrowth runs a Python/Flask/PostgreSQL monolith on AWS Lightsail. This
prototype is a frontend, so it would attach to that rather than replace it:

1. **Extraction service.** Replace `mockAI.ts` with a Flask endpoint calling a
   vision-capable model (Anthropic's API is the natural fit) with structured
   output, returning the exact shape `AIExtraction` already defines. The
   contract does not change — that was the point of writing it down. Real
   bounding boxes replace the hardcoded box IDs so highlights land on pixels.
2. **Postgres schema.** `documents` and `return_lines` map cleanly to tables;
   `transforms` becomes the append-only audit table the in-memory history is
   already shaped like. Every row carries a firm id for tenancy.
3. **The review loop.** Every extraction below the auto-apply threshold goes to
   a human queue, and each accept/reject is written back as labelled evaluation
   data. That loop is how the confidence numbers earn their keep, and it is the
   part most AI features skip.
4. **QuickBooks.** Expense and income data pulled through the Intuit API becomes
   another `Provenance` kind alongside documents and questionnaire answers — the
   model was built with that extension in mind.
5. **Everything else:** real auth and per-firm tenancy, a screen-reader pass, and
   print stylesheets, because accountants print.

---

## Notable files

| File | Why it matters |
| --- | --- |
| `src/lib/types.ts` | The domain model. Provenance is the center of it. |
| `src/lib/design.ts` | The interaction system and status vocabulary, as data. |
| `src/lib/mockAI.ts` | The simulated AI and its contract. |
| `src/lib/calc.ts` | Real bracket math and the recalculation graph. |
| `src/lib/store.tsx` | State, mutations, and the audit trail. |
| `src/components/return/Inspector.tsx` | Traceability, rendered five ways. |

The prototype is pinned to a fixed demo date of 25 March 2026, three weeks from
the filing deadline, so the story stays consistent whenever it is opened.
