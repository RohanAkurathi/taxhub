"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";

/**
 * Entering the client area switches the acting context, so client content is
 * never wrapped in firm navigation.
 *
 * This runs once on entry and then gets out of the way. An earlier version
 * re-asserted the client context whenever `acting` changed, which meant the
 * "Back to Preparer" link and the role switcher both appeared to do nothing:
 * they set the context and this effect immediately set it back. A control that
 * silently undoes itself is worse than one that isn't there.
 */
export default function ClientAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { acting, setActing } = useStore();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    if (acting.kind !== "self") {
      setActing({ kind: "self", role: "client", as: "reyes" });
    }
  }, [acting.kind, setActing]);

  return <>{children}</>;
}
