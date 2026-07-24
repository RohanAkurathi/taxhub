"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ROLE } from "@/lib/design";
import { useStore } from "@/lib/store";
import { Avatar, Chip, cx } from "./ui";

/* ---------------------------------------------------------------------------
   The application shell.

   One skeleton for every role (challenge 05). Switching role does not load a
   different product — it changes which rooms exist in the same house. A client
   simply has fewer doors, so permissions are communicated by architecture
   rather than by an error message after a click.

   The breadcrumb is the orientation device for challenge 04: it always names
   the object you are inside, and every segment is a working link back out.
--------------------------------------------------------------------------- */

const ICONS: Record<string, ReactNode> = {
  home: (
    <path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z" />
  ),
  grid: (
    <path d="M3.5 3.5h5.5v5.5H3.5zM11 3.5h5.5v5.5H11zM3.5 11h5.5v5.5H3.5zM11 11h5.5v5.5H11z" />
  ),
  doc: <path d="M5 2.5h6l4 4V17a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 5 17z" />,
  chat: <path d="M3 4.5h14v9H8l-4 3.5v-3.5H3z" />,
  swatch: (
    <path d="M3.5 3.5h4v13h-4zM9 3.5h4v13H9zM14.5 3.5h2v13h-2z" />
  ),
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0 fill-current opacity-70"
      aria-hidden="true"
    >
      {ICONS[name] ?? ICONS.grid}
    </svg>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

export function Shell({
  children,
  crumbs = [],
  right,
}: {
  children: ReactNode;
  crumbs?: Crumb[];
  right?: ReactNode;
}) {
  const { acting, setActing, role, returns } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const nav = ROLE[role].nav;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * Changing role has to move you as well as re-label you. Staying on a client
   * page while "acting as preparer" would show firm navigation wrapped around
   * client content — the exact confusion the role architecture exists to
   * prevent — so a switch that crosses the boundary navigates to that role's
   * home.
   */
  const switchTo = (next: Parameters<typeof setActing>[0]) => {
    setActing(next);
    setMenuOpen(false);
    const inClientArea = pathname.startsWith("/home");
    if (next.kind === "staff" && inClientArea) {
      router.push(ROLE[next.role].home);
    } else if (next.kind === "self" && !inClientArea) {
      router.push("/home");
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const viewingAsSelf = acting.kind === "self";
  const reviewCount = returns.filter((r) => r.stage === "in_review").length;

  return (
    <div className="flex min-h-screen flex-col bg-ground">
      {/* Top bar ---------------------------------------------------------- */}
      <header className="flex items-center gap-3 border-b border-line bg-canvas px-4 py-2.5">
        <Link href={ROLE[role].home} className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs font-bold text-white">
            G
          </span>
          <span className="text-sm font-semibold tracking-tight">Tax Hub</span>
        </Link>

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span aria-hidden="true" className="text-lockedge">
                    /
                  </span>
                )}
                {c.href && i < crumbs.length - 1 ? (
                  <Link href={c.href} className="hover:text-accentink hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span
                    className={cx(i === crumbs.length - 1 && "font-medium text-ink")}
                    aria-current={i === crumbs.length - 1 ? "page" : undefined}
                  >
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {right}

        {/* Role switcher (challenge 05) */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={cx(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              viewingAsSelf
                ? "border-okedge bg-oksoft text-ok"
                : "border-accentedge bg-accentsoft text-accentink"
            )}
          >
            Viewing as:{" "}
            {viewingAsSelf
              ? acting.as === "reyes"
                ? "Myself (client)"
                : "Sarah Chen (client)"
              : ROLE[role].label}
            <span aria-hidden="true">▾</span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-9 z-30 w-72 rounded-lg border border-line bg-canvas p-1.5 shadow-lg"
            >
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Switch context
              </p>
              {(
                [
                  {
                    kind: "staff",
                    role: "preparer",
                    title: "Preparer",
                    detail: "Build returns from client documents",
                  },
                  {
                    kind: "staff",
                    role: "reviewer",
                    title: "Reviewer",
                    detail: `${reviewCount} return${reviewCount === 1 ? "" : "s"} awaiting your approval`,
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.role}
                  role="menuitem"
                  onClick={() => switchTo({ kind: "staff", role: opt.role })}
                  className={cx(
                    "w-full rounded-md px-2 py-2 text-left text-sm hover:bg-locksoft",
                    !viewingAsSelf && role === opt.role && "bg-accentsoft"
                  )}
                >
                  <span className="font-medium">{opt.title}</span>
                  <span className="block text-xs text-muted">{opt.detail}</span>
                </button>
              ))}

              {/* The firm employee who is also a client of the firm. */}
              <div className="my-1 border-t border-hair" />
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                As a client
              </p>
              <button
                role="menuitem"
                onClick={() => switchTo({ kind: "self", role: "client", as: "reyes" })}
                className={cx(
                  "w-full rounded-md px-2 py-2 text-left text-sm hover:bg-locksoft",
                  viewingAsSelf && acting.as === "reyes" && "bg-oksoft"
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  My own tax return
                  <Chip tone="ok">brand new</Chip>
                </span>
                <span className="block text-xs text-muted">
                  You are a client of the firm too. Nothing uploaded yet — this is day one.
                </span>
              </button>
              <button
                role="menuitem"
                onClick={() => switchTo({ kind: "self", role: "client", as: "chen" })}
                className={cx(
                  "w-full rounded-md px-2 py-2 text-left text-sm hover:bg-locksoft",
                  viewingAsSelf && acting.as === "chen" && "bg-oksoft"
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  Sarah Chen&rsquo;s view
                  <Chip tone="accent">weeks in</Chip>
                </span>
                <span className="block text-xs text-muted">
                  The same screens once onboarding is behind you
                </span>
              </button>
            </div>
          )}
        </div>

        <Avatar name="Jordan Reyes" size={26} tone={viewingAsSelf ? "ok" : "accent"} />
      </header>

      {/* A mode this unusual should never be silent. */}
      {viewingAsSelf && (
        <div className="flex items-center gap-2 border-b border-okedge bg-oksoft px-4 py-1.5 text-xs font-medium text-ok">
          {acting.kind === "self" && acting.as === "reyes"
            ? "You are viewing your own return as a client. Firm tools are hidden."
            : "You are seeing exactly what Sarah Chen sees. Firm tools are hidden."}
          <button
            onClick={() => switchTo({ kind: "staff", role: "preparer" })}
            className="underline hover:no-underline"
          >
            Back to Preparer
          </button>
        </div>
      )}

      <div className="flex flex-1 items-stretch">
        {/* Sidebar ------------------------------------------------------- */}
        <aside className="w-44 shrink-0 border-r border-line bg-panel py-3">
          <ul>
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href + "/"));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cx(
                      "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                      active
                        ? "border-r-2 border-accent bg-accentsoft font-medium text-accentink"
                        : "text-muted hover:bg-locksoft hover:text-ink"
                    )}
                  >
                    <NavIcon name={item.icon} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 border-t border-line px-4 pt-3 text-[11px] leading-relaxed text-faint">
            {viewingAsSelf
              ? "As a client you see four rooms. Nothing here hints at tools you cannot open."
              : `${ROLE[role].label}: ${ROLE[role].description.toLowerCase()}.`}
          </p>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <ToastRail />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ToastRail() {
  const { toasts, dismissToast } = useStore();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            "pointer-events-auto rounded-lg border px-3.5 py-2.5 shadow-lg",
            t.tone === "ok"
              ? "border-okedge bg-oksoft"
              : t.tone === "warn"
              ? "border-warnedge bg-warnsoft"
              : "border-accentedge bg-accentsoft"
          )}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p
                className={cx(
                  "text-sm font-medium",
                  t.tone === "ok" ? "text-ok" : t.tone === "warn" ? "text-warn" : "text-accentink"
                )}
              >
                {t.title}
              </p>
              {t.detail && <p className="mt-0.5 text-xs text-muted">{t.detail}</p>}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-muted hover:text-ink"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
