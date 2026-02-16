"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { exportAuditLogsCsv, fetchAuditLogs, getErrorMessage } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { AuditAction, AuditLogQuery } from "@/lib/types";

const auditActions: Array<AuditAction> = [
  "AUTH_BOOTSTRAP_ADMIN",
  "AUTH_REGISTER",
  "AUTH_LOGIN",
  "AUTH_REFRESH",
  "AUTH_LOGOUT",
  "USER_ROLE_CHANGED",
  "USER_STATUS_CHANGED",
  "TICKET_UPDATED",
  "TICKET_DELETED",
  "SLA_ENGINE_RUN",
  "SLA_STATUS_CHANGED",
  "NOTIFICATION_CREATED",
  "NOTIFICATION_READ",
  "NOTIFICATION_READ_ALL",
];

export default function AdminAuditPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState<AuditAction | "ALL">("ALL");
  const [resource, setResource] = useState("");
  const [success, setSuccess] = useState<"ALL" | "true" | "false">("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [error, setError] = useState<string | null>(null);

  const queryParams = useMemo<AuditLogQuery>(
    () => ({
      from: from || undefined,
      to: to || undefined,
      actor: actor || undefined,
      action,
      resource: resource || undefined,
      success,
      sort: "desc",
      page,
      pageSize,
    }),
    [from, to, actor, action, resource, success, page],
  );

  const logsQuery = useQuery({
    queryKey: queryKeys.auditLogs(queryParams),
    queryFn: () => fetchAuditLogs(queryParams),
  });

  const rows = logsQuery.data?.data ?? [];
  const meta = logsQuery.data?.meta;

  async function onExportCsv() {
    setError(null);
    try {
      const blob = await exportAuditLogsCsv(queryParams);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(getErrorMessage(exportError, "No se pudo exportar el CSV."));
    }
  }

  function resetPage() {
    setPage(1);
  }

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-slate-100 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Security & Compliance</p>
        <h2 className="mt-2 text-3xl font-bold">Auditoria</h2>
        <p className="mt-2 text-sm text-blue-100/90">
          Trazabilidad de autenticacion, cambios operativos, SLA y notificaciones.
        </p>
      </article>

      {error && <p className="text-sm font-medium text-red-700">{error}</p>}

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-6">
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            type="datetime-local"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              resetPage();
            }}
          />
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            type="datetime-local"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              resetPage();
            }}
          />
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Actor (id/email/nombre)"
            value={actor}
            onChange={(event) => {
              setActor(event.target.value);
              resetPage();
            }}
          />
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={action}
            onChange={(event) => {
              setAction(event.target.value as AuditAction | "ALL");
              resetPage();
            }}
          >
            <option value="ALL">Accion: Todas</option>
            {auditActions.map((auditAction) => (
              <option key={auditAction} value={auditAction}>
                {auditAction}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Resource"
            value={resource}
            onChange={(event) => {
              setResource(event.target.value);
              resetPage();
            }}
          />
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={success}
            onChange={(event) => {
              setSuccess(event.target.value as "ALL" | "true" | "false");
              resetPage();
            }}
          >
            <option value="ALL">Resultado: Todos</option>
            <option value="true">Exito</option>
            <option value="false">Error</option>
          </select>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-slate-600">Total: {meta?.total ?? 0} registros</p>
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={onExportCsv}
          >
            Export CSV
          </button>
        </div>

        {logsQuery.isLoading && <p className="text-slate-600">Cargando...</p>}
        {logsQuery.error && (
          <p className="text-sm font-medium text-red-700">
            {getErrorMessage(logsQuery.error, "No se pudo cargar auditoria.")}
          </p>
        )}

        {!logsQuery.isLoading && rows.length === 0 && (
          <p className="text-slate-600">No hay resultados para los filtros actuales.</p>
        )}

        {!logsQuery.isLoading && rows.length > 0 && (
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Resource</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Success</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200 align-top">
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {new Date(row.createdAt).toLocaleString("es-PE")}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{row.action}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.resource}
                      {row.resourceId ? ` (${row.resourceId})` : ""}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.actor ? `${row.actor.fullName} (${row.actor.email})` : "Sistema"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.success ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {row.success ? "OK" : "FAIL"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      <pre className="max-w-[32rem] overflow-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(row.details ?? {}, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Pagina {meta?.page ?? page} de {meta?.totalPages ?? 1}
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:opacity-40"
              disabled={!meta || !meta.hasPrevPage}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Anterior
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:opacity-40"
              disabled={!meta || !meta.hasNextPage}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
