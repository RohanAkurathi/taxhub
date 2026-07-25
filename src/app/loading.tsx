/* ---------------------------------------------------------------------------
   Shown the instant a navigation starts, before the next screen is ready.

   Without it a click produces nothing at all until the page is fully built,
   which reads as a frozen app rather than a loading one — most visibly in
   development, where the dev server compiles each route on first visit.

   A skeleton in the shape of the page underneath it, rather than a spinner:
   the layout stops jumping when the real content lands.
--------------------------------------------------------------------------- */

export default function Loading() {
  return (
    <div className="flex h-screen flex-col bg-ground" aria-busy="true">
      <div className="sr-only" role="status">
        Loading
      </div>

      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-line bg-canvas px-4 py-2.5">
        <div className="h-6 w-6 rounded bg-accentsoft" />
        <div className="h-3.5 w-24 rounded bg-hair" />
        <div className="ml-2 h-3 w-48 rounded bg-hair" />
        <div className="ml-auto h-6 w-36 rounded-md bg-accentsoft" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <div className="w-52 shrink-0 border-r border-line bg-panel px-3 py-4">
          <div className="mb-3 h-2.5 w-12 rounded bg-hair" />
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 rounded-lg bg-hair" />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 px-6 py-7">
          <div className="h-2.5 w-20 rounded bg-hair" />
          <div className="mt-3 h-7 w-72 rounded bg-hair" />
          <div className="mt-3 h-3.5 w-96 rounded bg-hair" />

          <div className="mt-7 space-y-2.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-14 rounded-xl border border-line bg-canvas"
                style={{ opacity: 1 - i * 0.13 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
