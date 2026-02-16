import { AuthResponse, Role } from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
export const USE_REFRESH_COOKIE =
  process.env.NEXT_PUBLIC_AUTH_REFRESH_COOKIE === "true";

export const ACCESS_TOKEN_KEY = "comutel_access_token";
export const REFRESH_TOKEN_KEY = "comutel_refresh_token";
export const ROLE_KEY = "comutel_role";
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

let refreshPromise: Promise<string | null> | null = null;

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function setSession(accessToken: string, refreshToken: string | null, role: Role) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  localStorage.setItem(ROLE_KEY, role);

  // Used by middleware for client-side route gating.
  setCookie(ACCESS_TOKEN_KEY, accessToken, SESSION_COOKIE_MAX_AGE_SECONDS);
  setCookie(ROLE_KEY, role, SESSION_COOKIE_MAX_AGE_SECONDS);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  clearCookie(ACCESS_TOKEN_KEY);
  clearCookie(ROLE_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? "";
}

export function getRole() {
  return (localStorage.getItem(ROLE_KEY) as Role | null) ?? null;
}

export async function parseApiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;
  const message = Array.isArray(payload?.message)
    ? payload.message.join(", ")
    : payload?.message;
  return message ?? "Error en la solicitud";
}

function buildHeaders(init: RequestInit | undefined, accessToken?: string) {
  const headers = new Headers(init?.headers);

  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

function redirectToLogin() {
  clearSession();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

async function requestWithAccessToken(
  path: string,
  accessToken: string,
  init?: RequestInit,
) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init, accessToken),
    cache: "no-store",
    credentials: USE_REFRESH_COOKIE ? "include" : init?.credentials,
  });
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!USE_REFRESH_COOKIE && !refreshToken) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    cache: "no-store",
    credentials: USE_REFRESH_COOKIE ? "include" : "same-origin",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as AuthResponse;
  setSession(data.accessToken, data.refreshToken ?? refreshToken, data.user.role);
  return data.accessToken;
}

async function getRefreshedAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function authedFetch(path: string, init?: RequestInit) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    redirectToLogin();
    return new Response(null, { status: 401, statusText: "Unauthorized" });
  }

  const initialResponse = await requestWithAccessToken(path, accessToken, init);
  if (initialResponse.status !== 401 || path === "/auth/refresh") {
    return initialResponse;
  }

  const newAccessToken = await getRefreshedAccessToken();
  if (!newAccessToken) {
    redirectToLogin();
    return initialResponse;
  }

  const retriedResponse = await requestWithAccessToken(path, newAccessToken, init);
  if (retriedResponse.status === 401) {
    redirectToLogin();
  }

  return retriedResponse;
}
