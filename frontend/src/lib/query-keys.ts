import { TicketListQuery } from "@/lib/types";

export const queryKeys = {
  me: ["auth", "me"] as const,
  tickets: ["tickets"] as const,
  ticketsList: (query: TicketListQuery) => ["tickets", "list", query] as const,
  users: ["users"] as const,
  ticket: (ticketId: string) => ["tickets", ticketId] as const,
  ticketComments: (ticketId: string) => ["tickets", ticketId, "comments"] as const,
  ticketHistory: (ticketId: string) => ["tickets", ticketId, "history"] as const,
};
