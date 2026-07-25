/* ---------------------------------------------------------------------------
   The mark.

   A document with one line picked out in amber — because the whole product is
   about a single figure and where it came from, and amber is already the
   product's one attention colour. It reads as "a form with one number
   highlighted" rather than as an abstract logo, which is the honest thing for
   a tool whose job is exactly that.

   Built as flat rectangles with no strokes so it survives being rendered at
   20px in a top bar, and stays legible as a browser-tab favicon.
--------------------------------------------------------------------------- */

export function LogoMark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Tax Hub"
      className={className}
    >
      <rect width="24" height="24" rx="6" fill="var(--color-accent)" />
      {/* Two ordinary lines of a form… */}
      <rect x="6" y="6.5" width="12" height="2.6" rx="1.3" fill="white" opacity="0.92" />
      {/* …one figure traced and held. */}
      <rect x="6" y="11.2" width="12" height="2.6" rx="1.3" fill="var(--color-warnedge)" />
      <rect x="6" y="15.9" width="7.5" height="2.6" rx="1.3" fill="white" opacity="0.55" />
    </svg>
  );
}

/** Mark plus wordmark, for the top bar. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <LogoMark size={24} />
      <span className="text-[15px] font-semibold tracking-tight">
        Tax<span className="text-accent">Hub</span>
      </span>
    </span>
  );
}
