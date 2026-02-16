# ComutelServices ITSM Starter

Base profesional para empezar un Service Desk/ITSM con:

- `frontend`: Next.js 16 + TypeScript + Tailwind
- `backend`: NestJS 11 + Prisma + PostgreSQL
- Monorepo con `npm workspaces`

## Requisitos

- Node.js LTS recomendado (18/20/22)
- PostgreSQL instalado y encendido

## Configuracion inicial

1. Backend:
   - Copia `backend/.env.example` a `backend/.env`
   - Ajusta `DATABASE_URL` con tus credenciales
2. Frontend:
   - Copia `frontend/.env.local.example` a `frontend/.env.local`

## Ejecutar en desarrollo

Desde la raiz:

```bash
npm install
npm run dev
```

El comando `npm run dev` ahora usa `scripts/dev-orchestrator.mjs` para:

- leer puertos configurados desde `frontend/.env.local` (`FRONTEND_PORT`) y `backend/.env` (`BACKEND_PORT` o `PORT`)
- buscar automaticamente el siguiente puerto libre si hay choque
- inyectar `PORT` y `CORS_ORIGINS` al backend en tiempo de ejecucion

Modos utiles:

```bash
npm run dev:frontend
npm run dev:backend
node scripts/dev-orchestrator.mjs --dry-run
```

Servicios:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001/api`
- Health check: `http://localhost:3001/api/health`

## Prisma

Comandos en backend:

```bash
npm run prisma:generate -w backend
npm run prisma:migrate -w backend
npm run prisma:migrate:deploy -w backend
npm run prisma:studio -w backend
```

Schema inicial ITSM incluido:

- `User`
- `Ticket`
- `TicketStatus`
- `TicketPriority`
- `TicketComment`
- `TicketStatusHistory`
- `Asset`
- `TicketAsset`
- `SlaPolicy`
- `TicketSlaTracking`
- `Notification`

## API de tickets (Sprint 1)

- `GET /api/tickets`
- `GET /api/tickets/:id`
- `POST /api/tickets`
- `PATCH /api/tickets/:id`
- `DELETE /api/tickets/:id`
- `GET /api/tickets/:id/comments`
- `POST /api/tickets/:id/comments`
- `GET /api/tickets/:id/status-history`

`GET /api/tickets` (server-side filtros + paginacion):

- `status`: `OPEN|IN_PROGRESS|PENDING|RESOLVED|CLOSED|CANCELLED`
- `priority`: `LOW|MEDIUM|HIGH|URGENT`
- `from`: fecha ISO (`YYYY-MM-DD` o ISO8601)
- `to`: fecha ISO (`YYYY-MM-DD` o ISO8601)
- `text`: busqueda por codigo/titulo/descripcion/requester/assignee
- `searchMode`: `CONTAINS|FTS` (recomendado `FTS` para escala alta)
- `sort`: `CREATED_DESC|CREATED_ASC|PRIORITY_DESC|PRIORITY_ASC`
- `page`: entero >= 1 (default `1`)
- `pageSize`: entero `1..100` (default `20`)

Respuesta:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

Detalle y permisos (Punto 2):

- `REQUESTER` solo puede consultar/comentar sus propios tickets (`403` en acceso cruzado).
- `ADMIN` y `AGENT` pueden consultar detalle/comentarios/historial de cualquier ticket.
- `POST /api/tickets/:id/comments` usa el usuario autenticado como autor (ya no recibe `authorEmail/authorName`).
- `REQUESTER` solo puede crear `PUBLIC_NOTE` (bloqueo `403` para `INTERNAL_NOTE/WORKLOG`).

## API de autenticacion (Semanas 3-5, Punto 1)

- `POST /api/auth/register`
- `POST /api/auth/bootstrap-admin` (solo una vez, con `BOOTSTRAP_ADMIN_SECRET`)
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout` (Bearer access token)
- `GET /api/auth/me` (Bearer access token)

## Semilla inicial de usuarios/roles

Comando:

```bash
npm run prisma:seed -w backend
```

Nota: el seed esta bloqueado fuera de `NODE_ENV=development` (salvo override explicito `SEED_ALLOW_NON_DEV=true`).

Usuarios creados/actualizados (idempotente):

- `SEED_ADMIN_EMAIL` -> rol `ADMIN`
- `SEED_AGENT_EMAIL` -> rol `AGENT`
- `SEED_REQUESTER_EMAIL` -> rol `REQUESTER`

Password por defecto: `SEED_DEFAULT_PASSWORD`

## RBAC (Semanas 3-5, Punto 2)

Roles disponibles:

- `ADMIN`
- `AGENT`
- `REQUESTER`

Permisos en tickets:

- `GET /api/tickets/*`: `ADMIN`, `AGENT`, `REQUESTER`
- `POST /api/tickets`: `ADMIN`, `AGENT`, `REQUESTER`
- `PATCH /api/tickets/:id`: `ADMIN`, `AGENT`
- `DELETE /api/tickets/:id`: `ADMIN`, `AGENT`

Permisos en users:

- `GET /api/users`: `ADMIN`
- `GET /api/users/:id`: `ADMIN`
- `PATCH /api/users/:id/role`: `ADMIN`
- `PATCH /api/users/:id/status`: `ADMIN`

## Coleccion de pruebas RBAC (Postman)

Ruta:

- `docs/postman/ComutelServices-Auth-RBAC.postman_collection.json`

Flujo incluido:

1. `bootstrap-admin` (opcional)
2. `login admin`
3. `cambio de rol` de usuario
4. validaciones `403/200` en `tickets/users`

## Coleccion nativa Thunder Client

Archivos:

- `.thunder-client/collections/tc_col_comutel_auth_rbac.json`
- `.thunder-client/environments/tc_env_comutel_local.json`
- `.thunder-client/README.md`

## Auditoria minima de acciones sensibles

Endpoint (solo `ADMIN`):

- `GET /api/audit-logs`
- `GET /api/audit-logs/export`

Filtros disponibles en `GET /api/audit-logs`:

- `from` (ISO8601)
- `to` (ISO8601)
- `actor` (id o fragmento de email/nombre)
- `action` (enum `AuditAction`)
- `resource` (texto)
- `success` (`true|false`)
- `page` (default `1`)
- `pageSize` (default `50`, max `200`)
- `sort` (`asc|desc`, default `desc`)

Ejemplo:

`/api/audit-logs?from=2026-02-01T00:00:00.000Z&to=2026-02-28T23:59:59.999Z&actor=admin@comutel.local&action=USER_ROLE_CHANGED&page=1&pageSize=20&sort=desc`

Export CSV:

`/api/audit-logs/export?from=2026-02-01T00:00:00.000Z&to=2026-02-28T23:59:59.999Z&action=AUTH_LOGIN`

Acciones auditadas:

- `AUTH_BOOTSTRAP_ADMIN`
- `AUTH_REGISTER`
- `AUTH_LOGIN`
- `AUTH_REFRESH`
- `AUTH_LOGOUT`
- `USER_ROLE_CHANGED`
- `USER_STATUS_CHANGED`
- `TICKET_UPDATED`
- `TICKET_DELETED`
- `SLA_ENGINE_RUN`
- `SLA_STATUS_CHANGED`
- `NOTIFICATION_CREATED`
- `NOTIFICATION_READ`
- `NOTIFICATION_READ_ALL`

## SLA Engine + Notificaciones (Semanas 9-10)

Backend:

- Motor SLA con evaluacion de estado: `ON_TRACK`, `AT_RISK`, `BREACHED`, `MET`.
- Ejecucion manual (`ADMIN`): `POST /api/sla/engine/run`.
- Autorun configurable por entorno (`SLA_ENGINE_AUTORUN_ENABLED`, `SLA_ENGINE_INTERVAL_MS`).
- Auto-asignacion de policy activa por defecto a tickets operativos sin policy.
- Generacion de notificaciones cuando cambia estado SLA (riesgo/incumplido/cumplido).

Endpoints SLA:

- `GET /api/sla/policies` (`ADMIN`, `AGENT`)
- `POST /api/sla/policies` (`ADMIN`)
- `PATCH /api/sla/policies/:id` (`ADMIN`)
- `GET /api/sla/tracking` (`ADMIN`, `AGENT`)
- `POST /api/sla/engine/run` (`ADMIN`)

Endpoints notificaciones:

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

Frontend:

- Bandeja de notificaciones en `portal/layout` con contador unread y acciones de lectura.
- Pantalla admin de auditoria: `/portal/admin/audit` (filtros + export CSV).
- Pantalla de monitor SLA (agent/admin): `/portal/agent/sla`.

## Dominio ITSM V1

Diseno de entidades documentado en: `docs/itsm-domain-v1.md`

## Frontend Portal (Semanas 6-8)

Rutas principales:

- `/login`
- `/portal/user`
- `/portal/agent`
- `/portal/admin`
- `/portal/admin/audit`
- `/portal/agent/sla`

Implementado:

- Login y registro con JWT.
- Refresh automatico de access token en frontend ante `401`:
  - reintento automatico de request original tras `POST /api/auth/refresh` exitoso
  - si refresh falla, se limpia sesion y se redirige a `/login`
- Portal usuario (`REQUESTER`): crear ticket y ver sus tickets.
- Portal agente (`AGENT`): bandeja operativa y actualizacion de tickets.
- Portal admin (`ADMIN`): gestion de tickets + roles/estado de usuarios.
- Gating de rutas en frontend mediante `frontend/src/proxy.ts`.
- Rutas de detalle por rol:
  - `/portal/user/tickets/[ticketId]`
  - `/portal/agent/tickets/[ticketId]`
  - `/portal/admin/tickets/[ticketId]`
- Vista de detalle con datos del ticket, comentarios e historial de estado.
- Alta de comentarios por rol con manejo de respuestas `200/403/404`.
- Estado global con React Query (Punto 3):
  - `QueryClientProvider` global en `frontend/src/app/layout.tsx`
  - cache y refetch centralizados para `me`, `tickets`, `users`, `ticket detail`, `comments`, `status-history`
  - mutaciones centralizadas con invalidacion de cache (crear ticket, actualizar ticket, cambio de rol/estado, comentar)
  - eliminacion de fetch manual duplicado en portales y detalle
- Filtros de tickets en portales `AGENT` y `ADMIN` (Punto 4):
  - estado, prioridad, rango de fecha (`from/to`) y texto
  - orden configurable (fecha y prioridad)
  - paginacion server-side en `GET /api/tickets` con metadata (`total/page/pageSize/totalPages`)
  - `searchMode=FTS` automatico en frontend cuando hay texto de busqueda (agent/admin)
  - busqueda diferida en frontend con `useDeferredValue` para UX/rendimiento basico
  - integracion React Query con `queryKey` por filtros para cache/refetch consistente
- Refinamiento visual inspirado en consola operativa:
  - login en layout split (hero + formulario)
  - portal usuario con hero de ayuda, busqueda y panel lateral de creacion de ticket
  - portal agente con KPIs operativos y bandeja con filtros avanzados

Validacion automatizada del refresh frontend (Punto 1):

```bash
npm exec -w backend -- ts-node --transpile-only scripts/validate-point1-refresh.ts
```

Script usado: `backend/scripts/validate-point1-refresh.ts`.

Validacion automatizada de permisos para detalle ticket (Punto 2):

```bash
npm run test:e2e -w backend -- test/tickets-detail-rbac.e2e-spec.ts
```

Validacion frontend para estado global (Punto 3):

```bash
npm run lint -w frontend
npm run build -w frontend
```

Validacion frontend para filtros y UX de portales (Punto 4):

```bash
npm run lint -w frontend
npm run build -w frontend
```

Validacion backend para filtros y paginacion server-side:

```bash
npm run test -w backend -- tickets.service.spec.ts
```

## Escalado de busqueda (DB)

Aplicado en migraciones:

- `backend/prisma/migrations/20260216221000_ticket_search_indexes_fts/migration.sql`
- `backend/prisma/migrations/20260216225500_ticket_fts_spanish_dictionary/migration.sql`

- `pg_trgm` habilitado para acelerar `ILIKE/contains`.
- Indices B-Tree para filtros/orden:
  - `Ticket(status, priority, createdAt)`
  - `Ticket(createdAt)`
  - `Ticket(requesterId, createdAt)`
  - `Ticket(assigneeId, createdAt)`
  - `Ticket(title)`
- Indices trigram (`GIN`) para texto:
  - `Ticket.code`, `Ticket.title`, `Ticket.description`
  - `User.fullName`, `User.email`
- Indices full-text (`GIN + to_tsvector`) para modo `FTS`:
  - `Ticket`: `code + title + description`
  - `User`: `fullName + email`
- Diccionario FTS en produccion: `spanish` (stemming en espanol).
- Validacion de relevancia: `gestionar` encuentra `gestionando` en `searchMode=FTS`.

Comando aplicado:

```bash
npm exec -w backend -- prisma migrate deploy
```

Pruebas de relevancia FTS (espanol):

```bash
npm run test:e2e -w backend -- test/tickets-fts-spanish.e2e-spec.ts
```

Validacion de SLA/Notificaciones/Auditoria (Semanas 9-10):

```bash
npm run prisma:migrate:deploy -w backend
npm run prisma:generate -w backend
npm run lint -w backend
npm run build -w backend
npm run lint -w frontend
npm run build -w frontend
```

## Hardening Produccion

Aplicado en backend:

- Fail-fast de configuracion sensible:
  - en `NODE_ENV=production` el backend no arranca si faltan secretos requeridos (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `BOOTSTRAP_ADMIN_SECRET`)
  - en `production` se bloquean secretos debiles/placeholder y longitud menor a 32
- Seguridad HTTP:
  - `helmet`
  - rate limiting global (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`)
  - request id (`X-Request-Id`) en todas las respuestas
- Logging estructurado con `pino`:
  - logs JSON de inicio/fin de request con `requestId`, metodo, path, status y latencia
  - redaccion de campos sensibles (`authorization`, `cookie`, `password`, `refreshToken`)
- CORS por entorno:
  - `CORS_ORIGINS` (lista separada por comas)
  - wildcard (`*`) bloqueado
  - `CORS_CREDENTIALS=true` solo cuando aplique (por ejemplo sesion web con cookies)
- Refresh token via cookie httpOnly (opcional):
  - habilitar con `AUTH_REFRESH_COOKIE_ENABLED=true`
  - parametros: `AUTH_REFRESH_COOKIE_NAME`, `AUTH_REFRESH_COOKIE_SECURE`, `AUTH_REFRESH_COOKIE_SAME_SITE`, `AUTH_REFRESH_COOKIE_DOMAIN`, `AUTH_REFRESH_COOKIE_PATH`
  - endpoint `/api/auth/refresh` acepta token en body o cookie (si cookie mode activo)
  - frontend: activar `NEXT_PUBLIC_AUTH_REFRESH_COOKIE=true` para enviar `credentials: include` en login/refresh

Variables recomendadas en backend `.env`:

- `NODE_ENV=development|test|production`
- `CORS_ORIGINS=http://localhost:3000` (o lista)
- `JWT_ACCESS_SECRET` (>=32 chars)
- `JWT_REFRESH_SECRET` (>=32 chars)
- `BOOTSTRAP_ADMIN_SECRET` (>=32 chars)
- `RATE_LIMIT_WINDOW_MS=60000`
- `RATE_LIMIT_MAX=120`
- `LOG_LEVEL=info`

## CI Pipeline

Archivo: `.github/workflows/ci.yml`

Incluye:

- `prisma migrate deploy` (sin `migrate dev`)
- lint (`frontend` + `backend`)
- test (`backend` unit + e2e clave)
- build (`frontend` + `backend`)
- `npm audit` de dependencias productivas (`backend` + `frontend`)

## Abrir en VS Code

Abre la carpeta raiz `ComutelServices`.  
La carpeta `.vscode/extensions.json` incluye extensiones recomendadas.
