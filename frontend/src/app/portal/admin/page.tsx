"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageSquareText, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchMe, fetchSlaPredictions, fetchSlaTracking, fetchTickets, getErrorMessage } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { PaginatedResponse, SlaPredictionResponse, SlaTrackingListResponse, Ticket, UserProfile } from "@/lib/types";

const PANEL_FETCH_SIZE = 100;

function formatDateTime(date: Date) {
  return {
    date: date.toLocaleDateString("es-PE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

function formatSignedDuration(ms: number) {
  const sign = ms < 0 ? "-" : "";
  const totalMinutes = Math.floor(Math.abs(ms) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function statusUrgencyRank(status: string) {
  if (status === "BREACHED") return 0;
  if (status === "AT_RISK") return 1;
  if (status === "ON_TRACK") return 2;
  return 3;
}

function priorityDotColor(priority: Ticket["priority"]) {
  if (priority === "URGENT") return "bg-red-500";
  if (priority === "HIGH") return "bg-orange-500";
  if (priority === "MEDIUM") return "bg-blue-500";
  return "bg-cyan-500";
}

function averageDurationHours(values: number[]) {
  if (values.length === 0) return "--";
  const avg = values.reduce((acc, item) => acc + item, 0) / values.length;
  return avg.toFixed(1);
}

function kpiClassName(tone: "teal" | "green" | "red" | "lime") {
  if (tone === "teal") return "text-teal-600";
  if (tone === "green") return "text-emerald-600";
  if (tone === "red") return "text-rose-600";
  return "text-lime-600";
}

type KpiCardProps = {
  label: string;
  value: string;
  tone: "teal" | "green" | "red" | "lime";
};

function KpiCard({ label, value, tone }: KpiCardProps) {
  return (
    <article className="animate-fade-up rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-4xl font-bold ${kpiClassName(tone)}`}>{value}</p>
    </article>
  );
}

export default function AdminPanelPage() {
  const [now, setNow] = useState<Date>(() => new Date());

  const meQuery = useQuery<UserProfile>({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
  });

  const ticketsQuery = useQuery<PaginatedResponse<Ticket>>({
    queryKey: queryKeys.ticketsList({ page: 1, pageSize: PANEL_FETCH_SIZE, sort: "CREATED_DESC" }),
    queryFn: () => fetchTickets({ page: 1, pageSize: PANEL_FETCH_SIZE, sort: "CREATED_DESC" }),
    enabled: meQuery.isSuccess,
  });

  const slaQuery = useQuery<SlaTrackingListResponse>({
    queryKey: queryKeys.slaTracking({ page: 1, pageSize: PANEL_FETCH_SIZE, status: "ALL" }),
    queryFn: () => fetchSlaTracking({ page: 1, pageSize: PANEL_FETCH_SIZE }),
    enabled: meQuery.isSuccess,
    refetchInterval: 30000,
  });

  const predictionQuery = useQuery<SlaPredictionResponse>({
    queryKey: queryKeys.slaPredictions(24),
    queryFn: () => fetchSlaPredictions(24),
    enabled: meQuery.isSuccess,
    refetchInterval: 60000,
  });

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const errorMessage =
    getErrorMessage(meQuery.error, "") ||
    getErrorMessage(ticketsQuery.error, "") ||
    getErrorMessage(slaQuery.error, "") ||
    getErrorMessage(predictionQuery.error, "");

  const tickets = useMemo(() => ticketsQuery.data?.data ?? [], [ticketsQuery.data]);
  const tracking = useMemo(() => slaQuery.data?.data ?? [], [slaQuery.data]);

  const activeTickets = useMemo(
    () => tickets.filter((ticket) => ["OPEN", "IN_PROGRESS", "PENDING"].includes(ticket.status)),
    [tickets],
  );

  const openCount = tickets.filter((ticket) => ticket.status === "OPEN").length;
  const resolvedCount = tickets.filter((ticket) => ["RESOLVED", "CLOSED"].includes(ticket.status)).length;
  const criticalCount = tickets.filter((ticket) => ticket.priority === "URGENT").length;
  const unassignedCount = activeTickets.filter((ticket) => !ticket.assignee).length;
  const predictedBreaches = predictionQuery.data?.data.length ?? 0;

  const firstResponseHours = tracking
    .filter((item) => Boolean(item.firstResponseAt))
    .map((item) => {
      const createdEstimate =
        new Date(item.responseDeadlineAt).getTime() - item.slaPolicy.responseTimeMinutes * 60_000;
      const firstResponse = item.firstResponseAt
        ? new Date(item.firstResponseAt).getTime()
        : createdEstimate;
      return (firstResponse - createdEstimate) / 3_600_000;
    });

  const resolutionHours = tracking
    .filter((item) => Boolean(item.resolvedAt))
    .map((item) => {
      const createdEstimate =
        new Date(item.responseDeadlineAt).getTime() - item.slaPolicy.responseTimeMinutes * 60_000;
      const resolved = item.resolvedAt ? new Date(item.resolvedAt).getTime() : createdEstimate;
      return (resolved - createdEstimate) / 3_600_000;
    });

  const groupedLoad = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const ticket of activeTickets) {
      const groupName = ticket.assignee?.fullName ?? "Sin grupo";
      buckets.set(groupName, (buckets.get(groupName) ?? 0) + 1);
    }
    return [...buckets.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [activeTickets]);

  const maxGroupCount = groupedLoad.length > 0 ? Math.max(...groupedLoad.map((item) => item.count)) : 1;

  const monitoringRows = useMemo(() => {
    return [...tracking]
      .sort((a, b) => {
        const rankDiff = statusUrgencyRank(a.status) - statusUrgencyRank(b.status);
        if (rankDiff !== 0) return rankDiff;
        return (
          new Date(a.resolutionDeadlineAt).getTime() -
          new Date(b.resolutionDeadlineAt).getTime()
        );
      })
      .slice(0, 7)
      .map((item, index) => {
        const remainingMs = new Date(item.resolutionDeadlineAt).getTime() - now.getTime();
        return {
          rank: index + 1,
          id: item.ticket.code,
          title: item.ticket.title,
          assignee: item.ticket.assignee?.fullName ?? "Sin asignar",
          priority: item.ticket.priority,
          remainingLabel: formatSignedDuration(remainingMs),
          remainingMs,
        };
      });
  }, [tracking, now]);

  const currentDateTime = formatDateTime(now);

  return (
    <section className="space-y-6">
      <header className="animate-fade-up flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 text-white shadow-lg shadow-cyan-100">
            <MessageSquareText className="h-7 w-7" />
            <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
          </div>
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
              Hola, {meQuery.data?.fullName ?? "Super Admin"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              IT Manager <span className="mx-2 text-slate-300">|</span> {meQuery.data?.email ?? "admin@comutel.local"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-slate-500">{currentDateTime.date}</p>
            <p className="text-5xl font-bold tracking-tight text-slate-900">{currentDateTime.time}</p>
          </div>
          <button className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600 transition hover:bg-slate-100" type="button">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {errorMessage && <p className="text-sm font-semibold text-red-700">{errorMessage}</p>}

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <KpiCard label="Abiertos" tone="teal" value={String(openCount)} />
            <KpiCard label="Resueltos" tone="green" value={String(resolvedCount)} />
            <KpiCard label="Graves" tone="red" value={String(criticalCount)} />
            <KpiCard label="Sin asignar" tone="lime" value={String(unassignedCount)} />
            <KpiCard label="Por vencer (24h)" tone="red" value={String(predictedBreaches)} />
            <KpiCard label="Resp. prom (h)" tone="lime" value={averageDurationHours(firstResponseHours)} />
            <KpiCard label="Resol. prom (h)" tone="lime" value={averageDurationHours(resolutionHours)} />
          </div>

          <article className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold uppercase tracking-[0.08em] text-slate-800">Carga por grupo</h3>
            <div className="mt-5 space-y-3">
              {groupedLoad.map((item) => (
                <div key={item.name} className="grid grid-cols-[1fr_2fr] items-center gap-3">
                  <p className="text-xs font-medium leading-tight text-slate-600">{item.name}</p>
                  <div className="h-6 rounded-md bg-slate-100">
                    <div
                      className="h-full rounded-md bg-teal-700"
                      style={{ width: `${Math.max(10, (item.count / maxGroupCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {groupedLoad.length === 0 && <p className="text-sm text-slate-500">Sin datos de carga activos.</p>}
            </div>
          </article>
        </aside>

        <article className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-3xl font-bold tracking-tight text-slate-900">Monitoreo SLA</h3>
            <p className="text-sm text-slate-500">Ordenado por urgencia</p>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-[760px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Asunto</th>
                  <th className="px-3 py-2 text-left">Agente</th>
                  <th className="px-3 py-2 text-left">Prioridad</th>
                  <th className="px-3 py-2 text-right">Tiempo restante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monitoringRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className={`h-2.5 w-2.5 rounded-full ${priorityDotColor(row.priority)}`} />
                        <span>{row.rank}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-600">{row.id}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">{row.title}</p>
                    </td>
                    <td className="px-3 py-3">
                      {row.assignee === "Sin asignar" ? (
                        <span className="text-sm italic text-slate-400">Sin asignar</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-xs font-bold uppercase text-teal-700">
                            {row.assignee.slice(0, 1)}
                          </span>
                          <span className="text-slate-700">{row.assignee}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{row.priority}</td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                          row.remainingMs < 0
                            ? "bg-rose-200 text-rose-700"
                            : row.remainingMs < 3_600_000
                              ? "bg-amber-200 text-amber-800"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {row.remainingLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {monitoringRows.length === 0 && <p className="p-5 text-sm text-slate-500">Sin registros SLA para mostrar.</p>}
          </div>
        </article>
      </div>
    </section>
  );
}
