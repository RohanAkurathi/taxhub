# Tax Hub

A prototype tax platform for a CPA firm and its clients, built for the GreenGrowth
AI Engineer case study. It covers all ten challenges in the brief.

**Live: [taxhub-chi.vercel.app](https://taxhub-chi.vercel.app)** · **Video: [watch the walkthrough](https://github.com/RohanAkurathi/taxhub/releases/download/v1.0/TaxHub-walkthrough.mp4)** (12 min)

The home page is a guided tour: six stops in order, each saying what to try and
which challenges it covers. Start there.

## Run it

It is already deployed, so nothing needs installing. To run it locally you need
Node 20 or newer:

```bash
git clone https://github.com/RohanAkurathi/taxhub.git && cd taxhub && npm run setup
```

That installs and starts the app at http://localhost:3000. If you have already
cloned it, `npm run setup` on its own is enough.

There is no database, no API keys and no environment variables. Everything runs
off hardcoded data, so a fresh clone works offline.

| Command | |
| --- | --- |
| `npm run dev` | dev server |
| `npm run preview` | production build, then serve it |
| `npm run check` | TypeScript and ESLint |

## What is simulated

**The AI.** No model is called anywhere. Extractions, confidence scores,
rationales and warnings are hardcoded in `src/lib/mockAI.ts`. That file exists to
pin down the response shape a real extraction service would return, so the
interface could be designed against something realistic.

**Documents.** No OCR, no PDFs. Source documents are drawn as HTML from hardcoded
field data. That was a deliberate choice: it lets one specific box be highlighted
exactly, which is the part of traceability worth proving.

**Persistence.** State lives in memory. A refresh resets everything.

**Auth.** The role switcher changes context directly. There are no accounts.

**Volume.** 235 of the 240 returns are generated from a seeded random number
generator. Five are written out in full.

## What is real

**The tax math.** `src/lib/calc.ts` has the 2025 single-filer brackets and a
dependency graph across the 1040. Confirming line 2b on Marcus Rivera's return
recalculates six lines and moves the refund by $42 because that is what the
arithmetic produces.

**The state machine.** Nine states a value can be in, defined once in
`src/lib/design.ts` and rendered from that one table everywhere. Statuses cannot
drift between screens because there is only one definition.

**The audit trail.** Every change appends an entry with actor, action, timestamp
and before/after. The uploaded document is never modified. Undo works because of
this, not alongside it.

**Prioritisation.** `computePriority` ranks all 240 returns on deadline pressure,
days blocked and whose move it is. Each card shows why it ranks where it does.

**Search and filtering** across all 240 returns, with the filter state in the URL.

**The permission boundary.** Internal notes are filtered by a `visibility` field
on the data, not hidden with CSS.

## Decisions I would explain

**The review screen shows the whole return, not a queue of problems.** An earlier
version showed only flagged lines. It was faster and it was wrong: a preparer
signs their name to every number and cannot do that through a screen that only
shows the broken ones. The healthy lines render quietly, so the two that need
attention are still the loudest thing there. "Needs attention" is a filter, never
the default.

**Confirming a low-confidence value requires clicking the source first.** The
obvious design is one-click accept. But there is a real difference between a
human approving a number and a human clicking past it, and on a legal document
that difference is worth one click. High-confidence values stay quiet and cost
nothing, so the friction lands only where the risk is.

**The AI may not silently write an uncertain value.** Below 85% confidence it has
to show its suggestion next to the current value and wait. A plausible wrong
number in a tax return is worse than a blank, because the blank gets caught.

**Confidence is per value, not per document.** Clients photograph forms on their
phones rather than scanning them, so glare is local. One box can be perfectly
legible and the box beside it unreadable.

**One pipeline, two vocabularies.** Staff read "In preparation" and the client
reads "We're preparing your return", both rendered from the same stored value.
There is no second status field to fall out of sync.

## Where each challenge lives

| # | Challenge | Where |
| --- | --- | --- |
| 01 | Source document traceability | `/returns/ret-rivera-2025` — click any line |
| 02 | Client & CPA collaboration | `/returns/ret-rivera-2025/messages` |
| 03 | Where to start | `/home` as Jordan Reyes, a day-one account |
| 04 | Getting lost between parts | breadcrumbs, anchor chips, line in the URL |
| 05 | Role-aware experiences | role switcher, top right — six roles |
| 06 | Return status & progress | client journey on `/home`, `STAGE` in `design.ts` |
| 07 | An actionable dashboard | `/dashboard` |
| 08 | Clickable vs editable | `/design-system`, and every screen |
| 09 | Complexity made navigable | `/returns`, and Elena Petrov's 41 lines / 40 documents |
| 10 | Trustworthy AI | line 2b of Marcus Rivera's return |

## If this went to production

The frontend would attach to the existing Python/Flask/PostgreSQL stack rather
than replace it. `mockAI.ts` becomes a Flask endpoint calling a vision model with
structured output, returning the shape `AIExtraction` already defines. The
history entries become an append-only Postgres table. Extractions below the
threshold go to a human queue, and each accept or reject is written back as
labelled evaluation data. QuickBooks data would arrive as another `Provenance`
kind alongside documents and questionnaire answers.

Not built, and out of scope for a prototype: real auth, encryption at rest,
retention policies, and a screen-reader pass.

---

The demo is pinned to 25 March 2026, three weeks before the filing deadline, so
the story reads the same whenever it is opened.
