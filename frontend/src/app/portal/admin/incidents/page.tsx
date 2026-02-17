"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { fetchTickets, getErrorMessage, updateTicket } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  PaginatedResponse,
  Ticket,
  TicketListQuery,
  TicketPriority,
  TicketSort,
  TicketStatus,
} from "@/lib/types";

export default function AdminIncidentsPage() {
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

  const deferredSearch = useDeferredValue(searchText);
  const pageSize = 12;

  const queryParams = useMemo<TicketListQuery>(
    () => ({
      status: statusFilter,
      priority: priorityFilter,
      from: fromDate || undefined,
      to: toDate || undefined,
      text: deferredSearch || undefined,
      searchMode: deferredSearch ? "FTS" : undefined,
      sort: sortOption,
      page,
      pageSize,
    }),
    [statusFilter, priorityFilter, fromDate, toDate, deferredSearch, sortOption, page],
  );

  const ticketsQuery = useQuery<PaginatedResponse<Ticket>>({
    queryKey: queryKeys.ticketsList(queryParams),
    queryFn: () => fetchTickets(queryParams),
  });

  const updateMutation = useMutation({
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

  const tickets = ticketsQuery.data?.data ?? [];
  const totalResults = ticketsQuery.data?.total ?? 0;
  const totalPages = ticketsQuery.data?.totalPages ?? 1;
  const currentPage = ticketsQuery.data?.page ?? page;

  const errorMessage =
    validationError ||
    getErrorMessage(ticketsQuery.error, "") ||
    getErrorMessage(updateMutation.error, "");

  function resetToFirstPage() {
    setPage(1);
  }

  async function saveTicket(ticketId: string) {
    setValidationError(null);
    const payload: { status?: TicketStatus; priority?: TicketPriority; statusReason?: string } = {};
    if (statusById[ticketId]) payload.status = statusById[ticketId];
    if (priorityById[ticketId]) payload.priority = priorityById[ticketId];
    if (reasonById[ticketId]) payload.statusReason = reasonById[ticketId];

    if (!payload.status && !payload.priority) {
      setValidationError("Selecciona estado o prioridad antes de guardar.");
      return;
    }

    try {
      await updateMutation.mutateAsync({ ticketId, payload });
      setSuccess(`Ticket ${ticketId} actualizado.`);
    } catch {
      // handled by mutation state
    }
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Incidencias / Requerimientos</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">Consola tipo grid operacional</h2>
        <p className="mt-1 text-sm text-slate-600">
          Vista tabular estilo Excel para seguimiento, actualizacion y respuesta de tickets.
        </p>
      </article>

      {errorMessage && <p className="text-sm font-semibold text-red-700">{errorMessage}</p>}
      {success && <p className="text-sm font-semibold text-emerald-700">{success}</p>}

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-7">
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2"
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
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2"
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

        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-slate-600">{totalResults} resultado(s)</p>
          <p className="text-sm text-slate-600">
            Pagina {currentPage} de {totalPages}
          </p>
        </div>

        <div className="overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-[1100px] divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Codigo</th>
                <th className="px-3 py-2 text-left">Asunto</th>
                <th className="px-3 py-2 text-left">Solicitante</th>
                <th className="px-3 py-2 text-left">Asignado</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Prioridad</th>
                <th className="px-3 py-2 text-left">Motivo</th>
                <th className="px-3 py-2 text-left">Creado</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-blue-50/40">
                  <td className="px-3 py-2 font-semibold text-slate-900">{ticket.code}</td>
                  <td className="px-3 py-2 text-slate-800">{ticket.title}</td>
                  <td className="px-3 py-2 text-slate-700">{ticket.requester.fullName}</td>
                  <td className="px-3 py-2 text-slate-700">{ticket.assignee?.fullName ?? "Sin asignar"}</td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1"
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
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1"
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
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-44 rounded-md border border-slate-300 px-2 py-1"
                      placeholder="Motivo del cambio"
                      value={reasonById[ticket.id] ?? ""}
                      onChange={(event) =>
                        setReasonById((prev) => ({
                          ...prev,
                          [ticket.id]: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(ticket.createdAt).toLocaleString("es-PE")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                        onClick={() => saveTicket(ticket.id)}
                        type="button"
                      >
                        Guardar
                      </button>
                      <Link
                        className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                        href={`/portal/admin/tickets/${ticket.id}`}
                      >
                        Detalle
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tickets.length === 0 && <p className="p-5 text-sm text-slate-600">No hay tickets para este filtro.</p>}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:opacity-40"
            disabled={currentPage <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            type="button"
          >
            Anterior
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:opacity-40"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            type="button"
          >
            Siguiente
          </button>
        </div>
      </article>
    </section>
  );
}

