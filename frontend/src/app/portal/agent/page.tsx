"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock3, Headset, LayoutDashboard, Settings, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchMe, fetchSlaPredictions, fetchSlaTracking, fetchTickets, getErrorMessage } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { PaginatedResponse, SlaPredictionResponse, SlaStatus, SlaTrackingListResponse, Ticket, UserProfile } from "@/lib/types";

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

function statusUrgencyRank(status: SlaStatus) {
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

function kpiClassName(tone: "teal" | "green" | "amber" | "rose") {
  if (tone === "teal") return "text-teal-600";
  if (tone === "green") return "text-emerald-600";
  if (tone === "amber") return "text-amber-600";
  return "text-rose-600";
}

function slaBadgeClass(status: SlaStatus) {
  if (status === "BREACHED") return "bg-rose-100 text-rose-700 border-rose-200";
  if (status === "AT_RISK") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "MET") return "bg-cyan-100 text-cyan-700 border-cyan-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

type KpiCardProps = {
  label: string;
  value: string;
  tone: "teal" | "green" | "amber" | "rose";
};

function KpiCard({ label, value, tone }: KpiCardProps) {
  return (
    <article className="animate-fade-up rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-4xl font-bold ${kpiClassName(tone)}`}>{value}</p>
    </article>
  );
}

export default function AgentPanelPage() {
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

  const currentUserEmail = (meQuery.data?.email ?? "").toLowerCase();

  const myTickets = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          ticket.assignee?.email?.toLowerCase() === currentUserEmail,
      ),
    [tickets, currentUserEmail],
  );

  const activeQueue = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          ["OPEN", "IN_PROGRESS", "PENDING"].includes(ticket.status) &&
          (!ticket.assignee || ticket.assignee.email.toLowerCase() === currentUserEmail),
      ),
    [tickets, currentUserEmail],
  );

  const myOpenCount = myTickets.filter((ticket) => ticket.status === "OPEN").length;
  const myResolvedCount = myTickets.filter((ticket) => ["RESOLVED", "CLOSED"].includes(ticket.status)).length;
  const myCriticalCount = myTickets.filter((ticket) => ticket.priority === "URGENT").length;
  const unassignedCount = activeQueue.filter((ticket) => !ticket.assignee).length;
  const myPredictedBreaches =
    predictionQuery.data?.data.filter(
      (item) => item.ticket.assignee?.email?.toLowerCase() === currentUserEmail || !item.ticket.assignee,
    ).length ?? 0;

  const myTracking = useMemo(
    () =>
      tracking.filter(
        (item) => item.ticket.assignee?.email?.toLowerCase() === currentUserEmail,
      ),
    [tracking, currentUserEmail],
  );

  const myQueueTracking = useMemo(
    () =>
      tracking.filter(
        (item) =>
          !item.ticket.assignee ||
          item.ticket.assignee.email.toLowerCase() === currentUserEmail,
      ),
    [tracking, currentUserEmail],
  );

  const firstResponseHours = myTracking
    .filter((item) => Boolean(item.firstResponseAt))
    .map((item) => {
      const createdEstimate =
        new Date(item.responseDeadlineAt).getTime() - item.slaPolicy.responseTimeMinutes * 60_000;
      const firstResponse = item.firstResponseAt
        ? new Date(item.firstResponseAt).getTime()
        : createdEstimate;
      return (firstResponse - createdEstimate) / 3_600_000;
    });

  const resolutionHours = myTracking
    .filter((item) => Boolean(item.resolvedAt))
    .map((item) => {
      const createdEstimate =
        new Date(item.responseDeadlineAt).getTime() - item.slaPolicy.responseTimeMinutes * 60_000;
      const resolved = item.resolvedAt ? new Date(item.resolvedAt).getTime() : createdEstimate;
      return (resolved - createdEstimate) / 3_600_000;
    });

  const workloadBuckets = useMemo(() => {
    const myActive = myTickets.filter((ticket) => ["OPEN", "IN_PROGRESS", "PENDING"].includes(ticket.status)).length;
    const unassignedActive = tickets.filter(
      (ticket) => ["OPEN", "IN_PROGRESS", "PENDING"].includes(ticket.status) && !ticket.assignee,
    ).length;
    const teamActive = tickets.filter(
      (ticket) =>
        ["OPEN", "IN_PROGRESS", "PENDING"].includes(ticket.status) &&
        ticket.assignee &&
        ticket.assignee.email.toLowerCase() !== currentUserEmail,
    ).length;

    return [
      { name: "Mi cola", count: myActive },
      { name: "Sin asignar", count: unassignedActive },
      { name: "Equipo", count: teamActive },
    ];
  }, [tickets, myTickets, currentUserEmail]);

  const maxBucketCount = Math.max(...workloadBuckets.map((item) => item.count), 1);

  const slaSummary = useMemo(() => {
    return myQueueTracking.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { BREACHED: 0, AT_RISK: 0, ON_TRACK: 0, MET: 0 },
    );
  }, [myQueueTracking]);

  const monitoringRows = useMemo(() => {
    return [...myQueueTracking]
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
          ticketId: item.ticket.id,
          rank: index + 1,
          id: item.ticket.code,
          title: item.ticket.title,
          assignee: item.ticket.assignee?.fullName ?? "Sin asignar",
          priority: item.ticket.priority,
          status: item.status,
          remainingLabel: formatSignedDuration(remainingMs),
          remainingMs,
        };
      });
  }, [myQueueTracking, now]);

  const currentDateTime = formatDateTime(now);

  return (
    <section className="space-y-6">
      <header className="animate-fade-up flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg shadow-cyan-100">
            <Headset className="h-7 w-7" />
            <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
          </div>
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
              Hola, {meQuery.data?.fullName ?? "Agente"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Service Desk Agent <span className="mx-2 text-slate-300">|</span> {meQuery.data?.email ?? "agent@comutel.local"}
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
            <KpiCard label="Mis abiertos" tone="teal" value={String(myOpenCount)} />
            <KpiCard label="Mis resueltos" tone="green" value={String(myResolvedCount)} />
            <KpiCard label="Mis urgentes" tone="rose" value={String(myCriticalCount)} />
            <KpiCard label="Sin asignar" tone="amber" value={String(unassignedCount)} />
            <KpiCard label="Por vencer (24h)" tone="rose" value={String(myPredictedBreaches)} />
            <KpiCard label="Resp. prom (h)" tone="teal" value={averageDurationHours(firstResponseHours)} />
            <KpiCard label="Resol. prom (h)" tone="green" value={averageDurationHours(resolutionHours)} />
          </div>

          <article className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold uppercase tracking-[0.08em] text-slate-800">Carga operacional</h3>
            <div className="mt-5 space-y-3">
              {workloadBuckets.map((item) => (
                <div key={item.name} className="grid grid-cols-[1fr_2fr] items-center gap-3">
                  <p className="text-xs font-medium leading-tight text-slate-600">{item.name}</p>
                  <div className="h-6 rounded-md bg-slate-100">
                    <div
                      className="h-full rounded-md bg-cyan-700"
                      style={{ width: `${Math.max(10, (item.count / maxBucketCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-slate-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Alertas SLA
            </h3>
            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-rose-700">Incumplidos</p>
                <p className="text-xl font-bold text-rose-700">{slaSummary.BREACHED}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-800">En riesgo</p>
                <p className="text-xl font-bold text-amber-700">{slaSummary.AT_RISK}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">En control</p>
                <p className="text-xl font-bold text-emerald-700">
                  {slaSummary.ON_TRACK + slaSummary.MET}
                </p>
              </div>
            </div>
          </article>

          <article className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-2">
              <Link
                className="inline-flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                href="/portal/agent/incidents"
              >
                Ir a Incidencias
                <TriangleAlert className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-100"
                href="/portal/agent/dashboard"
              >
                Ir a Dashboard
                <LayoutDashboard className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </aside>

        <article className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900">
              <Clock3 className="h-7 w-7 text-cyan-700" />
              Monitoreo SLA
            </h3>
            <p className="text-sm text-slate-500">Mi cola + sin asignar</p>
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
                  <th className="px-3 py-2 text-left">Estado SLA</th>
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
                    <td className="px-3 py-3 font-semibold text-blue-700">
                      <Link className="hover:underline" href={`/portal/agent/tickets/${row.ticketId}`}>
                        {row.id}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">{row.title}</p>
                    </td>
                    <td className="px-3 py-3">
                      {row.assignee === "Sin asignar" ? (
                        <span className="text-sm italic text-slate-400">Sin asignar</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold uppercase text-cyan-700">
                            {row.assignee.slice(0, 1)}
                          </span>
                          <span className="text-slate-700">{row.assignee}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{row.priority}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${slaBadgeClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
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
