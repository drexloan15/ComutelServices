"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addTicketComment,
  ApiError,
  fetchMe,
  fetchTicketComments,
  fetchTicketDetail,
  fetchTicketHistory,
  getErrorMessage,
} from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  TicketComment,
  TicketDetail,
  TicketStatusHistoryEntry,
  UserProfile,
} from "@/lib/types";

type TicketDetailPageProps = {
  ticketId: string;
  backHref: string;
  portalRole: "REQUESTER" | "AGENT" | "ADMIN";
};

type CommentType = "PUBLIC_NOTE" | "INTERNAL_NOTE" | "WORKLOG";

function routeByRole(role: UserProfile["role"]) {
  if (role === "ADMIN") return "/portal/admin";
  if (role === "AGENT") return "/portal/agent";
  return "/portal/user";
}

function roleAllowed(role: UserProfile["role"], portalRole: TicketDetailPageProps["portalRole"]) {
  if (portalRole === "ADMIN") return role === "ADMIN";
  if (portalRole === "AGENT") return role === "AGENT" || role === "ADMIN";
  return role === "REQUESTER";
}

function messageForStatus(status: number) {
  if (status === 403) return "403: No tienes permisos para ver este ticket.";
  if (status === 404) return "404: El ticket no existe.";
  return `Error al consultar ticket (${status}).`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function TicketDetailPage({ ticketId, backHref, portalRole }: TicketDetailPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState<string | null>(null);

  const [newComment, setNewComment] = useState("");
  const [commentType, setCommentType] = useState<CommentType>("PUBLIC_NOTE");

  const meQuery = useQuery<UserProfile>({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
  });

  const isRoleAllowed = roleAllowed(meQuery.data?.role ?? "REQUESTER", portalRole);

  useEffect(() => {
    if (meQuery.isSuccess && !isRoleAllowed) {
      router.replace(routeByRole(meQuery.data.role));
    }
  }, [isRoleAllowed, meQuery.data, meQuery.isSuccess, router]);

  const ticketQuery = useQuery<TicketDetail>({
    queryKey: queryKeys.ticket(ticketId),
    queryFn: () => fetchTicketDetail(ticketId),
    enabled: meQuery.isSuccess && isRoleAllowed && Boolean(ticketId),
  });

  const commentsQuery = useQuery<TicketComment[]>({
    queryKey: queryKeys.ticketComments(ticketId),
    queryFn: () => fetchTicketComments(ticketId),
    enabled: meQuery.isSuccess && isRoleAllowed && Boolean(ticketId),
  });

  const historyQuery = useQuery<TicketStatusHistoryEntry[]>({
    queryKey: queryKeys.ticketHistory(ticketId),
    queryFn: () => fetchTicketHistory(ticketId),
    enabled: meQuery.isSuccess && isRoleAllowed && Boolean(ticketId),
  });

  const addCommentMutation = useMutation({
    mutationFn: (payload: { body: string; type?: CommentType }) =>
      addTicketComment(ticketId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.ticketComments(ticketId) });
    },
  });

  const currentError =
    !ticketId
      ? new ApiError(messageForStatus(404), 404)
      : meQuery.error ?? ticketQuery.error ?? commentsQuery.error ?? historyQuery.error ?? addCommentMutation.error;

  const responseStatus = currentError instanceof ApiError ? currentError.status : null;
  const errorMessage =
    currentError instanceof ApiError && (currentError.status === 403 || currentError.status === 404)
      ? messageForStatus(currentError.status)
      : getErrorMessage(currentError, "");
  const isLoading =
    meQuery.isLoading || ticketQuery.isLoading || commentsQuery.isLoading || historyQuery.isLoading;

  async function onAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    if (!meQuery.data) return;

    const payload =
      meQuery.data.role === "REQUESTER"
        ? { body: newComment }
        : { body: newComment, type: commentType };

    try {
      await addCommentMutation.mutateAsync(payload);
      setSuccess("Comentario agregado.");
      setNewComment("");
      setCommentType("PUBLIC_NOTE");
    } catch {
      // handled by mutation error state
    }
  }

  return (
    <section className="space-y-6">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Detalle de ticket</h2>
            <p className="text-slate-600">Vista operativa por rol con comentarios e historial.</p>
          </div>
          <Link
            href={backHref}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800"
          >
            Volver a la bandeja
          </Link>
        </div>
      </article>

      {errorMessage && (
        <p className="text-sm font-medium text-red-700">
          {errorMessage}
          {responseStatus ? ` (HTTP ${responseStatus})` : ""}
        </p>
      )}
      {success && <p className="text-sm font-medium text-emerald-700">{success}</p>}

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading && <p className="text-slate-600">Cargando...</p>}
        {!isLoading && !ticketQuery.data && !errorMessage && (
          <p className="text-slate-600">No se pudo cargar el ticket.</p>
        )}
        {!isLoading && ticketQuery.data && (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-slate-900">
              {ticketQuery.data.code} - {ticketQuery.data.title}
            </p>
            <p className="text-sm text-slate-700">
              Estado: <strong>{ticketQuery.data.status}</strong> | Prioridad: <strong>{ticketQuery.data.priority}</strong> |
              Tipo: <strong>{ticketQuery.data.type}</strong>
            </p>
            <p className="text-sm text-slate-700">
              Impacto: <strong>{ticketQuery.data.impact}</strong> | Urgencia: <strong>{ticketQuery.data.urgency}</strong>
            </p>
            <p className="text-sm text-slate-700">
              Solicitante: {ticketQuery.data.requester.fullName} ({ticketQuery.data.requester.email})
            </p>
            <p className="text-sm text-slate-700">
              Asignado: {ticketQuery.data.assignee ? `${ticketQuery.data.assignee.fullName} (${ticketQuery.data.assignee.email})` : "Sin asignar"}
            </p>
            <p className="text-sm text-slate-700">Creado: {formatDate(ticketQuery.data.createdAt)}</p>
            {ticketQuery.data.description && (
              <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                {ticketQuery.data.description}
              </p>
            )}
          </div>
        )}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Comentarios</h3>
        <form className="mb-4 grid gap-2 md:grid-cols-4" onSubmit={onAddComment}>
          <textarea
            className="rounded-md border border-slate-300 px-3 py-2 md:col-span-3"
            placeholder="Escribe un comentario"
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            rows={2}
            minLength={2}
            maxLength={2000}
            required
          />
          {meQuery.data?.role !== "REQUESTER" && (
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={commentType}
              onChange={(event) => setCommentType(event.target.value as CommentType)}
            >
              <option value="PUBLIC_NOTE">PUBLIC_NOTE</option>
              <option value="INTERNAL_NOTE">INTERNAL_NOTE</option>
              <option value="WORKLOG">WORKLOG</option>
            </select>
          )}
          <button className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white md:col-span-4">
            Agregar comentario
          </button>
        </form>

        {(commentsQuery.data?.length ?? 0) === 0 && <p className="text-slate-600">Sin comentarios.</p>}
        {(commentsQuery.data?.length ?? 0) > 0 && (
          <div className="space-y-3">
            {(commentsQuery.data ?? []).map((comment) => (
              <article key={comment.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {comment.author.fullName} ({comment.type})
                </p>
                <p className="text-xs text-slate-500">{formatDate(comment.createdAt)}</p>
                <p className="mt-2 text-sm text-slate-700">{comment.body}</p>
              </article>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Historial de estado</h3>
        {(historyQuery.data?.length ?? 0) === 0 && <p className="text-slate-600">Sin cambios de estado.</p>}
        {(historyQuery.data?.length ?? 0) > 0 && (
          <div className="space-y-3">
            {(historyQuery.data ?? []).map((entry) => (
              <article key={entry.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {entry.fromStatus ?? "N/A"} -&gt; {entry.toStatus}
                </p>
                <p className="text-xs text-slate-500">
                  {entry.changedBy.fullName} | {formatDate(entry.createdAt)}
                </p>
                {entry.reason && <p className="mt-1 text-sm text-slate-700">{entry.reason}</p>}
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
