"use client";

import { useParams } from "next/navigation";
import { VerifiedOnly } from "@/components/gate";
import { RequestForm } from "@/components/request-form";
import { Alert, Header, Loading, Page } from "@/components/ui";
import { useLoad } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";

export default function SendToTrip() {
  const { id } = useParams<{ id: string }>();
  const trip = useLoad(async () => (await supabase().from("trips").select("*").eq("id", id).single()).data, [id]);
  if (trip.loading) return <><Header title="Send request" /><Page><Loading /></Page></>;
  if (!trip.data || trip.data.status !== "live") {
    return (
      <>
        <Header title="Send request" />
        <Page><Alert tone="warn">This trip is no longer taking requests.</Alert></Page>
      </>
    );
  }
  return (
    <VerifiedOnly title="Send request">
      <RequestForm trip={trip.data} />
    </VerifiedOnly>
  );
}
