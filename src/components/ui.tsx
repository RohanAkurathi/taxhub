"use client";

import type { ReactNode } from "react";
import type { FieldState, Owner, SourceDocument } from "@/lib/types";
import {
  FIELD_STATE,
  OWNER_BADGE,
  OWNER_LABEL,
  confidenceBand,
  gradeClasses,
} from "@/lib/design";

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
  return (
    <div className="rounded-lg border-2 border-lockedge bg-canvas p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h5 className="text-sm font-semibold">{doc.title}</h5>
        <span className="text-xs text-faint">{doc.taxYear}</span>
      </div>
      <p className="mb-3 text-xs text-muted">{doc.issuer}</p>

      <div className="grid grid-cols-2 gap-1.5">
        {doc.boxes.map((box) => {
          const isHighlight = box.id === highlightBoxId;
          const interactive = Boolean(onBoxClick);
          return (
            <div
              key={box.id}
              onClick={interactive ? () => onBoxClick!(box.id) : undefined}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onBoxClick!(box.id);
                      }
                    }
                  : undefined
              }
              className={cx(
                "rounded border px-2 py-1.5 transition-colors",
                box.wide && "col-span-2",
                interactive && "cursor-pointer hover:border-accentedge",
                isHighlight && box.uncertain
                  ? "border-warnedge bg-warnsoft outline-2 outline-warnedge"
                  : isHighlight
                  ? "border-accentedge bg-accentsoft outline-2 outline-accent"
                  : box.uncertain
                  ? "border-warnedge bg-warnsoft/40"
                  : "border-lockedge bg-canvas"
              )}
            >
              <span className="block text-[10px] uppercase tracking-wide text-faint">
                {box.label}
              </span>
              <span className="tnum text-sm font-medium">{box.value}</span>
              {box.uncertain && (
                <span className="ml-1.5 text-[10px] font-semibold text-warn">
                  unclear
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hair pt-2 text-xs text-faint">
        <span>
          Uploaded by {doc.uploadedBy} · {doc.pages} page{doc.pages > 1 ? "s" : ""}
        </span>
        {doc.scanQuality === "low" && <Chip tone="warn">Low scan quality</Chip>}
      </div>
      {doc.notice && (
        <p className="mt-2 rounded-md bg-warnsoft/60 px-2.5 py-1.5 text-xs text-warn">
          {doc.notice}
        </p>
      )}
      <p className="mt-2 text-[11px] text-faint">
        The uploaded file is never modified. Every correction is stored as a separate,
        reversible change.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Toasts() {
  return null;
}
