export type Role = "ADMIN" | "AGENT" | "REQUESTER";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketType = "INCIDENT" | "SERVICE_REQUEST" | "PROBLEM" | "CHANGE" | "TASK";
export type TicketSort = "CREATED_DESC" | "CREATED_ASC" | "PRIORITY_DESC" | "PRIORITY_ASC";
export type TicketSearchMode = "CONTAINS" | "FTS";
export type SlaStatus = "ON_TRACK" | "AT_RISK" | "BREACHED" | "MET";
export type NotificationType = "SLA_AT_RISK" | "SLA_BREACHED" | "SLA_MET" | "SYSTEM";
export type AuditAction =
  | "AUTH_BOOTSTRAP_ADMIN"
  | "AUTH_REGISTER"
  | "AUTH_LOGIN"
  | "AUTH_REFRESH"
  | "AUTH_LOGOUT"
  | "USER_ROLE_CHANGED"
  | "USER_STATUS_CHANGED"
  | "TICKET_UPDATED"
  | "TICKET_DELETED"
  | "SLA_ENGINE_RUN"
  | "SLA_STATUS_CHANGED"
  | "NOTIFICATION_CREATED"
  | "NOTIFICATION_READ"
  | "NOTIFICATION_READ_ALL";

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
};

export type Ticket = {
  id: string;
  code: string;
  title: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  description?: string | null;
  requester: {
    fullName: string;
    email: string;
  };
  assignee?: {
    fullName: string;
    email: string;
  } | null;
  createdAt: string;
};

export type TicketDetail = Ticket & {
  description?: string | null;
  impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  requester: {
    id: string;
    fullName: string;
    email: string;
  };
  assignee?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  slaPolicy?: {
    id: string;
    name: string;
    responseTimeMinutes: number;
    resolutionTimeMinutes: number;
  } | null;
  slaTracking?: {
    id: string;
    responseDeadlineAt: string;
    resolutionDeadlineAt: string;
    firstResponseAt?: string | null;
    resolvedAt?: string | null;
    breachedAt?: string | null;
    status: SlaStatus;
  } | null;
};

export type TicketComment = {
  id: string;
  body: string;
  type: "PUBLIC_NOTE" | "INTERNAL_NOTE" | "WORKLOG";
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    email: string;
  };
};

export type TicketStatusHistoryEntry = {
  id: string;
  fromStatus?: TicketStatus | null;
  toStatus: TicketStatus;
  reason?: string | null;
  createdAt: string;
  changedBy: {
    id: string;
    fullName: string;
    email: string;
  };
};

export type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
};

export type PaginatedResponse<TItem> = {
  data: TItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type TicketListQuery = {
  status?: TicketStatus | "ALL";
  priority?: TicketPriority | "ALL";
  from?: string;
  to?: string;
  text?: string;
  sort?: TicketSort;
  searchMode?: TicketSearchMode;
  page?: number;
  pageSize?: number;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
};

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  resource?: string | null;
  resourceId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationListResponse = PaginatedResponse<Notification> & {
  unreadCount: number;
};

export type AuditLogEntry = {
  id: string;
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  success: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: unknown;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  } | null;
};

export type AuditLogListResponse = {
  data: AuditLogEntry[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export type AuditLogQuery = {
  from?: string;
  to?: string;
  actor?: string;
  action?: AuditAction | "ALL";
  resource?: string;
  success?: "ALL" | "true" | "false";
  page?: number;
  pageSize?: number;
  sort?: "asc" | "desc";
};

export type SlaPolicy = {
  id: string;
  name: string;
  description?: string | null;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  businessHoursOnly: boolean;
  isActive: boolean;
};

export type SlaTrackingEntry = {
  id: string;
  status: SlaStatus;
  responseDeadlineAt: string;
  resolutionDeadlineAt: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  breachedAt?: string | null;
  ticket: {
    id: string;
    code: string;
    title: string;
    status: TicketStatus;
    priority: TicketPriority;
    requester: { id: string; fullName: string; email: string };
    assignee?: { id: string; fullName: string; email: string } | null;
  };
  slaPolicy: SlaPolicy;
};

export type SlaTrackingListResponse = PaginatedResponse<SlaTrackingEntry>;

export type SlaEngineRunSummary = {
  trigger: "manual" | "auto";
  ranAt: string;
  defaultPolicyId?: string | null;
  autoAssignedPolicyCount: number;
  processedTickets: number;
  createdTrackingCount: number;
  updatedTrackingCount: number;
  changedStatusCount: number;
  notificationsCreated: number;
};
