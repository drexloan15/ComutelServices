"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  getErrorMessage,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/api-client";
import { authedFetch, clearSession, getAccessToken, getRole } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";
import { Role } from "@/lib/types";

type PortalLayoutProps = {
  children: ReactNode;
};

function roleHome(role: Role | null) {
  if (role === "ADMIN") return "/portal/admin";
  if (role === "AGENT") return "/portal/agent";
  return "/portal/user";
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications({ page: 1, pageSize: 8, unreadOnly: false }),
    queryFn: () => fetchNotifications({ page: 1, pageSize: 8, unreadOnly: false }),
    enabled: ready,
    refetchInterval: 20000,
  });

  const markNotificationMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setFeedback("Notificaciones marcadas como leidas.");
    },
  });

  useEffect(() => {
    const token = getAccessToken();
    const storedRole = getRole();
    if (!token || !storedRole) {
      clearSession();
      router.replace("/login");
      return;
    }

    if (storedRole === "REQUESTER" && pathname.startsWith("/portal/agent")) {
      router.replace("/portal/user");
      return;
    }

    if (storedRole !== "ADMIN" && pathname.startsWith("/portal/admin")) {
      router.replace(roleHome(storedRole));
      return;
    }

    const timeoutId = setTimeout(() => {
      setRole(storedRole);
      setReady(true);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [pathname, router]);

  async function onLogout() {
    try {
      await authedFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    clearSession();
    router.push("/login");
  }

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const notifications = notificationsQuery.data?.data ?? [];

  async function onMarkAsRead(notificationId: string) {
    try {
      await markNotificationMutation.mutateAsync(notificationId);
    } catch (error) {
      setFeedback(getErrorMessage(error, "No se pudo marcar la notificacion."));
    }
  }

  async function onMarkAllRead() {
    try {
      await markAllMutation.mutateAsync();
    } catch (error) {
      setFeedback(getErrorMessage(error, "No se pudo marcar todo como leido."));
    }
  }

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
        <p className="text-slate-700">Cargando portal...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-5 py-8 md:px-6 md:py-10">
      <header className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Comutel ITSM Services
            </p>
            <h1 className="text-2xl font-bold text-white">Portal Operativo</h1>
          </div>
          <button
            className="rounded-lg border border-slate-500/60 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur"
            onClick={onLogout}
          >
            Cerrar sesion
          </button>
          <div className="relative">
            <button
              className="rounded-lg border border-slate-500/60 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur"
              onClick={() => setShowNotifications((prev) => !prev)}
            >
              Notificaciones ({unreadCount})
            </button>
            {showNotifications && (
              <div className="absolute right-0 z-20 mt-2 w-[22rem] rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Bandeja</p>
                  <button
                    className="text-xs font-semibold text-blue-700"
                    onClick={onMarkAllRead}
                  >
                    Marcar todo
                  </button>
                </div>
                {notifications.length === 0 && (
                  <p className="text-xs text-slate-600">Sin notificaciones recientes.</p>
                )}
                {notifications.length > 0 && (
                  <div className="max-h-72 space-y-2 overflow-auto">
                    {notifications.map((notification) => (
                      <article
                        key={notification.id}
                        className={`rounded-md border p-2 ${
                          notification.isRead ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-blue-50"
                        }`}
                      >
                        <p className="text-xs font-semibold">{notification.title}</p>
                        <p className="text-xs text-slate-700">{notification.body}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <p className="text-[11px] text-slate-500">
                            {new Date(notification.createdAt).toLocaleString("es-PE")}
                          </p>
                          {!notification.isRead && (
                            <button
                              className="text-[11px] font-semibold text-blue-700"
                              onClick={() => onMarkAsRead(notification.id)}
                            >
                              Marcar leida
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {feedback && <p className="mt-2 text-xs text-emerald-200">{feedback}</p>}
        <nav className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/portal/user"
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              pathname === "/portal/user"
                ? "bg-white text-slate-900"
                : "bg-white/10 text-slate-100"
            }`}
          >
            Portal Usuario
          </Link>
          {(role === "AGENT" || role === "ADMIN") && (
            <Link
              href="/portal/agent"
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                pathname === "/portal/agent"
                  ? "bg-white text-slate-900"
                  : "bg-white/10 text-slate-100"
              }`}
            >
              Portal Agente
            </Link>
          )}
          {role === "ADMIN" && (
            <Link
              href="/portal/admin"
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                pathname === "/portal/admin"
                  ? "bg-white text-slate-900"
                  : "bg-white/10 text-slate-100"
              }`}
            >
              Portal Admin
            </Link>
          )}
          {role === "ADMIN" && (
            <Link
              href="/portal/admin/audit"
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                pathname === "/portal/admin/audit"
                  ? "bg-white text-slate-900"
                  : "bg-white/10 text-slate-100"
              }`}
            >
              Auditoria
            </Link>
          )}
          {(role === "ADMIN" || role === "AGENT") && (
            <Link
              href="/portal/agent/sla"
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                pathname === "/portal/agent/sla"
                  ? "bg-white text-slate-900"
                  : "bg-white/10 text-slate-100"
              }`}
            >
              SLA Monitor
            </Link>
          )}
        </nav>
      </header>
      {children}
    </main>
  );
}
