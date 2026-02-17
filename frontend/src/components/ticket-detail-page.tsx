"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addTicketAttachment,
  addTicketComment,
  applyTicketMacro,
  ApiError,
  createTicketApproval,
  decideTicketApproval,
  fetchTicketMacros,
  fetchTicketWorkspace,
  fetchMe,
  getErrorMessage,
} from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  TicketApprovalType,
  TicketMacro,
  TicketWorkspace,
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
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [approvalType, setApprovalType] = useState<TicketApprovalType>("MANAGER");
  const [approvalNote, setApprovalNote] = useState("");
  const [decisionNoteById, setDecisionNoteById] = useState<Record<string, string>>({});
  const [macroReason, setMacroReason] = useState("");

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

  const workspaceQuery = useQuery<TicketWorkspace>({
    queryKey: queryKeys.ticketWorkspace(ticketId),
    queryFn: () => fetchTicketWorkspace(ticketId),
    enabled: meQuery.isSuccess && isRoleAllowed && Boolean(ticketId),
  });

  const macrosQuery = useQuery<TicketMacro[]>({
    queryKey: queryKeys.ticketMacros,
    queryFn: fetchTicketMacros,
    enabled:
      meQuery.isSuccess &&
      isRoleAllowed &&
      Boolean(ticketId) &&
      meQuery.data?.role !== "REQUESTER",
  });

  const addCommentMutation = useMutation({
    mutationFn: (payload: { body: string; type?: CommentType }) =>
      addTicketComment(ticketId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.ticketWorkspace(ticketId) });
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: () =>
      addTicketAttachment(ticketId, {
        fileName: attachmentName,
        storageUrl: attachmentUrl,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.ticketWorkspace(ticketId) });
    },
  });

  const applyMacroMutation = useMutation({
    mutationFn: (macroId: string) => applyTicketMacro(ticketId, macroId, macroReason || undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.ticketWorkspace(ticketId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) });
    },
  });

  const createApprovalMutation = useMutation({
    mutationFn: () =>
      createTicketApproval(ticketId, {
        type: approvalType,
        note: approvalNote || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.ticketWorkspace(ticketId) });
    },
  });

  const decideApprovalMutation = useMutation({
    mutationFn: ({ approvalId, decision, note }: { approvalId: string; decision: "APPROVED" | "REJECTED"; note?: string }) =>
      decideTicketApproval(ticketId, approvalId, { decision, note }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.ticketWorkspace(ticketId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) });
    },
  });

  const currentError =
    !ticketId
      ? new ApiError(messageForStatus(404), 404)
      : meQuery.error ??
        workspaceQuery.error ??
        macrosQuery.error ??
        addCommentMutation.error ??
        addAttachmentMutation.error ??
        applyMacroMutation.error ??
        createApprovalMutation.error ??
        decideApprovalMutation.error;

  const responseStatus = currentError instanceof ApiError ? currentError.status : null;
  const errorMessage =
    currentError instanceof ApiError && (currentError.status === 403 || currentError.status === 404)
      ? messageForStatus(currentError.status)
      : getErrorMessage(currentError, "");
  const isLoading = meQuery.isLoading || workspaceQuery.isLoading;

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

  async function onAddAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    try {
      await addAttachmentMutation.mutateAsync();
      setAttachmentName("");
      setAttachmentUrl("");
      setSuccess("Adjunto agregado.");
    } catch {
      // handled by mutation state
    }
  }

  async function onCreateApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    try {
      await createApprovalMutation.mutateAsync();
      setApprovalNote("");
      setSuccess("Aprobacion solicitada.");
    } catch {
      // handled by mutation state
    }
  }

  async function onApplyMacro(macroId: string) {
    setSuccess(null);
    try {
      await applyMacroMutation.mutateAsync(macroId);
      setSuccess("Macro aplicada.");
    } catch {
      // handled by mutation state
    }
  }

  async function onDecideApproval(approvalId: string, decision: "APPROVED" | "REJECTED") {
    const note = decisionNoteById[approvalId];
    setSuccess(null);
    try {
      await decideApprovalMutation.mutateAsync({ approvalId, decision, note: note || undefined });
      setSuccess(`Aprobacion ${decision}.`);
    } catch {
      // handled by mutation state
    }
  }

  const workspace = workspaceQuery.data;
  const ticket = workspace?.ticket;

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
        {!isLoading && !ticket && !errorMessage && <p className="text-slate-600">No se pudo cargar el ticket.</p>}
        {!isLoading && ticket && (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-slate-900">
              {ticket.code} - {ticket.title}
            </p>
            <p className="text-sm text-slate-700">
              Estado: <strong>{ticket.status}</strong> | Prioridad: <strong>{ticket.priority}</strong> | Tipo: <strong>{ticket.type}</strong>
            </p>
            <p className="text-sm text-slate-700">
              Impacto: <strong>{ticket.impact}</strong> | Urgencia: <strong>{ticket.urgency}</strong>
            </p>
            <p className="text-sm text-slate-700">
              Solicitante: {ticket.requester.fullName} ({ticket.requester.email})
            </p>
            <p className="text-sm text-slate-700">
              Asignado: {ticket.assignee ? `${ticket.assignee.fullName} (${ticket.assignee.email})` : "Sin asignar"}
            </p>
            <p className="text-sm text-slate-700">
              Grupo: {ticket.supportGroup ? `${ticket.supportGroup.code} - ${ticket.supportGroup.name}` : "Sin grupo"}
            </p>
            <p className="text-sm text-slate-700">
              Servicio impactado: {ticket.impactedService ? `${ticket.impactedService.code} - ${ticket.impactedService.name}` : "No definido"}
            </p>
            {ticket.catalogItem && (
              <p className="text-sm text-slate-700">
                Catalogo: <strong>{ticket.catalogItem.name}</strong> ({ticket.catalogItem.key})
              </p>
            )}
            <p className="text-sm text-slate-700">Creado: {formatDate(ticket.createdAt)}</p>
            {ticket.description && (
              <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                {ticket.description}
              </p>
            )}
          </div>
        )}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Timeline operativo</h3>
        {(workspace?.timeline.length ?? 0) === 0 && <p className="text-slate-600">Sin actividad.</p>}
        {(workspace?.timeline.length ?? 0) > 0 && (
          <div className="space-y-3">
            {(workspace?.timeline ?? []).map((entry) => (
              <article key={entry.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                <p className="text-xs text-slate-500">
                  {entry.type} | {formatDate(entry.occurredAt)}
                </p>
                {entry.actor && (
                  <p className="text-xs text-slate-500">
                    {entry.actor.fullName} ({entry.actor.email})
                  </p>
                )}
                {entry.detail && <p className="mt-1 text-sm text-slate-700">{entry.detail}</p>}
              </article>
            ))}
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

        {(workspace?.comments.length ?? 0) === 0 && <p className="text-slate-600">Sin comentarios.</p>}
        {(workspace?.comments.length ?? 0) > 0 && (
          <div className="space-y-3">
            {(workspace?.comments ?? []).map((comment) => (
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
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Adjuntos</h3>
        <form className="mb-4 grid gap-2 md:grid-cols-3" onSubmit={onAddAttachment}>
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Nombre de archivo"
            value={attachmentName}
            onChange={(event) => setAttachmentName(event.target.value)}
            required
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="URL segura del archivo"
            value={attachmentUrl}
            onChange={(event) => setAttachmentUrl(event.target.value)}
            required
          />
          <button className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">
            Agregar adjunto
          </button>
        </form>
        {(workspace?.attachments.length ?? 0) === 0 && <p className="text-slate-600">Sin adjuntos.</p>}
        {(workspace?.attachments.length ?? 0) > 0 && (
          <div className="space-y-3">
            {(workspace?.attachments ?? []).map((attachment) => (
              <article key={attachment.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">{attachment.fileName}</p>
                <p className="text-xs text-slate-500">{formatDate(attachment.createdAt)}</p>
                <a className="text-sm font-semibold text-blue-700 hover:underline" href={attachment.storageUrl} target="_blank" rel="noreferrer">
                  Abrir archivo
                </a>
              </article>
            ))}
          </div>
        )}
      </article>

      {meQuery.data?.role !== "REQUESTER" && (
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Aprobaciones y macros</h3>

          <form className="mb-4 grid gap-2 md:grid-cols-3" onSubmit={onCreateApproval}>
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={approvalType}
              onChange={(event) => setApprovalType(event.target.value as TicketApprovalType)}
            >
              <option value="MANAGER">MANAGER</option>
              <option value="CHANGE">CHANGE</option>
              <option value="SECURITY">SECURITY</option>
              <option value="FINANCE">FINANCE</option>
            </select>
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Nota de aprobacion"
              value={approvalNote}
              onChange={(event) => setApprovalNote(event.target.value)}
            />
            <button className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">
              Solicitar aprobacion
            </button>
          </form>

          <div className="mb-5 space-y-2">
            {(workspace?.approvals ?? []).map((approval) => (
              <article key={approval.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {approval.type} - {approval.status}
                </p>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Nota de decision"
                  value={decisionNoteById[approval.id] ?? ""}
                  onChange={(event) =>
                    setDecisionNoteById((prev) => ({ ...prev, [approval.id]: event.target.value }))
                  }
                />
                {approval.status === "PENDING" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                      onClick={() => onDecideApproval(approval.id, "APPROVED")}
                      type="button"
                    >
                      Aprobar
                    </button>
                    <button
                      className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
                      onClick={() => onDecideApproval(approval.id, "REJECTED")}
                      type="button"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <input
              className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Razon de ejecucion de macro"
              value={macroReason}
              onChange={(event) => setMacroReason(event.target.value)}
            />
            <div className="grid gap-2 md:grid-cols-2">
              {(macrosQuery.data ?? []).map((macro) => (
                <button
                  key={macro.id}
                  className="rounded-md border border-slate-300 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => onApplyMacro(macro.id)}
                  type="button"
                >
                  {macro.name}
                </button>
              ))}
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
