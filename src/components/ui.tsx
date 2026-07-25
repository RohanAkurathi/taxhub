"use client";

import { useState, type ReactNode } from "react";
import type { FieldState, Owner, SourceDocument } from "@/lib/types";
import {
  FIELD_STATE,
  OWNER_BADGE,
  OWNER_LABEL,
  confidenceBand,
  gradeClasses,
} from "@/lib/design";
import { roleLabelForName } from "@/lib/mockData";

/* ---------------------------------------------------------------------------
   Shared primitives.

   Every state badge, grade, and document in the product renders through these,
   so "needs review" cannot drift into looking one way on the dashboard and
   another inside a return. This is the enforcement mechanism behind the
   interaction system, not just a convenience.
--------------------------------------------------------------------------- */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */

export function Chip({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "ok" | "warn" | "flag" | "danger";
  className?: string;
  title?: string;
}) {
  const tones = {
    neutral: "bg-locksoft text-lock border-lockedge",
    accent: "bg-accentsoft text-accentink border-accentedge",
    ok: "bg-oksoft text-ok border-okedge",
    warn: "bg-warnsoft text-warn border-warnedge",
    flag: "bg-flagsoft text-flag border-flagedge",
    danger: "bg-dangersoft text-danger border-dangeredge",
  };
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/** The single source of truth for how a field's state appears. */
export function StatePill({
  state,
  confidence,
  compact = false,
}: {
  state: FieldState;
  confidence?: number;
  compact?: boolean;
}) {
  const meta = FIELD_STATE[state];
  const showConfidence =
    confidence !== undefined && (state === "ai_extracted" || state === "needs_review");

  return (
    <span
      title={meta.meaning}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.badge
      )}
    >
      <span aria-hidden="true">{meta.glyph}</span>
      {!compact && <span>{meta.label}</span>}
      {showConfidence && !compact && (
        <span className="tnum opacity-70">{Math.round(confidence! * 100)}%</span>
      )}
    </span>
  );
}

/**
 * Confidence, shown as a band rather than a bare number.
 * A preparer needs to know whether to look, not that the model said 0.68.
 */
export function ConfidenceNote({ value }: { value: number }) {
  const band = confidenceBand(value);
  const tone = band.tone === "high" ? "ok" : band.tone === "medium" ? "accent" : "warn";
  return (
    <Chip tone={tone as "ok" | "accent" | "warn"}>
      {band.label}
      <span className="tnum opacity-70">{Math.round(value * 100)}%</span>
    </Chip>
  );
}

/* -------------------------------------------------------------------------- */

export function OwnerBadge({ owner }: { owner: Owner }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        OWNER_BADGE[owner]
      )}
    >
      {OWNER_LABEL[owner]}
    </span>
  );
}

export function Grade({ grade, size = "md" }: { grade: string; size?: "sm" | "md" }) {
  return (
    <span
      title={`Readiness ${grade}`}
      className={cx(
        "tnum inline-flex items-center justify-center rounded-md font-semibold",
        gradeClasses(grade),
        size === "sm" ? "h-6 w-7 text-xs" : "h-8 w-9 text-sm"
      )}
    >
      {grade}
    </span>
  );
}

export function Avatar({
  name,
  size = 24,
  tone = "accent",
}: {
  name: string;
  size?: number;
  tone?: "accent" | "flag" | "ok" | "neutral";
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const tones = {
    accent: "bg-accent text-white",
    flag: "bg-flag text-white",
    ok: "bg-ok text-white",
    neutral: "bg-lockedge text-ink",
  };
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        tones[tone]
      )}
    >
      {initials}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

export function Button({
  children,
  onClick,
  variant = "default",
  size = "md",
  disabled,
  title,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "default" | "quiet" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  const variants = {
    primary:
      "bg-accent text-white border-accent hover:bg-accentink disabled:hover:bg-accent",
    default: "bg-canvas text-ink border-line hover:border-lockedge hover:bg-panel",
    quiet: "bg-transparent text-muted border-transparent hover:bg-locksoft",
    danger: "bg-canvas text-danger border-dangeredge hover:bg-dangersoft",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The one segmented control.
 *
 * Five screens grew their own slightly different pill toggles — Mine/Team,
 * All/Needs attention, the document lenses, the view switchers. A viewer
 * meeting a new variant on every screen has to re-learn the same control five
 * times; sharing one implementation is what makes "this switches what I'm
 * looking at" instantly recognisable everywhere.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  size?: "xs" | "md";
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        "inline-flex shrink-0 rounded-lg border border-line bg-panel",
        size === "md" ? "p-0.5" : "p-px"
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx(
            "rounded-md font-medium transition-colors",
            size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
            value === o.value
              ? "bg-accent text-white"
              : "text-muted hover:bg-locksoft hover:text-ink"
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cx("tnum ml-1", value === o.value ? "opacity-80" : "opacity-60")}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "text-[11px] font-semibold uppercase tracking-[0.09em] text-faint",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  className,
  tone = "plain",
}: {
  children: ReactNode;
  className?: string;
  tone?: "plain" | "warn" | "flag" | "ok" | "danger";
}) {
  const tones = {
    plain: "bg-canvas border-line",
    warn: "bg-[#fffdf6] border-warnedge",
    flag: "bg-[#fbf9ff] border-flagedge",
    ok: "bg-oksoft/40 border-okedge",
    danger: "bg-dangersoft border-dangeredge",
  };
  return (
    <div className={cx("rounded-xl border", tones[tone], className)}>{children}</div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {detail && <p className="max-w-sm text-sm text-muted">{detail}</p>}
      {action}
    </div>
  );
}

export function ProgressBar({ value, tone = "ok" }: { value: number; tone?: "ok" | "accent" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-hair">
      <div
        className={cx("h-full rounded-full", tone === "ok" ? "bg-ok" : "bg-accent")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The fake source document                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Renders a hardcoded document as styled HTML rather than a real scan.
 *
 * Doing it this way is deliberate: it lets a specific box be highlighted
 * precisely, at any zoom, with no OCR and no coordinate mapping — which is the
 * part of traceability that actually needs proving in a prototype.
 */
export function DocumentView({
  doc,
  highlightBoxId,
  onBoxClick,
}: {
  doc: SourceDocument;
  highlightBoxId?: string;
  onBoxClick?: (boxId: string) => void;
}) {
  const interactive = Boolean(onBoxClick);
  const [view, setView] = useState<"fields" | "scan">("fields");

  return (
    <figure className="overflow-hidden rounded-sm border border-lockedge bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Fields is the AI's structured reading; Original is the file the
          client actually sent. Keeping both one tap apart is the point — the
          reading is only trustworthy while the original stays in reach. */}
      <div className="flex items-center justify-between border-b border-lockedge bg-panel px-2 py-1">
        <span className="px-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">
          {view === "fields" ? "What the AI read" : "As uploaded"}
        </span>
        <Segmented
          size="xs"
          label="Document view"
          value={view}
          onChange={setView}
          options={[
            { value: "fields", label: "Fields" },
            { value: "scan", label: "Original" },
          ]}
        />
      </div>

      {view === "scan" && <DocumentScan doc={doc} highlightBoxId={highlightBoxId} />}

      {view === "fields" && (
      <>
      {/* Masthead, the way a real form carries one. */}
      <figcaption className="border-b-2 border-ink/80 px-3.5 pb-2 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold leading-tight tracking-tight">
            {doc.title}
          </span>
          <span className="tnum shrink-0 text-[11px] text-muted">{doc.taxYear}</span>
        </div>
        <span className="mt-0.5 block text-[11px] text-muted">{doc.issuer}</span>
      </figcaption>

      {/*
        Ruled boxes that share their borders, the way the boxes on a paper tax
        form do. An earlier version used rounded, floating, individually
        outlined cards, which reads as a set of options to choose between — the
        document looked like a form control instead of a form.
      */}
      <div className="grid grid-cols-2 gap-px bg-lockedge/70">
        {doc.boxes.map((box) => {
          const isHighlight = box.id === highlightBoxId;
          const common = cx(
            "relative block w-full bg-white px-3 py-2 text-left",
            box.wide && "col-span-2",
            interactive && "cursor-pointer hover:bg-accentsoft/50",
            // Emphasis reads as a highlighter mark over paper, never as a
            // selected control: a wash and a margin rule, no blue ring.
            isHighlight && box.uncertain && "bg-warnsoft",
            isHighlight && !box.uncertain && "bg-[#fdf6d8]",
            !isHighlight && box.uncertain && "bg-warnsoft/40"
          );

          const inner = (
            <>
              {isHighlight && (
                <span
                  aria-hidden="true"
                  className={cx(
                    "absolute inset-y-0 left-0 w-[3px]",
                    box.uncertain ? "bg-warnedge" : "bg-[#d9b625]"
                  )}
                />
              )}
              <span className="block text-[9.5px] font-medium uppercase leading-tight tracking-[0.06em] text-muted">
                {box.label}
              </span>
              <span className="tnum mt-0.5 block text-[13px] leading-snug text-ink">
                {box.value}
              </span>
              {box.uncertain && (
                <span className="mt-0.5 block text-[10px] font-medium text-warn">
                  could not be read cleanly
                </span>
              )}
            </>
          );

          return interactive ? (
            <button
              key={box.id}
              type="button"
              onClick={() => onBoxClick!(box.id)}
              title="Check this figure against the return"
              className={common}
            >
              {inner}
            </button>
          ) : (
            <div key={box.id} className={common}>
              {inner}
            </div>
          );
        })}
      </div>

      </>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-lockedge px-3.5 py-2 text-[11px] text-muted">
        <span>
          Uploaded by {doc.uploadedBy} ({roleLabelForName(doc.uploadedBy).toLowerCase()}) ·{" "}
          {doc.pages} page{doc.pages > 1 ? "s" : ""}
        </span>
        {doc.scanQuality === "low" && (
          <span className="font-medium text-warn">· low scan quality</span>
        )}
      </div>

      {doc.notice && (
        <p className="border-t border-lockedge bg-warnsoft/50 px-3.5 py-2 text-[11px] leading-relaxed text-warn">
          {doc.notice}
        </p>
      )}

      <p className="border-t border-lockedge px-3.5 py-2 text-[11px] leading-relaxed text-faint">
        The uploaded file is never modified. Every correction is stored as a separate,
        reversible change.
      </p>
    </figure>
  );
}


/**
 * A facsimile of the client's uploaded file.
 *
 * There is no real scan in the prototype, so this renders one honestly: the
 * same field data laid out like the government form, in a typewriter face,
 * slightly askew when the photo was poor — with the glare that defeated the
 * AI actually visible over the digit it obscured. Seeing WHY the machine
 * struggled does more for trust than any confidence percentage.
 */
function DocumentScan({
  doc,
  highlightBoxId,
}: {
  doc: SourceDocument;
  highlightBoxId?: string;
}) {
  const rough = doc.scanQuality === "low";
  return (
    <div className="bg-locksoft/60 p-3">
      <div
        className={cx(
          "mx-auto max-w-[340px] border border-ink/30 bg-[#fdfcf7] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.14)]",
          rough && "rotate-[-0.8deg]"
        )}
      >
        <div className="flex items-baseline justify-between border-b-2 border-ink/70 pb-1">
          <span className="font-mono text-[11px] font-bold tracking-tight">
            {doc.title.split("·")[0]?.trim()}
          </span>
          <span className="font-mono text-[10px]">{doc.taxYear}</span>
        </div>
        <p className="mt-0.5 font-mono text-[9px] uppercase text-ink/60">
          {doc.issuer}
        </p>

        <div className="mt-2 grid grid-cols-2 gap-0 border border-ink/40">
          {doc.boxes.map((box) => (
            <div
              key={box.id}
              className={cx(
                "relative border border-ink/25 px-1.5 py-1",
                box.wide && "col-span-2",
                box.id === highlightBoxId && "bg-[#fdf6d8]"
              )}
            >
              <span className="block font-mono text-[7.5px] uppercase leading-tight text-ink/55">
                {box.label}
              </span>
              <span className="tnum block text-[11px] leading-snug">
                {box.value}
              </span>
              {box.uncertain && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-6 top-1 h-6 w-10 rounded-full bg-white/85 blur-[3px]"
                />
              )}
            </div>
          ))}
        </div>

        {rough && (
          <p className="mt-1.5 font-mono text-[8px] italic text-ink/45">
            photographed · {doc.pages} page{doc.pages > 1 ? "s" : ""}
          </p>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-[340px] text-center text-[10px] leading-relaxed text-faint">
        Simulated scan — in production this is the client&rsquo;s actual file, and the
        highlight lands on real pixels.
      </p>
    </div>
  );
}

/* Toasts are rendered by <ToastRail/> inside Shell, so they appear once per
   page rather than once per component that wants to announce something. */
