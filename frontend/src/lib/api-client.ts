import { authedFetch, parseApiError } from "@/lib/auth";
import {
  ManagedUser,
  Role,
  Ticket,
  TicketComment,
  TicketDetail,
  TicketPriority,
  TicketStatus,
  TicketStatusHistoryEntry,
  TicketType,
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
};

type UpdateTicketInput = {
  status?: TicketStatus;
  priority?: TicketPriority;
  statusReason?: string;
};

type AddTicketCommentInput = {
  body: string;
  type?: "PUBLIC_NOTE" | "INTERNAL_NOTE" | "WORKLOG";
};

export function fetchMe() {
  return requestJson<UserProfile>("/auth/me");
}

export function fetchTickets() {
  return requestJson<Ticket[]>("/tickets");
}

export function fetchUsers() {
  return requestJson<ManagedUser[]>("/users");
}

export function fetchTicketDetail(ticketId: string) {
  return requestJson<TicketDetail>(`/tickets/${ticketId}`);
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
