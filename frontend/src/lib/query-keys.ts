export const queryKeys = {
  me: ["auth", "me"] as const,
  tickets: ["tickets"] as const,
  users: ["users"] as const,
  ticket: (ticketId: string) => ["tickets", ticketId] as const,
  ticketComments: (ticketId: string) => ["tickets", ticketId, "comments"] as const,
  ticketHistory: (ticketId: string) => ["tickets", ticketId, "history"] as const,
};
