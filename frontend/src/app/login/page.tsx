"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
    const payload =
      authMode === "login"
        ? { email, password }
        : { email, password, fullName };

    try {
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
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f7fc]">
      <section className="grid min-h-screen xl:grid-cols-[2fr_1fr]">
        <article className="relative hidden overflow-hidden bg-[#051536] text-white xl:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(56,189,248,0.2),transparent_33%),radial-gradient(circle_at_75%_20%,rgba(96,165,250,0.15),transparent_38%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#051536_0%,#0a2b74_55%,#0a2b74_100%)] opacity-95" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.06),transparent_55%)]" />

          <div className="absolute -bottom-[45%] left-[-18%] h-[90%] w-[140%] rounded-[50%] bg-[radial-gradient(circle,rgba(120,170,255,0.3)_0%,rgba(45,92,185,0.3)_30%,rgba(12,35,90,0.85)_65%,rgba(5,21,54,0)_100%)] blur-[2px]" />
          <div className="absolute left-0 right-0 bottom-0 h-[45%] bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(2,12,33,0.6)_60%,rgba(2,12,33,0.8)_100%)]" />

          <div className="relative z-10 flex h-full flex-col justify-between px-14 py-16">
            <div className="max-w-3xl">
              <div className="mb-10 flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-xl font-bold text-white shadow-lg shadow-blue-500/30">
                  C
                </div>
                <p className="text-2xl font-semibold tracking-[0.08em] text-slate-100">COMUTEL SERVICE</p>
              </div>

              <p className="text-sm uppercase tracking-[0.26em] text-cyan-300">PLATAFORMA ITSM</p>
              <h1 className="mt-5 max-w-2xl text-6xl font-bold leading-[1.05] tracking-tight text-white">
                Gestión inteligente
                <span className="mt-2 block bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                  para soporte TI.
                </span>
              </h1>
              <p className="mt-7 max-w-l text-xl leading-relaxed text-blue-100/90">
                Optimiza tiempos de respuesta, gestiona el inventario y centraliza el conocimiento en una sola plataforma segura.
              </p>
            </div>

            <div className="relative z-10 flex gap-6 text-sm text-blue-200/60 font-medium">
          <span>&copy; 2026 Comutel Perú</span>
          <span>•</span>
          <span>Política de Privacidad</span>
          <span>•</span>
          <span>Soporte</span>
          <span>•</span>
          <span>Versión  1.0.0</span>
        </div>
          </div>
        </article>

        <article className="relative flex items-center justify-center bg-[#f6f8fc] px-6 py-10 sm:px-10 xl:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(59,130,246,0.08),transparent_35%),radial-gradient(circle_at_15%_90%,rgba(14,165,233,0.08),transparent_35%)]" />

          <div className="relative z-10 w-full max-w-[430px]">
            <div className="mb-8 xl:hidden">
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-lg font-bold text-white">
                  C
                </div>
                <p className="text-xl font-semibold tracking-[0.08em] text-slate-900">COMUTEL SERVICE</p>
              </div>
            </div>

            <p className="text-base font-semibold uppercase tracking-[0.22em] text-blue-700">COMUTEL ITSM</p>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Bienvenido</h2>
            <p className="mt-2 text-l text-slate-600">Ingresa tus credenciales para acceder a la plataforma.</p>

            <form className="mt-8 grid gap-4" onSubmit={onSubmit}>
              {authMode === "register" && (
                <label className="group flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.16)]">
                  <User className="h-4 w-4 text-slate-400 group-focus-within:text-blue-600" />
                  <input
                    className="w-full bg-transparent text-lg text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Nombre completo"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                  />
                </label>
              )}

              <label className="group flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.16)]">
                <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-blue-600" />
                <input
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="Correo o usuario"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <label className="group flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.16)]">
                <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-blue-600" />
                <input
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="Contraseña"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="text-slate-400 transition hover:text-slate-600"
                  onClick={() => setShowPassword((prev) => !prev)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </label>

              {authMode === "login" && (
                <div className="mt-1 flex items-center justify-between text-base">
                  <label className="inline-flex items-center gap-2 text-slate-600">
                    <input
                      checked={rememberSession}
                      className="h-4 w-4 rounded border-slate-300"
                      onChange={(event) => setRememberSession(event.target.checked)}
                      type="checkbox"
                    />
                    Mantener sesión
                  </label>
                  <button className="font-semibold text-blue-700" type="button">
                    ¿Olvidaste tu clave?
                  </button>
                </div>
              )}

              <button
                className="mt-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-lg font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:translate-y-[-1px] hover:shadow-blue-500/45 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? "Procesando..."
                  : authMode === "login"
                    ? "Ingresar al Portal"
                    : "Crear cuenta"}
              </button>
            </form>

            {error && <p className="mt-4 text-base font-medium text-red-700">{error}</p>}
            {successMessage && <p className="mt-4 text-base font-medium text-emerald-700">{successMessage}</p>}

            <div className="mt-7 border-t border-slate-200 pt-5 text-center">
              <p className="text-base text-slate-500">
                {authMode === "login" ? "¿No tienes acceso?" : "¿Ya tienes una cuenta?"}{" "}
                <button
                  className="font-semibold text-blue-700"
                  onClick={() => setAuthMode((prev) => (prev === "login" ? "register" : "login"))}
                  type="button"
                >
                  {authMode === "login" ? "Crear cuenta" : "Iniciar sesión"}
                </button>
              </p>
              <p className="mt-4 text-sm text-slate-400">¿Problemas de acceso? Contacta a soporte TI</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
