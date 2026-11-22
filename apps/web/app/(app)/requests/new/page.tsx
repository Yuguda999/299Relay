"use client";

import { VerifiedOnly } from "@/components/gate";
import { RequestForm } from "@/components/request-form";

export default function NewRequest() {
  return (
    <VerifiedOnly title="New request">
      <RequestForm />
    </VerifiedOnly>
  );
}
