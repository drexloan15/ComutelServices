import { Ticket, TicketPriority, TicketStatus } from "@/lib/types";

export type TicketSortOption =
  | "CREATED_DESC"
  | "CREATED_ASC"
  | "PRIORITY_DESC"
  | "PRIORITY_ASC";

export type TicketFilters = {
  status: TicketStatus | "ALL";
  priority: TicketPriority | "ALL";
  fromDate: string;
  toDate: string;
  text: string;
  sort: TicketSortOption;
};

const priorityRank: Record<TicketPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function toDayStart(dateString: string) {
  return new Date(`${dateString}T00:00:00.000`);
}

function toDayEnd(dateString: string) {
  return new Date(`${dateString}T23:59:59.999`);
}

function includesText(ticket: Ticket, text: string) {
  const haystack = [
    ticket.code,
    ticket.title,
    ticket.description ?? "",
    ticket.type,
    ticket.priority,
    ticket.status,
    ticket.requester.fullName,
    ticket.requester.email,
    ticket.assignee?.fullName ?? "",
    ticket.assignee?.email ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(text.toLowerCase());
}

function compareTickets(a: Ticket, b: Ticket, sort: TicketSortOption) {
  if (sort === "CREATED_ASC") {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  }

  if (sort === "CREATED_DESC") {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }

  if (sort === "PRIORITY_ASC") {
    return priorityRank[a.priority] - priorityRank[b.priority];
  }

  return priorityRank[b.priority] - priorityRank[a.priority];
}

export function filterAndSortTickets(tickets: Ticket[], filters: TicketFilters) {
  const hasFromDate = Boolean(filters.fromDate);
  const hasToDate = Boolean(filters.toDate);
  const fromDate = hasFromDate ? toDayStart(filters.fromDate) : null;
  const toDate = hasToDate ? toDayEnd(filters.toDate) : null;
  const queryText = filters.text.trim();

  return tickets
    .filter((ticket) => {
      if (filters.status !== "ALL" && ticket.status !== filters.status) {
        return false;
      }

      if (filters.priority !== "ALL" && ticket.priority !== filters.priority) {
        return false;
      }

      const createdAt = new Date(ticket.createdAt);
      if (fromDate && createdAt < fromDate) {
        return false;
      }

      if (toDate && createdAt > toDate) {
        return false;
      }

      if (queryText && !includesText(ticket, queryText)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => compareTickets(a, b, filters.sort));
}

export function paginateTickets(tickets: Ticket[], page: number, pageSize: number) {
  const total = tickets.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: tickets.slice(start, start + pageSize),
    page: safePage,
    total,
    totalPages,
  };
}
