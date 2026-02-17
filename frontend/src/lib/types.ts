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
  | "NOTIFICATION_READ_ALL"
  | "KNOWLEDGE_ARTICLE_CREATED"
  | "KNOWLEDGE_ARTICLE_UPDATED"
  | "KNOWLEDGE_COMMENT_CREATED";

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
  supportGroup?: {
    id: string;
    code: string;
    name: string;
  } | null;
  catalogItem?: {
    id: string;
    key: string;
    name: string;
    requiresApproval?: boolean;
  } | null;
  catalogFormPayload?: Record<string, unknown> | null;
  impactedService?: {
    id: string;
    code: string;
    name: string;
    isCritical?: boolean;
  } | null;
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

export type CatalogFieldType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "SELECT"
  | "BOOLEAN"
  | "DATE"
  | "EMAIL"
  | "USER";

export type TicketApprovalType = "MANAGER" | "CHANGE" | "SECURITY" | "FINANCE";
export type TicketApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type TicketActivityType =
  | "CREATED"
  | "UPDATED"
  | "COMMENTED"
  | "STATUS_CHANGED"
  | "PRIORITY_CHANGED"
  | "ASSIGNED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_DECIDED"
  | "ATTACHMENT_ADDED"
  | "MACRO_APPLIED"
  | "WORKFLOW_APPLIED"
  | "SLA_PAUSED"
  | "SLA_RESUMED";

export type ServiceCatalogField = {
  id: string;
  key: string;
  label: string;
  fieldType: CatalogFieldType;
  required: boolean;
  order: number;
  placeholder?: string | null;
  helpText?: string | null;
  optionsJson?: Record<string, unknown> | null;
  showWhenFieldKey?: string | null;
  showWhenValue?: string | null;
  validationRegex?: string | null;
};

export type ServiceCatalogItem = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  ticketType: TicketType;
  defaultPriority: TicketPriority;
  requiresApproval: boolean;
  approvalType?: TicketApprovalType | null;
  isActive: boolean;
  fields: ServiceCatalogField[];
};

export type TicketApproval = {
  id: string;
  type: TicketApprovalType;
  status: TicketApprovalStatus;
  sequence: number;
  decisionNote?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
  approver?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  requestedBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

export type TicketActivity = {
  id: string;
  type: TicketActivityType;
  title: string;
  detail?: string | null;
  metadata?: unknown;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

export type TicketAttachment = {
  id: string;
  fileName: string;
  storageUrl: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
  uploadedBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

export type TicketMacro = {
  id: string;
  name: string;
  description?: string | null;
  availableForRole?: Role | null;
  setStatus?: TicketStatus | null;
  setPriority?: TicketPriority | null;
  addCommentBody?: string | null;
};

export type TicketWorkspaceTimelineItem = {
  id: string;
  occurredAt: string;
  type: "STATUS_HISTORY" | "COMMENT" | "ACTIVITY" | "ATTACHMENT" | "APPROVAL";
  title: string;
  detail?: string | null;
  actor?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

export type TicketWorkspace = {
  ticket: TicketDetail;
  timeline: TicketWorkspaceTimelineItem[];
  comments: TicketComment[];
  history: TicketStatusHistoryEntry[];
  activities: TicketActivity[];
  approvals: TicketApproval[];
  attachments: TicketAttachment[];
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

export type SlaPredictionEntry = {
  trackingId: string;
  status: SlaStatus;
  resolutionDeadlineAt: string;
  predictedBreachAt: string;
  riskScore: number;
  remainingMinutes: number;
  ticket: {
    id: string;
    code: string;
    title: string;
    status: TicketStatus;
    priority: TicketPriority;
    assignee?: { id: string; fullName: string; email: string } | null;
    supportGroup?: { id: string; code: string; name: string } | null;
  };
};

export type SlaPredictionResponse = {
  generatedAt: string;
  windowHours: number;
  data: SlaPredictionEntry[];
};

export type BusinessService = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isCritical: boolean;
  ownerGroup?: { id: string; code: string; name: string } | null;
};

export type CmdbAsset = {
  id: string;
  code: string;
  name: string;
  type: "HARDWARE" | "SOFTWARE" | "SERVICE" | "NETWORK" | "OTHER";
  status: "IN_USE" | "AVAILABLE" | "MAINTENANCE" | "RETIRED" | "LOST";
};

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

export type KnowledgeArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  body: string;
  coverImageUrl?: string | null;
  galleryImageUrls: string[];
  tags: string[];
  isPublished: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  };
  _count: {
    comments: number;
  };
};

export type KnowledgeComment = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  };
};

export type KnowledgeListQuery = {
  search?: string;
  tag?: string;
  publishedOnly?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "LATEST" | "OLDEST";
};

export type CreateKnowledgeArticleInput = {
  title: string;
  excerpt?: string;
  body: string;
  coverImageUrl?: string;
  galleryImageUrls?: string[];
  tags?: string[];
  isPublished?: boolean;
};

export type UpdateKnowledgeArticleInput = Partial<CreateKnowledgeArticleInput>;
