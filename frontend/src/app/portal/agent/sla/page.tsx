"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMe,
  fetchSlaPolicies,
  fetchSlaTracking,
  getErrorMessage,
  runSlaEngine,
} from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { SlaStatus, UserProfile } from "@/lib/types";

export default function SlaMonitorPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<SlaStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const meQuery = useQuery<UserProfile>({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
  });

  const trackingParams = useMemo(
    () => ({ page, pageSize, status: statusFilter }),
    [page, statusFilter],
  );

  const trackingQuery = useQuery({
    queryKey: queryKeys.slaTracking(trackingParams),
    queryFn: () => fetchSlaTracking(trackingParams),
  });

  const policiesQuery = useQuery({
    queryKey: queryKeys.slaPolicies,
    queryFn: fetchSlaPolicies,
  });

  const runEngineMutation = useMutation({
    mutationFn: runSlaEngine,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sla"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const trackingRows = trackingQuery.data?.data ?? [];
  const trackingMeta = trackingQuery.data;

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-slate-100 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">SLA Engine</p>
        <h2 className="mt-2 text-3xl font-bold">SLA Monitor</h2>
        <p className="mt-2 text-sm text-blue-100/90">
          Seguimiento de riesgo/incumplimiento y ejecucion manual del motor.
        </p>
      </article>

      {runEngineMutation.error && (
        <p className="text-sm font-medium text-red-700">
          {getErrorMessage(runEngineMutation.error, "No se pudo ejecutar SLA engine.")}
        </p>
      )}
      {runEngineMutation.data && (
        <p className="text-sm font-medium text-emerald-700">
          Motor ejecutado: procesados {runEngineMutation.data.processedTickets}, cambios {runEngineMutation.data.changedStatusCount}, notificaciones {runEngineMutation.data.notificationsCreated}.
        </p>
      )}

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">Politicas SLA</h3>
          {meQuery.data?.role === "ADMIN" && (
            <button
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => runEngineMutation.mutate()}
            >
              Ejecutar SLA Engine
            </button>
          )}
        </div>
        {policiesQuery.isLoading && <p className="text-slate-600">Cargando politicas...</p>}
        {!policiesQuery.isLoading && (policiesQuery.data?.length ?? 0) === 0 && (
          <p className="text-slate-600">No hay politicas SLA activas.</p>
        )}
        {!policiesQuery.isLoading && (policiesQuery.data?.length ?? 0) > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {(policiesQuery.data ?? []).map((policy) => (
              <article key={policy.id} className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-900">{policy.name}</p>
                <p className="text-sm text-slate-700">
                  Resp: {policy.responseTimeMinutes} min | Resol: {policy.resolutionTimeMinutes} min
                </p>
                <p className="text-xs text-slate-500">
                  {policy.isActive ? "Activa" : "Inactiva"} | {policy.businessHoursOnly ? "Horario habil" : "24x7"}
                </p>
              </article>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">Tracking SLA</h3>
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as SlaStatus | "ALL");
              setPage(1);
            }}
          >
            <option value="ALL">Estado: Todos</option>
            <option value="ON_TRACK">ON_TRACK</option>
            <option value="AT_RISK">AT_RISK</option>
            <option value="BREACHED">BREACHED</option>
            <option value="MET">MET</option>
          </select>
        </div>

        {trackingQuery.isLoading && <p className="text-slate-600">Cargando tracking...</p>}
        {trackingQuery.error && (
          <p className="text-sm font-medium text-red-700">
            {getErrorMessage(trackingQuery.error, "No se pudo cargar tracking SLA.")}
          </p>
        )}
        {!trackingQuery.isLoading && trackingRows.length === 0 && (
          <p className="text-slate-600">No hay registros para este filtro.</p>
        )}

        {!trackingQuery.isLoading && trackingRows.length > 0 && (
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">Ticket</th>
                  <th className="px-3 py-2">Estado SLA</th>
                  <th className="px-3 py-2">Resp. limite</th>
                  <th className="px-3 py-2">Resol. limite</th>
                  <th className="px-3 py-2">Policy</th>
                </tr>
              </thead>
              <tbody>
                {trackingRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-900">{row.ticket.code}</p>
                      <p className="text-xs text-slate-600">{row.ticket.title}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.status === "BREACHED"
                            ? "bg-red-100 text-red-700"
                            : row.status === "AT_RISK"
                              ? "bg-amber-100 text-amber-700"
                              : row.status === "MET"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {new Date(row.responseDeadlineAt).toLocaleString("es-PE")}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {new Date(row.resolutionDeadlineAt).toLocaleString("es-PE")}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.slaPolicy.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Pagina {trackingMeta?.page ?? page} de {trackingMeta?.totalPages ?? 1}
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:opacity-40"
              disabled={(trackingMeta?.page ?? page) <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Anterior
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:opacity-40"
              disabled={(trackingMeta?.page ?? page) >= (trackingMeta?.totalPages ?? 1)}
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
