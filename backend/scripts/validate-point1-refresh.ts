process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001/api";

type StorageRecord = Record<string, string>;

type Role = "ADMIN" | "AGENT" | "REQUESTER";

class MemoryLocalStorage {
  private readonly store: StorageRecord = {};

  getItem(key: string) {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string) {
    this.store[key] = value;
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const localStorageMock = new MemoryLocalStorage();
  let cookieJar = "";
  const locationState = {
    pathname: "/portal/user",
    redirectedTo: "",
  };
  const globalAny = globalThis as any;

  globalAny.localStorage = localStorageMock;
  globalAny.document = {
    get cookie() {
      return cookieJar;
    },
    set cookie(value: string) {
      cookieJar = value;
    },
  };
  globalAny.window = {
    location: {
      pathname: locationState.pathname,
      assign: (url: string) => {
        locationState.redirectedTo = url;
        locationState.pathname = url;
      },
    },
  };

  const auth = require("../../frontend/src/lib/auth.ts") as typeof import("../../frontend/src/lib/auth");

  const initialAuthResponse = {
    accessToken: "access.initial",
    refreshToken: "refresh.initial",
    user: { role: "REQUESTER" as Role },
  };

  let meCallCount = 0;
  let refreshCallCount = 0;

  const fetchMock: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;

    if (url.endsWith("/auth/refresh")) {
      refreshCallCount += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as { refreshToken?: string };

      if (body.refreshToken === "refresh.initial") {
        return new Response(
          JSON.stringify({
            accessToken: "access.renewed",
            refreshToken: "refresh.renewed",
            user: { role: "REQUESTER" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ message: "Refresh token invalido" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.endsWith("/auth/me")) {
      meCallCount += 1;
      const headers = new Headers(init?.headers);
      const authHeader = headers.get("Authorization") ?? "";

      if (authHeader === "Bearer expired.invalid.token") {
        return new Response(null, { status: 401 });
      }

      if (authHeader === "Bearer access.renewed") {
        return new Response(
          JSON.stringify({ id: "u1", email: "user@example.com", role: "REQUESTER" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(null, { status: 401 });
    }

    return new Response(null, { status: 404 });
  };

  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock;

  auth.setSession(
    initialAuthResponse.accessToken,
    initialAuthResponse.refreshToken,
    initialAuthResponse.user.role,
  );

  localStorageMock.setItem(auth.ACCESS_TOKEN_KEY, "expired.invalid.token");
  cookieJar = `${auth.ACCESS_TOKEN_KEY}=expired.invalid.token`;

  const recoveredResponse = await auth.authedFetch("/auth/me");
  assert(recoveredResponse.ok, "No recupero sesion despues de 401 + refresh");
  assert(refreshCallCount === 1, "Debio ejecutar refresh una vez");
  assert(meCallCount === 2, "Debio reintentar la request original a /auth/me");
  assert(localStorageMock.getItem(auth.ACCESS_TOKEN_KEY) === "access.renewed", "No guardo access token renovado");
  assert(localStorageMock.getItem(auth.REFRESH_TOKEN_KEY) === "refresh.renewed", "No guardo refresh token renovado");

  localStorageMock.setItem(auth.ACCESS_TOKEN_KEY, "expired.invalid.token");
  localStorageMock.setItem(auth.REFRESH_TOKEN_KEY, "refresh.invalid");
  locationState.pathname = "/portal/user";
  locationState.redirectedTo = "";

  const failedRefreshResponse = await auth.authedFetch("/auth/me");
  assert(failedRefreshResponse.status === 401, "Al fallar refresh, la request debe quedar en 401");
  assert(localStorageMock.getItem(auth.ACCESS_TOKEN_KEY) === null, "No limpio access token al fallar refresh");
  assert(localStorageMock.getItem(auth.REFRESH_TOKEN_KEY) === null, "No limpio refresh token al fallar refresh");
  assert(locationState.redirectedTo === "/login", "No redirigio a /login al fallar refresh");

  console.log(
    JSON.stringify({
      status: "ok",
      refreshSuccessPath: true,
      originalRequestRetried: true,
      failedRefreshLogsOut: true,
    }),
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
