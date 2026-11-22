"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Header, Loading, Notice, Page } from "@/components/ui";
import { useSession } from "@/lib/session";

/** Wraps screens that need a verified student (posting, carrying, money out). */
export function VerifiedOnly({ title, children }: { title: string; children: ReactNode }) {
  const { profile, loading } = useSession();
  if (loading) return <Loading />;
  if (profile?.status !== "verified") {
    return (
      <>
        <Header title={title} />
        <Page>
          <Notice tone="amber" action={<Link href="/verify" className="shrink-0 font-semibold text-navy">Verify</Link>}>
            Posting, carrying and withdrawing unlock once your student ID is approved.
          </Notice>
        </Page>
      </>
    );
  }
  return <>{children}</>;
}

export function VerifyBanner() {
  const { profile } = useSession();
  if (!profile || profile.status === "verified") return null;
  return (
    <Notice tone="amber" action={<Link href="/verify" className="shrink-0 font-semibold text-navy">Check status</Link>}>
      Browse freely. Posting and carrying unlock when your student ID is approved.
    </Notice>
  );
}
