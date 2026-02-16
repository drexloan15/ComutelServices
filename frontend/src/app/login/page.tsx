"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  API_BASE_URL,
  parseApiError,
  setSession,
  USE_REFRESH_COOKIE,
} from "@/lib/auth";
import { AuthResponse } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
    const payload =
      authMode === "login"
        ? { email, password }
        : { email, password, fullName };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: USE_REFRESH_COOKIE ? "include" : "same-origin",
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    const data = (await response.json()) as AuthResponse;
    setSession(data.accessToken, data.refreshToken, data.user.role);
    setSuccessMessage("Sesion iniciada.");

    if (data.user.role === "ADMIN") {
      router.push("/portal/admin");
      return;
    }

    if (data.user.role === "AGENT") {
      router.push("/portal/agent");
      return;
    }

    router.push("/portal/user");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 md:p-6">
      <section className="grid min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-3xl bg-white shadow-2xl md:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.2fr_0.8fr]">
        <article className="relative hidden bg-gradient-to-b from-slate-950 via-blue-950 to-slate-900 p-10 text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.18),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(99,102,241,0.2),transparent_40%),radial-gradient(circle_at_60%_80%,rgba(16,185,129,0.14),transparent_40%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="mb-10 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-xl font-bold text-white shadow-lg shadow-blue-500/40">
                  C
                </div>
                <p className="text-xl font-semibold tracking-[0.12em] text-slate-100">
                  COMUTEL SERVICE
                </p>
              </div>
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
                Plataforma ITSM
              </p>
              <h1 className="mt-4 max-w-xl text-6xl font-bold leading-tight text-white">
                Gestion inteligente
                <span className="block bg-gradient-to-r from-sky-400 to-emerald-300 bg-clip-text text-transparent">
                  para soporte TI.
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-xl leading-relaxed text-blue-100/90">
                Optimiza tiempos de respuesta, centraliza la operacion y manten trazabilidad segura en una sola consola.
              </p>
            </div>
            <p className="text-sm text-blue-200/70">
              (c) 2026 Comutel Peru - Politica de privacidad - Soporte TI
            </p>
          </div>
        </article>

        <article className="flex items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-md">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Comutel ITSM
            </p>
            <h2 className="mt-2 text-4xl font-bold text-slate-900">Bienvenido</h2>
            <p className="mt-2 text-slate-600">
              Ingresa tus credenciales para acceder al portal.
            </p>

            <div className="mt-6 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  authMode === "login"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600"
                }`}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  authMode === "register"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600"
                }`}
                onClick={() => setAuthMode("register")}
              >
                Registro
              </button>
            </div>

            <form className="mt-6 grid gap-3" onSubmit={onSubmit}>
              {authMode === "register" && (
                <input
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                  placeholder="Nombre completo"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              )}
              <input
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                placeholder="Correo o usuario"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <input
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                placeholder="Contrasena"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="mt-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-500/30"
                type="submit"
              >
                {authMode === "login" ? "Ingresar al Portal" : "Crear cuenta"}
              </button>
            </form>

            {error && <p className="mt-4 text-sm font-medium text-red-700">{error}</p>}
            {successMessage && (
              <p className="mt-4 text-sm font-medium text-emerald-700">{successMessage}</p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
