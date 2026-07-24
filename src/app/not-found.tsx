"use client";

import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Button, Card, SectionLabel } from "@/components/ui";

/**
 * A wrong URL should still land inside the product. The framework default is a
 * bare black page with no navigation, which in a light-themed professional tool
 * reads as a crash rather than a missing page.
 */
export default function NotFound() {
  return (
    <Shell crumbs={[{ label: "Page not found" }]}>
      <div className="mx-auto max-w-xl px-6 py-14">
        <SectionLabel>404</SectionLabel>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          There&rsquo;s nothing at that address
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          The link may be out of date, or the page may never have existed. Nothing has
          been lost — everything is still where you left it.
        </p>

        <Card className="mt-6 p-4">
          <SectionLabel>Try one of these</SectionLabel>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link href="/dashboard">
              <Button variant="primary" size="sm">
                Dashboard
              </Button>
            </Link>
            <Link href="/returns">
              <Button size="sm">All returns</Button>
            </Link>
            <Link href="/returns/ret-rivera-2025">
              <Button size="sm">Review a return</Button>
            </Link>
            <Link href="/home">
              <Button size="sm">The client view</Button>
            </Link>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
