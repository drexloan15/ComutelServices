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
