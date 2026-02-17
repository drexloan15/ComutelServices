import { authedFetch, parseApiError } from "@/lib/auth";
import {
  AuditLogListResponse,
  AuditLogQuery,
  BusinessService,
  CmdbAsset,
  CreateKnowledgeArticleInput,
  KnowledgeArticle,
  KnowledgeComment,
  KnowledgeListQuery,
  ManagedUser,
  NotificationListResponse,
  PaginatedResponse,
  Role,
  SlaEngineRunSummary,
  SlaPredictionResponse,
  SlaPolicy,
  SlaTrackingListResponse,
  SlaStatus,
  ServiceCatalogItem,
  Ticket,
  TicketApproval,
  TicketComment,
  TicketDetail,
  TicketListQuery,
  TicketMacro,
  TicketPriority,
  TicketStatus,
  TicketStatusHistoryEntry,
  TicketWorkspace,
  TicketType,
  UpdateKnowledgeArticleInput,
  UserProfile,
} from "@/lib/types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getErrorMessage(error: unknown, fallback = "Error en la solicitud") {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authedFetch(path, init);
  if (!response.ok) {
    const message = await parseApiError(response);
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

type CreateTicketInput = {
  title: string;
  description?: string;
  priority: TicketPriority;
  type: TicketType;
  requesterName: string;
  requesterEmail: string;
  catalogItemId?: string;
  catalogFormPayload?: Record<string, unknown>;
  impactedServiceId?: string;
};

type UpdateTicketInput = {
  status?: TicketStatus;
  priority?: TicketPriority;
  statusReason?: string;
  supportGroupId?: string;
  slaPolicyId?: string;
  impactedServiceId?: string;
  catalogFormPayload?: Record<string, unknown>;
};

type AddTicketCommentInput = {
  body: string;
  type?: "PUBLIC_NOTE" | "INTERNAL_NOTE" | "WORKLOG";
};

type AddTicketAttachmentInput = {
  fileName: string;
  storageUrl: string;
  mimeType?: string;
  sizeBytes?: number;
};

type CreateTicketApprovalInput = {
  type: "MANAGER" | "CHANGE" | "SECURITY" | "FINANCE";
  approverId?: string;
  note?: string;
};

type DecideTicketApprovalInput = {
  decision: "APPROVED" | "REJECTED";
  note?: string;
};

export function fetchMe() {
  return requestJson<UserProfile>("/auth/me");
}

function buildTicketListQuery(query: TicketListQuery) {
  const params = new URLSearchParams();

  if (query.status && query.status !== "ALL") params.set("status", query.status);
  if (query.priority && query.priority !== "ALL") params.set("priority", query.priority);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.text?.trim()) params.set("text", query.text.trim());
  if (query.sort) params.set("sort", query.sort);
  if (query.searchMode) params.set("searchMode", query.searchMode);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export function fetchTickets(query: TicketListQuery = {}) {
  return requestJson<PaginatedResponse<Ticket>>(`/tickets${buildTicketListQuery(query)}`);
}

export function fetchUsers() {
  return requestJson<ManagedUser[]>("/users");
}

export function fetchTicketDetail(ticketId: string) {
  return requestJson<TicketDetail>(`/tickets/${ticketId}`);
}

export function fetchTicketWorkspace(ticketId: string) {
  return requestJson<TicketWorkspace>(`/tickets/${ticketId}/workspace`);
}

export function fetchTicketComments(ticketId: string) {
  return requestJson<TicketComment[]>(`/tickets/${ticketId}/comments`);
}

export function fetchTicketHistory(ticketId: string) {
  return requestJson<TicketStatusHistoryEntry[]>(`/tickets/${ticketId}/status-history`);
}

export function createTicket(input: CreateTicketInput) {
  return requestJson<Ticket>("/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTicket(ticketId: string, input: UpdateTicketInput) {
  return requestJson<Ticket>(`/tickets/${ticketId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateUserRole(userId: string, role: Role) {
  return requestJson<ManagedUser>(`/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function updateUserStatus(userId: string, isActive: boolean) {
  return requestJson<ManagedUser>(`/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export function addTicketComment(ticketId: string, input: AddTicketCommentInput) {
  return requestJson<TicketComment>(`/tickets/${ticketId}/comments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function addTicketAttachment(ticketId: string, input: AddTicketAttachmentInput) {
  return requestJson(`/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchTicketMacros() {
  return requestJson<TicketMacro[]>("/tickets/automation/macros");
}

export function applyTicketMacro(ticketId: string, macroId: string, reason?: string) {
  return requestJson<Ticket>(`/tickets/${ticketId}/macros/${macroId}/apply`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function createTicketApproval(ticketId: string, input: CreateTicketApprovalInput) {
  return requestJson<TicketApproval>(`/tickets/${ticketId}/approvals`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function decideTicketApproval(
  ticketId: string,
  approvalId: string,
  input: DecideTicketApprovalInput,
) {
  return requestJson<TicketApproval>(`/tickets/${ticketId}/approvals/${approvalId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchCatalogItems() {
  return requestJson<ServiceCatalogItem[]>("/catalog/items");
}

function buildAuditLogQuery(query: AuditLogQuery) {
  const params = new URLSearchParams();

  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.actor?.trim()) params.set("actor", query.actor.trim());
  if (query.action && query.action !== "ALL") params.set("action", query.action);
  if (query.resource?.trim()) params.set("resource", query.resource.trim());
  if (query.success && query.success !== "ALL") params.set("success", query.success);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.sort) params.set("sort", query.sort);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export function fetchAuditLogs(query: AuditLogQuery = {}) {
  return requestJson<AuditLogListResponse>(`/audit-logs${buildAuditLogQuery(query)}`);
}

export async function exportAuditLogsCsv(query: AuditLogQuery = {}) {
  const response = await authedFetch(`/audit-logs/export${buildAuditLogQuery(query)}`, {
    method: "GET",
  });
  if (!response.ok) {
    const message = await parseApiError(response);
    throw new ApiError(message, response.status);
  }
  return response.blob();
}

export function fetchNotifications(query: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.unreadOnly !== undefined) params.set("unreadOnly", String(query.unreadOnly));
  const queryString = params.toString();
  return requestJson<NotificationListResponse>(`/notifications${queryString ? `?${queryString}` : ""}`);
}

export function markNotificationAsRead(notificationId: string) {
  return requestJson(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsAsRead() {
  return requestJson<{ success: true; updatedCount: number }>("/notifications/read-all", {
    method: "PATCH",
  });
}

export function fetchSlaPolicies() {
  return requestJson<SlaPolicy[]>("/sla/policies");
}

export function fetchSlaTracking(query: { page?: number; pageSize?: number; status?: SlaStatus | "ALL" } = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status && query.status !== "ALL") params.set("status", query.status);
  const queryString = params.toString();
  return requestJson<SlaTrackingListResponse>(`/sla/tracking${queryString ? `?${queryString}` : ""}`);
}

export function runSlaEngine() {
  return requestJson<SlaEngineRunSummary>("/sla/engine/run", {
    method: "POST",
  });
}

export function fetchSlaPredictions(windowHours = 24) {
  return requestJson<SlaPredictionResponse>(`/sla/predictions?windowHours=${windowHours}`);
}

export function pauseSlaTracking(ticketId: string, reason?: string) {
  return requestJson(`/sla/tracking/${ticketId}/pause`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function resumeSlaTracking(ticketId: string, reason?: string) {
  return requestJson(`/sla/tracking/${ticketId}/resume`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function fetchCmdbServices() {
  return requestJson<BusinessService[]>("/cmdb/services");
}

export function fetchCmdbAssets() {
  return requestJson<CmdbAsset[]>("/cmdb/assets");
}

function buildKnowledgeQuery(query: KnowledgeListQuery) {
  const params = new URLSearchParams();

  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.tag?.trim()) params.set("tag", query.tag.trim());
  if (query.publishedOnly !== undefined) params.set("publishedOnly", String(query.publishedOnly));
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.sort) params.set("sort", query.sort);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export function fetchKnowledgeArticles(query: KnowledgeListQuery = {}) {
  return requestJson<PaginatedResponse<KnowledgeArticle>>(
    `/knowledge/articles${buildKnowledgeQuery(query)}`,
  );
}

export function fetchKnowledgeArticleDetail(articleId: string) {
  return requestJson<KnowledgeArticle>(`/knowledge/articles/${articleId}`);
}

export function createKnowledgeArticle(input: CreateKnowledgeArticleInput) {
  return requestJson<KnowledgeArticle>("/knowledge/articles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateKnowledgeArticle(articleId: string, input: UpdateKnowledgeArticleInput) {
  return requestJson<KnowledgeArticle>(`/knowledge/articles/${articleId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchKnowledgeComments(articleId: string) {
  return requestJson<KnowledgeComment[]>(`/knowledge/articles/${articleId}/comments`);
}

export function addKnowledgeComment(articleId: string, body: string) {
  return requestJson<KnowledgeComment>(`/knowledge/articles/${articleId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}
