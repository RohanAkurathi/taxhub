"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Shell } from "@/components/Shell";
import { Button, Card, EmptyState, Grade, OwnerBadge, SectionLabel, cx } from "@/components/ui";
import { OWNER_LABEL, STAGE, STAGE_ORDER } from "@/lib/design";
import { daysUntil } from "@/lib/mockData";
import { ALL_RETURNS, filterReturns, type ReturnFilters } from "@/lib/mockVolume";
import { useStore } from "@/lib/store";
import type { FormType, Owner, ReturnSummary, Stage } from "@/lib/types";

/* ---------------------------------------------------------------------------
   All returns — the firm's whole book of business (challenge 09).

   240 rows is the point. The design bet here is that volume is survivable when
   three things are true: you can describe what you want in one input, the
   filters tell you how many rows they would leave *before* you click them, and
   the resulting view has an address you can paste to a colleague.

   Every filter lives in the URL, so "Rita's blocked 1120-S returns, worst
   readiness first" is a link rather than a set of instructions (challenge 04).
--------------------------------------------------------------------------- */

const OWNER_VALUES: Owner[] = ["preparer", "client", "reviewer", "system", "none"];
const FORM_VALUES: FormType[] = ["1040", "1120-S", "1065", "1120"];

type SortKey = NonNullable<ReturnFilters["sort"]>;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "priority", label: "Priority" },
  { key: "due", label: "Due date" },
  { key: "name", label: "Client name" },
  { key: "readiness", label: "Readiness — worst first" },
  { key: "activity", label: "Last activity" },
];

const PAGE = 40;

/* -------------------------------------------------------------------------- */

export default function ReturnsPage() {
  return (
    <Shell crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "All returns" }]}>
      {/* useSearchParams opts this subtree into client rendering, so Next 16
          requires a Suspense boundary around it. */}
      <Suspense
        fallback={
          <div className="px-6 py-8 text-sm text-muted">Loading the firm&rsquo;s returns…</div>
        }
      >
        <ReturnsBrowser />
      </Suspense>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return [];
  return raw.split(",").filter((v): v is T => (allowed as readonly string[]).includes(v));
}

function ReturnsBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { returns: liveReturns } = useStore();

  // The URL seeds the initial state and nothing more. Reading it on every
  // render as well would fight the router.replace below for control.
  const [f, setF] = useState<ReturnFilters>(() => ({
    query: params.get("q") ?? "",
    stages: parseList<Stage>(params.get("stage"), STAGE_ORDER),
    owners: parseList<Owner>(params.get("owner"), OWNER_VALUES),
    formTypes: parseList<FormType>(params.get("form"), FORM_VALUES),
    blockedOnly: params.get("blocked") === "1",
    scope: params.get("scope") === "mine" ? "mine" : "team",
    sort:
      SORTS.find((s) => s.key === params.get("sort"))?.key ?? ("priority" as SortKey),
  }));
  const [grouped, setGrouped] = useState(params.get("group") === "stage");
  const [limit, setLimit] = useState(PAGE);
  const [moreFilters, setMoreFilters] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  /* Keep the address bar honest: any view here is a link someone can send. */
  useEffect(() => {
    const p = new URLSearchParams();
    if (f.query) p.set("q", f.query);
    if (f.stages?.length) p.set("stage", f.stages.join(","));
    if (f.owners?.length) p.set("owner", f.owners.join(","));
    if (f.formTypes?.length) p.set("form", f.formTypes.join(","));
    if (f.blockedOnly) p.set("blocked", "1");
    if (f.scope === "mine") p.set("scope", "mine");
    if (f.sort && f.sort !== "priority") p.set("sort", f.sort);
    if (grouped) p.set("group", "stage");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [f, grouped, pathname, router]);

  /* A narrowed list should always start at the top of its first page. This is
     the render-phase "adjust state when inputs change" pattern rather than an
     effect, so the reset lands in the same pass as the new filters. */
  const signature = JSON.stringify(f);
  const [prevSignature, setPrevSignature] = useState(signature);
  if (prevSignature !== signature) {
    setPrevSignature(signature);
    setLimit(PAGE);
  }

  /* "/" jumps to search — this list is somewhere a preparer lives all day. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /**
   * The three hand-authored returns are editable elsewhere in the product, so
   * their readiness is read from the store rather than from the static book.
   * Verify a line on a return page and its grade has already moved here.
   */
  const rows: ReturnSummary[] = useMemo(
    () =>
      ALL_RETURNS.map((r) => {
        const live = liveReturns.find((x) => x.id === r.id);
        if (!live) return r;
        return {
          ...r,
          stage: live.stage,
          readinessGrade: live.readiness.grade,
          readinessScore: live.readiness.score,
          openItems: live.readiness.openItems,
          lastActivity: live.lastActivity,
        };
      }),
    [liveReturns]
  );

  const filtered = useMemo(() => filterReturns(rows, f), [rows, f]);
  const visible = filtered.slice(0, limit);

  /**
   * Each filter option carries the count it would leave, computed with that
   * one dimension released. Without it, filtering 240 rows is guesswork and
   * every dead end costs a click to discover.
   */
  const counts = useMemo(() => {
    const tally = <K extends string>(base: ReturnSummary[], key: (r: ReturnSummary) => K) => {
      const m = {} as Record<K, number>;
      for (const r of base) m[key(r)] = (m[key(r)] ?? 0) + 1;
      return m;
    };
    return {
      stage: tally(filterReturns(rows, { ...f, stages: [] }), (r) => r.stage),
      owner: tally(filterReturns(rows, { ...f, owners: [] }), (r) => r.owner),
      form: tally(filterReturns(rows, { ...f, formTypes: [] }), (r) => r.formType),
      blocked: filterReturns(rows, { ...f, blockedOnly: false }).filter(
        (r) => (r.blockedDays ?? 0) > 0
      ).length,
      mine: filterReturns(rows, { ...f, scope: "mine" }).length,
    };
  }, [rows, f]);

  /* --- filter mutation helpers ------------------------------------------- */

  function toggle<T>(list: T[] | undefined, value: T): T[] {
    const cur = list ?? [];
    return cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  }

  const clearAll = () =>
    setF({
      query: "",
      stages: [],
      owners: [],
      formTypes: [],
      blockedOnly: false,
      scope: "team",
      sort: f.sort,
    });

  /* Active filters, flattened into removable chips. */
  const active: { key: string; label: string; remove: () => void }[] = [];
  if (f.query)
    active.push({
      key: "q",
      label: `Matching “${f.query}”`,
      remove: () => setF((c) => ({ ...c, query: "" })),
    });
  if (f.scope === "mine")
    active.push({
      key: "scope",
      label: "Prepared by Jordan Reyes",
      remove: () => setF((c) => ({ ...c, scope: "team" })),
    });
  for (const s of f.stages ?? [])
    active.push({
      key: `stage-${s}`,
      label: STAGE[s].staff,
      remove: () => setF((c) => ({ ...c, stages: toggle(c.stages, s) })),
    });
  for (const o of f.owners ?? [])
    active.push({
      key: `owner-${o}`,
      label: OWNER_LABEL[o],
      remove: () => setF((c) => ({ ...c, owners: toggle(c.owners, o) })),
    });
  for (const t of f.formTypes ?? [])
    active.push({
      key: `form-${t}`,
      label: `Form ${t}`,
      remove: () => setF((c) => ({ ...c, formTypes: toggle(c.formTypes, t) })),
    });
  if (f.blockedOnly)
    active.push({
      key: "blocked",
      label: "Blocked only",
      remove: () => setF((c) => ({ ...c, blockedOnly: false })),
    });

  /* Groups are cut from the visible slice, so "show more" keeps working. */
  const groups = useMemo(() => {
    if (!grouped) return [{ key: null as Stage | null, rows: visible }];
    return STAGE_ORDER.map((s) => ({
      key: s as Stage | null,
      rows: visible.filter((r) => r.stage === s),
    })).filter((g) => g.rows.length > 0);
  }, [grouped, visible]);

  return (
    <div className="px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>The firm&rsquo;s book of business</SectionLabel>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">All returns</h1>
        </div>
        <p className="text-sm text-muted">
          Tax year 2025 · <span className="tnum">{ALL_RETURNS.length}</span> returns across six staff
        </p>
      </div>

      {/* Search + sort ---------------------------------------------------- */}
      <Card className="mt-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[18rem] flex-1">
            <input
              ref={searchRef}
              type="search"
              value={f.query ?? ""}
              onChange={(e) => setF((c) => ({ ...c, query: e.target.value }))}
              placeholder="Search a client, a preparer, a form, or what a return is stuck on"
              aria-label="Search returns"
              className="w-full rounded-md border border-line bg-canvas px-3 py-1.5 pr-16 text-sm placeholder:text-faint focus:border-accentedge"
            />
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] text-faint"
            >
              /
            </kbd>
          </div>

          <label className="flex items-center gap-1.5 text-sm text-muted">
            Sort
            <select
              value={f.sort}
              onChange={(e) =>
                setF((c) => ({ ...c, sort: e.target.value as SortKey }))
              }
              className="rounded-md border border-line bg-canvas px-2 py-1.5 text-sm text-ink"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <FilterPill
            active={grouped}
            onClick={() => setGrouped((g) => !g)}
            label="Group by stage"
          />
        </div>

        {/* Filter dimensions --------------------------------------------
            One question leads: whose move is it. Stage and form matter, but
            showing every facet at once made the controls heavier than the
            table they filter — the classic way a power screen stops being
            approachable (challenge 09 asks for both at once). */}
        <div className="mt-3 space-y-2 border-t border-hair pt-3">
          <FilterRow label="Show">
            {OWNER_VALUES.map((o) => (
              <FilterPill
                key={o}
                active={(f.owners ?? []).includes(o)}
                count={counts.owner[o] ?? 0}
                onClick={() => setF((c) => ({ ...c, owners: toggle(c.owners, o) }))}
                label={OWNER_LABEL[o]}
              />
            ))}
            <FilterPill
              active={Boolean(f.blockedOnly)}
              count={counts.blocked}
              onClick={() => setF((c) => ({ ...c, blockedOnly: !c.blockedOnly }))}
              label="Blocked"
            />
            <FilterPill
              active={f.scope === "mine"}
              count={counts.mine}
              onClick={() =>
                setF((c) => ({ ...c, scope: c.scope === "mine" ? "team" : "mine" }))
              }
              label="Mine"
            />
            <button
              onClick={() => setMoreFilters((v) => !v)}
              aria-expanded={moreFilters}
              className="rounded-full px-2.5 py-0.5 text-xs font-medium text-accentink hover:bg-accentsoft"
            >
              {moreFilters ? "Fewer filters" : "More filters"}
            </button>
          </FilterRow>

          {moreFilters && (
            <>
              <FilterRow label="Stage">
                {STAGE_ORDER.map((st) => (
                  <FilterPill
                    key={st}
                    active={(f.stages ?? []).includes(st)}
                    count={counts.stage[st] ?? 0}
                    onClick={() => setF((c) => ({ ...c, stages: toggle(c.stages, st) }))}
                    label={STAGE[st].staff}
                  />
                ))}
              </FilterRow>

              <FilterRow label="Form">
                {FORM_VALUES.map((t) => (
                  <FilterPill
                    key={t}
                    active={(f.formTypes ?? []).includes(t)}
                    count={counts.form[t] ?? 0}
                    onClick={() =>
                      setF((c) => ({ ...c, formTypes: toggle(c.formTypes, t) }))
                    }
                    label={t}
                  />
                ))}
              </FilterRow>
            </>
          )}
        </div>

        {/* Active filters ------------------------------------------------ */}
        {active.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-hair pt-3">
            <span className="text-xs text-faint">Filtered by</span>
            {active.map((a) => (
              <span
                key={a.key}
                className="inline-flex items-center gap-1 rounded-full border border-accentedge bg-accentsoft px-2.5 py-0.5 text-xs font-medium text-accentink"
              >
                {a.label}
                <button
                  type="button"
                  onClick={a.remove}
                  aria-label={`Remove filter: ${a.label}`}
                  className="text-accentink/70 hover:text-accentink"
                >
                  ×
                </button>
              </span>
            ))}
            <Button size="sm" variant="quiet" onClick={clearAll}>
              Clear all
            </Button>
          </div>
        )}
      </Card>

      {/* Count line — always shown, so a filter never silently eats rows. */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">
          Showing <span className="tnum font-medium text-ink">{filtered.length}</span> of{" "}
          <span className="tnum">{ALL_RETURNS.length}</span> returns
          {filtered.length > visible.length && (
            <>
              {" "}
              · <span className="tnum">{visible.length}</span> on screen
            </>
          )}
        </p>
        {f.sort === "priority" && filtered.length > 0 && (
          <p className="text-xs text-faint">
            Priority ranks stuck work above merely urgent work
          </p>
        )}
      </div>

      {/* Table ---------------------------------------------------------- */}
      <Card className="mt-2 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title="No returns match these filters"
            detail="Nothing in the firm's 240 returns fits every filter you have on. Loosen one, or start over."
            action={
              <div className="mt-1">
                <Button onClick={clearAll}>Clear all filters</Button>
              </div>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-panel">
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                  <th scope="col" className="px-4 py-2 font-semibold" aria-sort={f.sort === "name" ? "ascending" : "none"}>
                    Client
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">Form</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Stage</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Whose move</th>
                  <th scope="col" className="px-3 py-2 font-semibold" aria-sort={f.sort === "due" ? "ascending" : "none"}>
                    Due
                  </th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold" aria-sort={f.sort === "readiness" ? "ascending" : "none"}>
                    Readiness
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Open items</th>
                </tr>
              </thead>

              {groups.map((g) => (
                <tbody key={g.key ?? "all"}>
                  {g.key && (
                    <tr className="bg-ground">
                      <th
                        scope="colgroup"
                        colSpan={8}
                        className="border-y border-line px-4 py-1.5 text-left text-xs font-semibold text-muted"
                      >
                        {STAGE[g.key].staff}
                        <span className="tnum ml-2 font-normal text-faint">
                          {g.rows.length}
                        </span>
                      </th>
                    </tr>
                  )}
                  {g.rows.map((r) => (
                    <Row key={r.id} r={r} />
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}

        {/* Progressive disclosure: 240 rows are never poured out at once. */}
        {filtered.length > visible.length && (
          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-line px-4 py-3">
            <Button onClick={() => setLimit((l) => l + PAGE)}>
              Show {Math.min(PAGE, filtered.length - visible.length)} more
            </Button>
            <span className="text-xs text-muted">
              <span className="tnum">{filtered.length - visible.length}</span> more match
              these filters
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-24 shrink-0 text-xs text-faint">{label}</span>
      {children}
    </div>
  );
}

function FilterPill({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        active
          ? "border-accentedge bg-accentsoft text-accentink"
          : "border-line bg-canvas text-muted hover:border-lockedge hover:text-ink"
      )}
    >
      {label}
      {count !== undefined && <span className="tnum opacity-60">{count}</span>}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

function dueLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function Row({ r }: { r: ReturnSummary }) {
  const days = daysUntil(r.dueDate);
  const blocked = (r.blockedDays ?? 0) > 0;

  return (
    // `relative` plus a stretched link makes the whole row a single target
    // without nesting interactive elements inside one another.
    <tr className="relative border-b border-hair transition-colors last:border-0 hover:bg-panel">
      <td className="px-4 py-2">
        <Link
          href={`/returns/${r.id}`}
          className="font-medium text-ink after:absolute after:inset-0 hover:text-accentink hover:underline"
        >
          {r.clientName}
        </Link>
        {blocked ? (
          <span className="mt-0.5 block max-w-[22rem] truncate text-[11px] text-muted">
            <span
              className={
                (r.blockedDays ?? 0) >= 8
                  ? "font-medium text-danger"
                  : (r.blockedDays ?? 0) >= 4
                  ? "font-medium text-warn"
                  : "font-medium"
              }
            >
              Stuck {r.blockedDays} days
            </span>{" "}
            · {r.blockedReason}
          </span>
        ) : (
          r.priorityReason !== "on track" && (
            <span className="mt-0.5 block text-[11px] text-faint">{r.priorityReason}</span>
          )
        )}
      </td>

      <td className="px-3 py-2 whitespace-nowrap text-muted">{r.formType}</td>

      <td className="px-3 py-2 whitespace-nowrap text-muted">{STAGE[r.stage].staff}</td>

      <td className="px-3 py-2">
        <OwnerBadge owner={r.owner} />
      </td>

      <td className="tnum px-3 py-2 whitespace-nowrap">
        {dueLabel(r.dueDate)}
        <span
          className={cx(
            "ml-1.5 text-[11px]",
            days <= 10 && r.stage !== "filed" ? "text-warn" : "text-faint"
          )}
        >
          {days < 0 ? `${-days}d late` : `${days}d`}
        </span>
      </td>

      <td className="px-3 py-2 text-center">
        <Grade grade={r.readinessGrade} size="sm" />
      </td>

      <td className="tnum px-3 py-2 text-right">
        {r.openItems > 0 ? (
          r.openItems
        ) : (
          <span className="text-faint" aria-label="No open items">
            —
          </span>
        )}
      </td>

    </tr>
  );
}
