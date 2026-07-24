"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

/**
 * Entering the client area switches the acting context.
 *
 * Without this, a preparer who follows a link into /home sees client content
 * wrapped in firm navigation — which is exactly the "one product, six roles,
 * total confusion" failure the role architecture exists to prevent. The shell
 * shows a banner while in this mode, so the switch is never silent.
 */
export default function ClientAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { acting, setActing } = useStore();

  useEffect(() => {
    if (acting.kind !== "self") {
      setActing({ kind: "self", role: "client" });
    }
  }, [acting.kind, setActing]);

  return <>{children}</>;
}
