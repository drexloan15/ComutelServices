"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchSlaTracking, fetchTickets, getErrorMessage } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type TicketsDashboardProps = {
  title: string;
};

const DASHBOARD_FETCH_SIZE = 100;

type DonutPoint = {
  name: string;
  value: number;
  color: string;
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#2563eb",
  IN_PROGRESS: "#06b6d4",
  PENDING: "#f59e0b",
  RESOLVED: "#16a34a",
  CLOSED: "#334155",
  CANCELLED: "#dc2626",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#10b981",
  MEDIUM: "#0ea5e9",
  HIGH: "#f97316",
  URGENT: "#ef4444",
};

const SLA_COLORS: Record<string, string> = {
  ON_TRACK: "#22c55e",
  AT_RISK: "#f59e0b",
  BREACHED: "#ef4444",
  MET: "#0ea5e9",
};

function buildDonutRows(keys: string[], colorMap: Record<string, string>, counts: Record<string, number>) {
  return keys.map((key) => ({
    name: key,
    value: counts[key] ?? 0,
    color: colorMap[key] ?? "#64748b",
  }));
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <article className="glass-card animate-fade-up rounded-2xl border border-slate-200 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color: accent }}>
        {value}
      </p>
    </article>
  );
}

function DonutPanel({ title, data }: { title: string; data: DonutPoint[] }) {
  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <article className="glass-card animate-fade-up rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_0.9fr]">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(value: number | string | undefined) => [
                  String(value ?? 0),
                  "tickets",
                ]}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={86}
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Total</p>
          <p className="text-2xl font-bold text-slate-900">{total}</p>
          <div className="space-y-2 pt-2">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-semibold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export function TicketsDashboard({ title }: TicketsDashboardProps) {
  const ticketsQuery = useQuery({
    queryKey: queryKeys.ticketsList({ page: 1, pageSize: DASHBOARD_FETCH_SIZE, sort: "CREATED_DESC" }),
    queryFn: () => fetchTickets({ page: 1, pageSize: DASHBOARD_FETCH_SIZE, sort: "CREATED_DESC" }),
    refetchInterval: 30000,
  });

  const slaQuery = useQuery({
    queryKey: queryKeys.slaTracking({ page: 1, pageSize: DASHBOARD_FETCH_SIZE, status: "ALL" }),
    queryFn: () => fetchSlaTracking({ page: 1, pageSize: DASHBOARD_FETCH_SIZE }),
    refetchInterval: 30000,
  });

  const errorMessage =
    getErrorMessage(ticketsQuery.error, "") || getErrorMessage(slaQuery.error, "");

  const tickets = ticketsQuery.data?.data ?? [];
  const tracking = slaQuery.data?.data ?? [];

  const statusCount = tickets.reduce<Record<string, number>>((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] ?? 0) + 1;
    return acc;
  }, {});

  const priorityCount = tickets.reduce<Record<string, number>>((acc, ticket) => {
    acc[ticket.priority] = (acc[ticket.priority] ?? 0) + 1;
    return acc;
  }, {});

  const slaCount = tracking.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  const statusRows = buildDonutRows(
    ["OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED", "CANCELLED"],
    STATUS_COLORS,
    statusCount,
  );
  const priorityRows = buildDonutRows(["LOW", "MEDIUM", "HIGH", "URGENT"], PRIORITY_COLORS, priorityCount);
  const slaRows = buildDonutRows(["ON_TRACK", "AT_RISK", "BREACHED", "MET"], SLA_COLORS, slaCount);

  const totalBreached = slaCount.BREACHED ?? 0;
  const totalAtRisk = slaCount.AT_RISK ?? 0;
  const urgentTickets = priorityCount.URGENT ?? 0;

  const now = new Date();
  const trendRows = Array.from({ length: 10 }).map((_, idx) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (9 - idx));
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    const created = tickets.filter((ticket) => {
      const ts = new Date(ticket.createdAt).getTime();
      return ts >= date.getTime() && ts < nextDate.getTime();
    }).length;

    const resolved = tracking.filter((item) => {
      if (!item.resolvedAt) return false;
      const ts = new Date(item.resolvedAt).getTime();
      return ts >= date.getTime() && ts < nextDate.getTime();
    }).length;

    return {
      day: date.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" }),
      created,
      resolved,
    };
  });

  const resolvedRows = tracking.filter((item) => Boolean(item.resolvedAt));
  const avgResolutionHours =
    resolvedRows.length > 0
      ? resolvedRows.reduce((acc, item) => {
          const start =
            new Date(item.responseDeadlineAt).getTime() -
            item.slaPolicy.responseTimeMinutes * 60_000;
          const end = item.resolvedAt ? new Date(item.resolvedAt).getTime() : start;
          return acc + (end - start) / 3_600_000;
        }, 0) / resolvedRows.length
      : 0;

  const firstResponseRows = tracking.filter((item) => Boolean(item.firstResponseAt));
  const avgFirstResponseHours =
    firstResponseRows.length > 0
      ? firstResponseRows.reduce((acc, item) => {
          const start =
            new Date(item.responseDeadlineAt).getTime() -
            item.slaPolicy.responseTimeMinutes * 60_000;
          const end = item.firstResponseAt ? new Date(item.firstResponseAt).getTime() : start;
          return acc + (end - start) / 3_600_000;
        }, 0) / firstResponseRows.length
      : 0;

  return (
    <section className="space-y-6">
      <article className="glass-card animate-fade-up rounded-2xl border border-slate-200 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Dashboard</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Panel analítico en tiempo real: tendencias de carga, calidad de respuesta y cumplimiento de SLA.
        </p>
      </article>

      {errorMessage && <p className="text-sm font-semibold text-red-700">{errorMessage}</p>}

      <article className="grid gap-4 md:grid-cols-5">
        <StatCard accent="#0b2c7c" label="Tickets analizados" value={String(tickets.length)} />
        <StatCard accent="#0ea5e9" label="Registros SLA" value={String(tracking.length)} />
        <StatCard accent="#d97706" label="SLA en riesgo" value={String(totalAtRisk)} />
        <StatCard accent="#dc2626" label="SLA incumplido" value={String(totalBreached)} />
        <StatCard accent="#ef4444" label="Urgentes" value={String(urgentTickets)} />
      </article>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <article className="glass-card animate-fade-up rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Tendencia de tickets (10 días)</h3>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">creados vs resueltos</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendRows} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="createdGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5a4" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#0ea5a4" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#d9e0ee" />
                <XAxis dataKey="day" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                <Area type="monotone" dataKey="created" stroke="#2563eb" fill="url(#createdGradient)" strokeWidth={2.2} />
                <Area type="monotone" dataKey="resolved" stroke="#0ea5a4" fill="url(#resolvedGradient)" strokeWidth={2.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <div className="grid gap-5">
          <DonutPanel title="Distribución por estado" data={statusRows} />
          <DonutPanel title="Distribución por prioridad" data={priorityRows} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="glass-card animate-fade-up rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Cumplimiento SLA</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slaRows} margin={{ top: 20, right: 12, left: -10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {slaRows.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="glass-card animate-fade-up rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Rendimiento medio</h3>
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Primera respuesta</p>
              <p className="mt-1 text-3xl font-bold text-cyan-700">{avgFirstResponseHours.toFixed(1)}h</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Resolución</p>
              <p className="mt-1 text-3xl font-bold text-emerald-700">{avgResolutionHours.toFixed(1)}h</p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
