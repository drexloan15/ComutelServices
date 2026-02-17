import { AuditLogQuery, KnowledgeListQuery, TicketListQuery } from "@/lib/types";

export const queryKeys = {
  me: ["auth", "me"] as const,
  tickets: ["tickets"] as const,
  ticketsList: (query: TicketListQuery) => ["tickets", "list", query] as const,
  notifications: (query: { page?: number; pageSize?: number; unreadOnly?: boolean }) =>
    ["notifications", query] as const,
  auditLogs: (query: AuditLogQuery) => ["audit-logs", query] as const,
  slaPolicies: ["sla", "policies"] as const,
  slaTracking: (query: { page?: number; pageSize?: number; status?: string }) =>
    ["sla", "tracking", query] as const,
  users: ["users"] as const,
  ticket: (ticketId: string) => ["tickets", ticketId] as const,
  ticketComments: (ticketId: string) => ["tickets", ticketId, "comments"] as const,
  ticketHistory: (ticketId: string) => ["tickets", ticketId, "history"] as const,
  knowledgeArticles: (query: KnowledgeListQuery) => ["knowledge", "articles", query] as const,
  knowledgeArticle: (articleId: string) => ["knowledge", "article", articleId] as const,
  knowledgeComments: (articleId: string) => ["knowledge", "article", articleId, "comments"] as const,
};
