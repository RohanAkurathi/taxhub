import type { ReturnLine } from "./types";

/* ---------------------------------------------------------------------------
   The calculation engine.

   This is one of the few places in the prototype where the logic is real
   rather than simulated. Calculated lines genuinely recompute from their
   inputs, including a progressive bracket calculation, because the whole
   point of showing a preparer "this line is calculated, edit its sources
   instead" is undermined if the number doesn't actually move when they do.
--------------------------------------------------------------------------- */

interface Bracket {
  upTo: number;
  rate: number;
}

/** 2025 federal brackets, single filer. */
const SINGLE_2025: Bracket[] = [
  { upTo: 11_925, rate: 0.1 },
  { upTo: 48_475, rate: 0.12 },
  { upTo: 103_350, rate: 0.22 },
  { upTo: 197_300, rate: 0.24 },
  { upTo: 250_525, rate: 0.32 },
  { upTo: 626_350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

export function federalTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let floor = 0;
  for (const b of SINGLE_2025) {
    if (taxableIncome <= floor) break;
    const slice = Math.min(taxableIncome, b.upTo) - floor;
    tax += slice * b.rate;
    floor = b.upTo;
  }
  return Math.round(tax);
}

/** Marginal rate, used to explain the effect of a change to a client. */
export function marginalRate(taxableIncome: number): number {
  for (const b of SINGLE_2025) {
    if (taxableIncome <= b.upTo) return b.rate;
  }
  return 0.37;
}

/* -------------------------------------------------------------------------- */
/* Dependency graph for a 1040                                                 */
/* -------------------------------------------------------------------------- */

type Rule = { from: string[]; compute: (get: (id: string) => number) => number };

const RULES: Record<string, Rule> = {
  "9": {
    from: ["1a", "2b", "3b", "7", "8"],
    compute: (g) => g("1a") + g("2b") + g("3b") + g("7") + g("8"),
  },
  "11": { from: ["9", "10"], compute: (g) => g("9") - g("10") },
  "15": {
    from: ["11", "12", "12b", "13"],
    compute: (g) => Math.max(0, g("11") - Math.max(g("12"), g("12b")) - g("13")),
  },
  "16": { from: ["15"], compute: (g) => federalTax(g("15")) },
  "24": { from: ["16"], compute: (g) => g("16") },
  "33": { from: ["25a", "26"], compute: (g) => g("25a") + g("26") },
  "34": { from: ["33", "24"], compute: (g) => g("33") - g("24") },
};

/** Order calculated lines so inputs are always computed before dependents. */
const EVAL_ORDER = ["9", "11", "15", "16", "24", "33", "34"];

export interface RecalcChange {
  lineId: string;
  from: number | null;
  to: number;
}

/**
 * Recomputes every calculated line and reports what moved, so the UI can
 * show the downstream consequence of an edit rather than silently changing
 * six numbers while the user is looking at one of them.
 */
export function recalculate(lines: ReturnLine[]): {
  lines: ReturnLine[];
  changes: RecalcChange[];
} {
  const byId = new Map(lines.map((l) => [l.id, { ...l }]));
  const get = (id: string) => byId.get(id)?.amount ?? 0;
  const changes: RecalcChange[] = [];

  for (const id of EVAL_ORDER) {
    const line = byId.get(id);
    const rule = RULES[id];
    if (!line || !rule) continue;

    const next = rule.compute(get);
    if (next !== line.amount) {
      changes.push({ lineId: id, from: line.amount, to: next });

      // Keep the provenance honest: a calculated line's inputs are part of
      // its explanation, so they have to move with the value.
      const provenance =
        line.provenance.kind === "calculation"
          ? {
              ...line.provenance,
              inputs: line.provenance.inputs.map((inp) => ({
                ...inp,
                amount: get(inp.lineId),
              })),
            }
          : line.provenance;

      byId.set(id, {
        ...line,
        amount: next,
        provenance,
        history: [
          {
            at: new Date().toISOString(),
            actor: "System",
            action: "recalculated" as const,
            detail: `Recomputed from ${rule.from.join(", ")}`,
            from: line.amount,
            to: next,
          },
          ...line.history,
        ],
      });
    }
  }

  return { lines: lines.map((l) => byId.get(l.id) ?? l), changes };
}

/** Which lines would move if this one changed — shown before an edit lands. */
export function downstreamOf(lineId: string): string[] {
  const out = new Set<string>();
  const visit = (id: string) => {
    for (const [target, rule] of Object.entries(RULES)) {
      if (rule.from.includes(id) && !out.has(target)) {
        out.add(target);
        visit(target);
      }
    }
  };
  visit(lineId);
  return EVAL_ORDER.filter((id) => out.has(id));
}
