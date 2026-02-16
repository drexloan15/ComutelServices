"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, fetchTickets, getErrorMessage, updateTicket } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  PaginatedResponse,
  Ticket,
  TicketListQuery,
  TicketPriority,
  TicketSort,
  TicketStatus,
  UserProfile,
} from "@/lib/types";

export default function AgentPortalPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusById, setStatusById] = useState<Record<string, TicketStatus>>({});
  const [priorityById, setPriorityById] = useState<Record<string, TicketPriority>>({});
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "ALL">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchText, setSearchText] = useState("");
  const [sortOption, setSortOption] = useState<TicketSort>("CREATED_DESC");
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const deferredSearchText = useDeferredValue(searchText);

  const meQuery = useQuery<UserProfile>({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
  });

  const roleAllowed = meQuery.data?.role === "AGENT" || meQuery.data?.role === "ADMIN";

  useEffect(() => {
    if (meQuery.isSuccess && !roleAllowed) {
      router.replace("/portal/user");
    }
  }, [meQuery.isSuccess, roleAllowed, router]);

  const ticketQueryParams = useMemo<TicketListQuery>(
    () => ({
      status: statusFilter,
      priority: priorityFilter,
      from: fromDate || undefined,
      to: toDate || undefined,
      text: deferredSearchText || undefined,
      searchMode: deferredSearchText ? "FTS" : undefined,
      sort: sortOption,
      page,
      pageSize,
    }),
    [statusFilter, priorityFilter, fromDate, toDate, deferredSearchText, sortOption, page],
  );

  const ticketsQuery = useQuery<PaginatedResponse<Ticket>>({
    queryKey: queryKeys.ticketsList(ticketQueryParams),
    queryFn: () => fetchTickets(ticketQueryParams),
    enabled: meQuery.isSuccess && roleAllowed,
  });

  const updateTicketMutation = useMutation({
    mutationFn: ({
      ticketId,
      payload,
    }: {
      ticketId: string;
      payload: { status?: TicketStatus; priority?: TicketPriority; statusReason?: string };
    }) => updateTicket(ticketId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tickets });
    },
  });

  const isLoading = meQuery.isLoading || ticketsQuery.isLoading;
  const errorMessage =
    validationError ||
    getErrorMessage(meQuery.error, "") ||
    getErrorMessage(ticketsQuery.error, "") ||
    getErrorMessage(updateTicketMutation.error, "");

  const tickets = useMemo(() => ticketsQuery.data?.data ?? [], [ticketsQuery.data]);
  const totalResults = ticketsQuery.data?.total ?? 0;
  const totalPages = ticketsQuery.data?.totalPages ?? 1;
  const currentPage = ticketsQuery.data?.page ?? page;

  const openCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "OPEN").length,
    [tickets],
  );
  const inProgressCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "IN_PROGRESS").length,
    [tickets],
  );
  const pendingCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "PENDING").length,
    [tickets],
  );

  function resetToFirstPage() {
    setPage(1);
  }

  async function saveTicket(ticketId: string) {
    setValidationError(null);
    const payload: { status?: TicketStatus; priority?: TicketPriority; statusReason?: string } =
      {};
    if (statusById[ticketId]) payload.status = statusById[ticketId];
    if (priorityById[ticketId]) payload.priority = priorityById[ticketId];
    if (reasonById[ticketId]) payload.statusReason = reasonById[ticketId];

    if (!payload.status && !payload.priority) {
      setValidationError("Selecciona estado o prioridad.");
      return;
    }

    try {
      await updateTicketMutation.mutateAsync({ ticketId, payload });
      setSuccess("Ticket actualizado.");
    } catch {
      // handled by mutation error state
    }
  }

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-slate-100 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Centro Operativo</p>
        <h2 className="mt-2 text-3xl font-bold">Portal Agente</h2>
        <p className="mt-2 text-sm text-blue-100/90">
          {meQuery.data
            ? `Sesion activa: ${meQuery.data.fullName} (${meQuery.data.role})`
            : "Gestion de tickets con filtros de respuesta y prioridad."}
        </p>
      </article>

      <article className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Abiertos</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{openCount}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            En progreso
          </p>
          <p className="mt-2 text-3xl font-bold text-cyan-700">{inProgressCount}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Pendientes
          </p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{pendingCount}</p>
        </div>
      </article>

      {errorMessage && <p className="text-sm font-medium text-red-700">{errorMessage}</p>}
      {success && <p className="text-sm font-medium text-emerald-700">{success}</p>}

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">Bandeja de tickets</h3>
          <p className="text-sm text-slate-600">{totalResults} resultado(s)</p>
        </div>

        <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-6">
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
            placeholder="Buscar por codigo, asunto, solicitante..."
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
              resetToFirstPage();
            }}
          />
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as TicketStatus | "ALL");
              resetToFirstPage();
            }}
          >
            <option value="ALL">Estado: Todos</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="PENDING">PENDING</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={priorityFilter}
            onChange={(event) => {
              setPriorityFilter(event.target.value as TicketPriority | "ALL");
              resetToFirstPage();
            }}
          >
            <option value="ALL">Prioridad: Todas</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              resetToFirstPage();
            }}
          />
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              resetToFirstPage();
            }}
          />
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
            value={sortOption}
            onChange={(event) => {
              setSortOption(event.target.value as TicketSort);
              resetToFirstPage();
            }}
          >
            <option value="CREATED_DESC">Orden: mas recientes</option>
            <option value="CREATED_ASC">Orden: mas antiguos</option>
            <option value="PRIORITY_DESC">Orden: prioridad alta a baja</option>
            <option value="PRIORITY_ASC">Orden: prioridad baja a alta</option>
          </select>
        </div>

        {isLoading && <p className="text-slate-600">Cargando...</p>}
        {!isLoading && tickets.length === 0 && <p className="text-slate-600">No hay tickets.</p>}
        {!isLoading && tickets.length > 0 && (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="rounded-lg border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">
                  {ticket.code} - {ticket.title}
                </p>
                <p className="text-sm text-slate-600">
                  {ticket.type} | {ticket.status} | {ticket.priority}
                </p>
                <Link
                  href={`/portal/agent/tickets/${ticket.id}`}
                  className="mt-2 inline-block rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-800"
                >
                  Ver detalle
                </Link>
                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  <select
                    className="rounded-md border border-slate-300 px-3 py-2"
                    value={statusById[ticket.id] ?? ticket.status}
                    onChange={(event) =>
                      setStatusById((prev) => ({
                        ...prev,
                        [ticket.id]: event.target.value as TicketStatus,
                      }))
                    }
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="PENDING">PENDING</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                  <select
                    className="rounded-md border border-slate-300 px-3 py-2"
                    value={priorityById[ticket.id] ?? ticket.priority}
                    onChange={(event) =>
                      setPriorityById((prev) => ({
                        ...prev,
                        [ticket.id]: event.target.value as TicketPriority,
                      }))
                    }
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2"
                    placeholder="Motivo del cambio"
                    value={reasonById[ticket.id] ?? ""}
                    onChange={(event) =>
                      setReasonById((prev) => ({
                        ...prev,
                        [ticket.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white md:col-span-3"
                    onClick={() => saveTicket(ticket.id)}
                  >
                    Guardar cambios
                  </button>
                </div>
              </article>
            ))}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <p className="text-sm text-slate-600">
                Pagina {currentPage} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:opacity-40"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                >
                  Anterior
                </button>
                <button
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:opacity-40"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
