# Fase 0.1 - Backlog de cobertura por carpeta (Semanas 3-4)

Objetivo: subir umbrales de cobertura en modulos criticos (+2 a +5 puntos) y preparar la activacion progresiva del gate estricto.

## Umbrales objetivo Fase 0.1

- Archivo de referencia: `backend/coverage-thresholds-phase01.json`
- Comando de validacion objetivo: `npm run coverage:check:phase01 -w backend`

| Modulo | Cobertura actual (lineas) | Umbral Fase 0 | Umbral Fase 0.1 | Delta |
|---|---:|---:|---:|---:|
| core | 17.39% | 17% | 20% | +3 |
| auth | 12.09% | 12% | 15% | +3 |
| tickets | 21.55% | 21% | 24% | +3 |
| sla | 24.14% | 24% | 27% | +3 |
| notifications | 33.33% | 33% | 37% | +4 |
| config | 46.94% | 46% | 50% | +4 |
| prisma | 28.57% | 28% | 31% | +3 |
| audit | 4.41% | 4% | 5% | +1 |
| catalog | 2.72% | 2% | 3% | +1 |
| monitoring | 8.70% | 8% | 10% | +2 |

## Backlog exacto por carpeta

### `backend/src/auth/`

1. Ampliar `backend/src/auth/auth.service.spec.ts`:
   - `register` exitoso (crea user + hash + audit).
   - `logout` limpia refresh token y audita.
   - `refresh` invalido por hash incorrecto.
2. Crear `backend/src/auth/auth.controller.spec.ts`:
   - rechazo por origin no permitido en sesion web.
   - refresh con cookie habilitada/deshabilitada.

### `backend/src/tickets/`

1. Ampliar `backend/src/tickets/tickets.service.spec.ts`:
   - rama FTS `total === 0`.
   - rama FTS `ids.length === 0`.
   - parseo de `count` en formatos `number|string|bigint`.
2. Crear `backend/src/tickets/tickets.controller.spec.ts`:
   - wiring basico de endpoints con `Roles` y dto passthrough.

### `backend/src/sla/`

1. Ampliar `backend/src/sla/sla.service.spec.ts`:
   - `pauseTracking` crea actividad y audit.
   - `resumeTracking` desplaza deadlines y acumula pausa.
   - `getBreachPredictions` calcula `riskScore` y `remainingMinutes`.
2. Crear `backend/src/sla/sla.controller.spec.ts`:
   - validacion de rutas `pause/resume/predictions`.

### `backend/src/notifications/`

1. Ampliar `backend/src/notifications/notifications.service.spec.ts`:
   - `create` audita `NOTIFICATION_CREATED`.
   - `findMine` con filtros `unreadOnly/type` y paginacion.
   - `broadcast` cuando no hay recipients activos.

### `backend/src/config/`

1. Crear `backend/src/config/runtime-config.spec.ts`:
   - defaults de configuracion.
   - parseo de variables booleanas/num.
   - error por secretos invalidos o faltantes.

### `backend/src/prisma/`

1. Crear `backend/src/prisma/prisma.service.spec.ts`:
   - constructor falla sin `DATABASE_URL`.
   - `onModuleInit` llama `$connect`.
   - `onModuleDestroy` llama `$disconnect`.

### `backend/src/audit/`

1. Crear `backend/src/audit/audit.service.spec.ts`:
   - serializacion segura de filtros para export/list.

### `backend/src/catalog/`

1. Crear `backend/src/catalog/catalog.service.spec.ts`:
   - validacion de payload dinamico obligatorio.
   - validacion de `showWhen` y `validationRegex`.

### `backend/src/monitoring/`

1. Crear `backend/src/monitoring/monitoring.service.spec.ts`:
   - `normalizeRouteLabel` reemplaza uuid/numericos.
   - `getReadiness` responde `ServiceUnavailable` en fallo DB.

## Activacion recomendada

1. Ejecutar backlog por lotes (auth+tickets+sla primero).
2. Validar diariamente:
   - `npm run test:cov:ci -w backend`
   - `npm run coverage:check:phase01 -w backend`
3. Cuando el comando Fase 0.1 pase estable 5 dias seguidos, promover:
   - reemplazar `backend/coverage-thresholds.json` por valores de `coverage-thresholds-phase01.json`.
