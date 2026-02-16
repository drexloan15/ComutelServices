"use client";

import { useParams } from "next/navigation";
import { TicketDetailPage } from "@/components/ticket-detail-page";

export default function AdminTicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const ticketId =
    typeof params.ticketId === "string"
      ? params.ticketId
      : Array.isArray(params.ticketId)
        ? params.ticketId[0]
        : "";

  return (
    <TicketDetailPage
      ticketId={ticketId}
      backHref="/portal/admin"
      portalRole="ADMIN"
    />
  );
}
