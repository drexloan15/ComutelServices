"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { authedFetch, clearSession, getAccessToken, getRole } from "@/lib/auth";
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
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

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
        </div>
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
        </nav>
      </header>
      {children}
    </main>
  );
}
