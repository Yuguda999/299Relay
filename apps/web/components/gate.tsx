"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, Header, Loading, Page } from "@/components/ui";
import { useSession } from "@/lib/session";

const verifyLink = <Link href="/verify" className="rounded-pill px-2 py-1 text-[13px] font-semibold text-signal-ink underline-offset-2 hover:underline">Verify</Link>;

/** Wraps screens that need a verified student (posting, carrying, money out). */
export function VerifiedOnly({ title, children }: { title: string; children: ReactNode }) {
  const { profile, loading } = useSession();
  if (loading) return (<><Header title={title} /><Page><Loading /></Page></>);
  if (profile?.status !== "verified") {
    return (
      <>
        <Header title={title} />
        <Page>
          <Alert tone="warn" title="Student ID needed" action={verifyLink}>
            Posting, carrying and withdrawing unlock once your student ID is approved.
          </Alert>
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
    <Alert tone="warn" action={verifyLink}>
      Browse freely. Posting and carrying unlock when your student ID is approved.
    </Alert>
  );
}
