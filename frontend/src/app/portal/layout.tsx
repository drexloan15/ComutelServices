"use client";

import {
  Bell,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  House,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  TimerReset,
  TriangleAlert,
  UserCircle2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
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

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const SIDEBAR_STORAGE_KEY = "comutel_portal_sidebar_collapsed";

function roleHome(role: Role | null) {
  if (role === "ADMIN") return "/portal/admin";
  if (role === "AGENT") return "/portal/agent";
  return "/portal/user";
}

function getNavItems(role: Role | null): NavItem[] {
  if (role === "ADMIN") {
    return [
      { href: "/portal/admin", label: "Panel inicial", icon: House },
      { href: "/portal/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/portal/admin/incidents", label: "Incidencias", icon: TriangleAlert },
      { href: "/portal/admin/knowledge", label: "Knowledge", icon: BookOpenText },
      { href: "/portal/admin/audit", label: "Auditoria", icon: ShieldCheck },
      { href: "/portal/agent/sla", label: "SLA", icon: TimerReset },
    ];
  }

  if (role === "AGENT") {
    return [
      { href: "/portal/agent", label: "Panel inicial", icon: House },
      { href: "/portal/agent/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/portal/agent/incidents", label: "Incidencias", icon: TriangleAlert },
      { href: "/portal/agent/knowledge", label: "Knowledge", icon: BookOpenText },
      { href: "/portal/agent/sla", label: "SLA", icon: TimerReset },
    ];
  }

  return [
    { href: "/portal/user", label: "Panel inicial", icon: House },
    { href: "/portal/user/knowledge", label: "Knowledge", icon: BookOpenText },
  ];
}

function getPageLabel(pathname: string) {
  if (pathname.includes("/dashboard")) return "Dashboard";
  if (pathname.includes("/incidents")) return "Incidencias";
  if (pathname.includes("/knowledge")) return "Knowledge";
  if (pathname.includes("/audit")) return "Auditoria";
  if (pathname.includes("/sla")) return "SLA";
  if (pathname.includes("/tickets/")) return "Detalle ticket";
  return "Panel inicial";
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });
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

  const navItems = useMemo(() => getNavItems(role), [role]);
  const pageLabel = getPageLabel(pathname);

  function toggleSidebar() {
    const nextValue = !sidebarCollapsed;
    setSidebarCollapsed(nextValue);
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextValue));
  }

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
        <p className="text-slate-700">Cargando portal...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#deebff_0%,#f5f8ff_35%,#f8fafc_70%)]">
      <div
        className="grid min-h-screen transition-all duration-300"
        style={{ gridTemplateColumns: sidebarCollapsed ? "88px 1fr" : "280px 1fr" }}
      >
        <aside className="animate-fade-right flex flex-col border-r border-slate-900/60 bg-gradient-to-b from-slate-950 via-[#071532] to-[#0a1f4c] p-3 text-slate-100 transition-all duration-300">
          <div className="glass-card rounded-xl border border-cyan-200/20 p-3 text-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="animate-pulse-soft rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 p-2 text-white">
                  <LayoutDashboard className="h-4 w-4" />
                </div>
                {!sidebarCollapsed && (
                  <div className="animate-fade-up">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                      Comutel Services
                    </p>
                    <h1 className="text-sm font-bold text-slate-900">Operations Console</h1>
                  </div>
                )}
              </div>
              <button
                aria-label={sidebarCollapsed ? "Expandir sidebar" : "Contraer sidebar"}
                className="rounded-md border border-slate-300 bg-white p-1 text-slate-700 transition hover:bg-slate-50"
                onClick={toggleSidebar}
                type="button"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <nav className="mt-4 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`group flex items-center rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-900/40"
                      : "text-slate-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${
                      active ? "border-white/30 bg-white/15" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                      sidebarCollapsed ? "max-w-0 opacity-0" : "ml-3 max-w-44 opacity-100"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-white/15 bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200">
                <UserCircle2 className="h-4 w-4" />
              </span>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-widest text-slate-300">Sesion</p>
                  <p className="truncate text-sm font-semibold text-white">{role ?? "N/A"}</p>
                </div>
              )}
            </div>
            <button
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              onClick={onLogout}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              {!sidebarCollapsed && "Cerrar sesion"}
            </button>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 px-5 py-4 backdrop-blur md:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Portal operativo</p>
                <h2 className="text-xl font-bold text-slate-900">{pageLabel}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  aria-label={sidebarCollapsed ? "Expandir sidebar" : "Contraer sidebar"}
                  className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-50"
                  onClick={toggleSidebar}
                  type="button"
                >
                  {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
                <div className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 md:block">
                  {new Date().toLocaleString("es-PE")}
                </div>
                <div className="relative">
                  <button
                    className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={() => setShowNotifications((prev) => !prev)}
                    type="button"
                  >
                    <Bell className="h-4 w-4" />
                    Notificaciones ({unreadCount})
                  </button>
                  {showNotifications && (
                    <div className="animate-fade-up absolute right-0 z-30 mt-2 w-[22rem] rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold">Bandeja</p>
                        <button
                          className="text-xs font-semibold text-blue-700"
                          onClick={onMarkAllRead}
                          type="button"
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
                                notification.isRead
                                  ? "border-slate-200 bg-slate-50"
                                  : "border-blue-200 bg-blue-50"
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
                                    type="button"
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
            </div>
            {feedback && <p className="mt-2 text-xs text-emerald-600">{feedback}</p>}
          </header>

          <div className="animate-fade-up flex-1 px-5 py-6 md:px-7">{children}</div>
        </section>
      </div>
    </main>
  );
}
