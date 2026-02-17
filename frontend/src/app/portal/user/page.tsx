"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useDeferredValue, useMemo, useState } from "react";
import {
  createTicket,
  fetchCatalogItems,
  fetchKnowledgeArticles,
  fetchMe,
  fetchTickets,
  getErrorMessage,
} from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  PaginatedResponse,
  Ticket,
  KnowledgeArticle,
  ServiceCatalogItem,
  UserProfile,
} from "@/lib/types";

export default function UserPortalPage() {
  const [success, setSuccess] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [catalogPayload, setCatalogPayload] = useState<Record<string, unknown>>({});
  const [ticketSearch, setTicketSearch] = useState("");
  const deferredTicketSearch = useDeferredValue(ticketSearch);
  const queryClient = useQueryClient();

  const meQuery = useQuery<UserProfile>({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
  });

  const ticketListQuery = {
    page: 1,
    pageSize: 100,
    sort: "CREATED_DESC" as const,
  };

  const ticketsQuery = useQuery<PaginatedResponse<Ticket>>({
    queryKey: queryKeys.ticketsList(ticketListQuery),
    queryFn: () => fetchTickets(ticketListQuery),
    enabled: meQuery.isSuccess,
  });

  const knowledgeQuery = useQuery<PaginatedResponse<KnowledgeArticle>>({
    queryKey: queryKeys.knowledgeArticles({
      page: 1,
      pageSize: 3,
      publishedOnly: true,
      sort: "LATEST",
    }),
    queryFn: () =>
      fetchKnowledgeArticles({
        page: 1,
        pageSize: 3,
        publishedOnly: true,
        sort: "LATEST",
      }),
    enabled: meQuery.isSuccess,
  });

  const catalogQuery = useQuery<ServiceCatalogItem[]>({
    queryKey: queryKeys.catalogItems,
    queryFn: fetchCatalogItems,
    enabled: meQuery.isSuccess,
  });

  const createTicketMutation = useMutation({
    mutationFn: createTicket,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tickets });
    },
  });

  const effectiveCatalogItemId = catalogItemId || catalogQuery.data?.[0]?.id || "";
  const selectedCatalogItem = useMemo(
    () => (catalogQuery.data ?? []).find((item) => item.id === effectiveCatalogItemId) ?? null,
    [effectiveCatalogItemId, catalogQuery.data],
  );

  const visibleTickets = useMemo(() => {
    if (!meQuery.data) return [];
    return (ticketsQuery.data?.data ?? []).filter(
      (ticket) => ticket.requester.email === meQuery.data?.email,
    );
  }, [meQuery.data, ticketsQuery.data]);

  const filteredTickets = useMemo(() => {
    if (!deferredTicketSearch.trim()) {
      return visibleTickets;
    }
    const search = deferredTicketSearch.toLowerCase();
    return visibleTickets.filter((ticket) =>
      [
        ticket.code,
        ticket.title,
        ticket.description ?? "",
        ticket.type,
        ticket.status,
        ticket.priority,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [deferredTicketSearch, visibleTickets]);

  const errorMessage =
    getErrorMessage(meQuery.error, "") ||
    getErrorMessage(ticketsQuery.error, "") ||
    getErrorMessage(catalogQuery.error, "") ||
    getErrorMessage(createTicketMutation.error, "");
  const isLoading = meQuery.isLoading || ticketsQuery.isLoading;

  async function onCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);

    if (!meQuery.data) return;
    if (!selectedCatalogItem) return;

    try {
      await createTicketMutation.mutateAsync({
        title,
        description: description || undefined,
        priority: selectedCatalogItem.defaultPriority,
        type: selectedCatalogItem.ticketType,
        requesterName: meQuery.data.fullName,
        requesterEmail: meQuery.data.email,
        catalogItemId: selectedCatalogItem.id,
        catalogFormPayload: catalogPayload,
      });
      setTitle("");
      setDescription("");
      setCatalogPayload({});
      setSuccess("Ticket creado.");
    } catch {
      // handled by mutation error state
    }
  }

  function onCatalogFieldChange(fieldKey: string, value: unknown) {
    setCatalogPayload((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  }

  function isCatalogFieldVisible(field: ServiceCatalogItem["fields"][number]) {
    if (!field.showWhenFieldKey || field.showWhenValue === null || field.showWhenValue === undefined) {
      return true;
    }
    const dependentValue = catalogPayload[field.showWhenFieldKey];
    return String(dependentValue ?? "") === String(field.showWhenValue);
  }

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-slate-100 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Centro de Ayuda</p>
        <h2 className="mt-2 text-4xl font-bold leading-tight">En que podemos ayudarte hoy?</h2>
        <p className="mt-2 max-w-2xl text-sm text-blue-100/85">
          Crea solicitudes, sigue el estado de tus casos y encuentra rapido tus tickets activos.
        </p>
        <input
          className="mt-5 w-full rounded-xl border border-blue-200/30 bg-white/95 px-4 py-3 text-slate-900"
          placeholder="Buscar en mis tickets..."
          value={ticketSearch}
          onChange={(event) => setTicketSearch(event.target.value)}
        />
      </article>

      {errorMessage && <p className="text-sm font-medium text-red-700">{errorMessage}</p>}
      {success && <p className="text-sm font-medium text-emerald-700">{success}</p>}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Mis tickets</h3>
          {isLoading && <p className="text-slate-600">Cargando...</p>}
          {!isLoading && filteredTickets.length === 0 && (
            <p className="text-slate-600">No se encontraron tickets con ese criterio.</p>
          )}
          {!isLoading && filteredTickets.length > 0 && (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <article key={ticket.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {ticket.code} - {ticket.title}
                    </p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {ticket.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {ticket.type} | Prioridad {ticket.priority}
                  </p>
                  <Link
                    href={`/portal/user/tickets/${ticket.id}`}
                    className="mt-3 inline-block rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"
                  >
                    Ver detalle
                  </Link>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Nuevo ticket</h3>
          <form className="grid gap-3" onSubmit={onCreateTicket}>
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Titulo"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <textarea
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Descripcion"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={effectiveCatalogItemId}
              onChange={(event) => {
                setCatalogItemId(event.target.value);
                setCatalogPayload({});
              }}
              required
            >
              {(catalogQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {selectedCatalogItem && (
              <p className="text-xs text-slate-600">
                Tipo {selectedCatalogItem.ticketType} | Prioridad base {selectedCatalogItem.defaultPriority}
              </p>
            )}
            {(selectedCatalogItem?.fields ?? [])
              .filter((field) => isCatalogFieldVisible(field))
              .map((field) => {
                const currentValue = catalogPayload[field.key];
                if (field.fieldType === "TEXTAREA") {
                  return (
                    <textarea
                      key={field.id}
                      className="rounded-md border border-slate-300 px-3 py-2"
                      placeholder={field.placeholder ?? field.label}
                      value={typeof currentValue === "string" ? currentValue : ""}
                      onChange={(event) => onCatalogFieldChange(field.key, event.target.value)}
                      rows={3}
                      required={field.required}
                    />
                  );
                }

                if (field.fieldType === "SELECT") {
                  const options = Array.isArray(field.optionsJson?.options)
                    ? field.optionsJson?.options.filter((option): option is string => typeof option === "string")
                    : [];
                  return (
                    <select
                      key={field.id}
                      className="rounded-md border border-slate-300 px-3 py-2"
                      value={typeof currentValue === "string" ? currentValue : ""}
                      onChange={(event) => onCatalogFieldChange(field.key, event.target.value)}
                      required={field.required}
                    >
                      <option value="">{field.label}</option>
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  );
                }

                if (field.fieldType === "BOOLEAN") {
                  return (
                    <label key={field.id} className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(currentValue)}
                        onChange={(event) => onCatalogFieldChange(field.key, event.target.checked)}
                      />
                      {field.label}
                    </label>
                  );
                }

                return (
                  <input
                    key={field.id}
                    className="rounded-md border border-slate-300 px-3 py-2"
                    type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : "text"}
                    placeholder={field.placeholder ?? field.label}
                    value={typeof currentValue === "string" || typeof currentValue === "number" ? String(currentValue) : ""}
                    onChange={(event) => onCatalogFieldChange(field.key, event.target.value)}
                    required={field.required}
                  />
                );
              })}
            <button className="rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 font-semibold text-white">
              Crear ticket
            </button>
          </form>
        </article>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Knowledge recomendado</h3>
          <Link
            className="text-sm font-semibold text-blue-700"
            href="/portal/user/knowledge"
          >
            Ver toda la base
          </Link>
        </div>
        {(knowledgeQuery.data?.data ?? []).length === 0 && (
          <p className="text-slate-600">Sin articulos publicados por ahora.</p>
        )}
        {(knowledgeQuery.data?.data ?? []).length > 0 && (
          <div className="grid gap-3 md:grid-cols-3">
            {(knowledgeQuery.data?.data ?? []).map((article) => (
              <article key={article.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">{article.title}</p>
                <p className="mt-1 line-clamp-3 text-xs text-slate-600">
                  {article.excerpt || article.body}
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {article._count.comments} comentario(s)
                </p>
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
