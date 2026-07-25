"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { TOUR, stopForPath } from "@/lib/tour";
import { useStore } from "@/lib/store";

/* ---------------------------------------------------------------------------
   The handrail.

   Sits at the bottom of whichever tour stop you are on, says what to try here,
   and offers the next one. It exists because the alternative is a reviewer
   typing URLs, or wandering into a generated return and concluding the
   prototype is thinner than it is.

   Dismissible, and it never covers anything: the shell reserves space for it
   rather than floating it over content.
--------------------------------------------------------------------------- */

export function TourBar() {
  const pathname = usePathname();
  const { setActing } = useStore();
  const [hidden, setHidden] = useState(false);

  const stop = stopForPath(pathname);
  if (!stop || hidden) return null;

  const index = TOUR.findIndex((s) => s.slug === stop.slug);
  const next = TOUR[index + 1];

  return (
    <aside className="shrink-0 border-t border-accentedge bg-accentsoft/60">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
        <span className="flex shrink-0 items-center gap-2">
          <span className="tnum rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
            {index + 1}/{TOUR.length}
          </span>
          <span className="text-xs font-semibold text-accentink">{stop.title}</span>
        </span>

        <p className="min-w-[16rem] flex-1 text-xs leading-relaxed text-muted">
          <span className="font-medium text-ink">Try:</span> {stop.tryThis}
        </p>

        <span className="flex shrink-0 items-center gap-2">
          {next ? (
            <Link
              href={next.href}
              onClick={() => next.acting && setActing(next.acting)}
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accentink"
            >
              Next: {next.title} →
            </Link>
          ) : (
            <Link
              href="/"
              className="rounded-md border border-accentedge bg-canvas px-2.5 py-1 text-xs font-medium text-accentink hover:bg-white"
            >
              Back to the start
            </Link>
          )}
          <button
            onClick={() => setHidden(true)}
            aria-label="Hide the tour"
            className="rounded px-1.5 py-1 text-xs text-muted hover:bg-white hover:text-ink"
          >
            ✕
          </button>
        </span>
      </div>
    </aside>
  );
}
