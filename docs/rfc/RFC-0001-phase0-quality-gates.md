# RFC-0001: Quality Gates y Gobernanza de Entrega (Fase 0)

- Estado: Aprobado
- Fecha: 2026-02-18
- Autor: Equipo ComutelServices

## 1. Contexto

El sistema ya cubre dominios ITSM clave (tickets, SLA, CMDB, catalogo, knowledge), pero la gobernanza de entrega necesita gates uniformes para evitar regresion tecnica.

- Pipeline CI robusto y obligatorio.
- Validaciones multipila (lint/tests/e2e).
- Gobernanza explicita de seguridad y calidad.

## 2. Decision

Se adopta un pipeline de calidad obligatorio para `pull_request` y `push` a `main`:

1. Lint backend sin `--fix`.
2. Lint frontend.
3. Tests unitarios backend con cobertura (`json-summary`).
4. Verificacion automatica de cobertura minima por modulo backend.
5. Suite e2e backend obligatoria.
6. Build backend y frontend.

Adicionalmente:

- `Definition of Done` formal en repositorio.
- Roadmap ITSM versionado en `docs`.

## 3. Alcance tecnico de Fase 0

- Cambio de scripts backend para separar `lint` (check) de `lint:fix`.
- Nuevo script `scripts/check-backend-coverage.mjs`.
- Config de umbrales `backend/coverage-thresholds.json`.
- Endurecimiento del workflow `.github/workflows/ci.yml`.
- Correccion de deuda de formato en `backend/src/sla/sla.service.ts`.

## 4. Umbrales iniciales

Los umbrales de cobertura de Fase 0 se fijan como baseline anti-regresion.

- Global lines: 15%
- Por modulo (lineas): ver `backend/coverage-thresholds.json`

Regla de evolucion:

- Cada sprint se incrementa el minimo por modulo critico en +2 a +5 puntos hasta llegar a objetivo enterprise.

## 5. Riesgos y mitigacion

- Riesgo: umbrales demasiado altos bloquean entregas.
  - Mitigacion: baseline inicial + incremento por sprint.
- Riesgo: e2e inestable por entorno.
  - Mitigacion: entorno CI reproducible con PostgreSQL y variables fijas.
- Riesgo: confundir lint local y lint CI.
  - Mitigacion: `lint` para check, `lint:fix` solo para desarrollo local.

## 6. Criterios de aceptacion

- El workflow falla si:
  - existe error de lint,
  - falla un test unitario/e2e,
  - no se cumple cobertura global o por modulo,
  - falla build de frontend/backend.
- El repo contiene:
  - roadmap ITSM versionado,
  - Definition of Done versionada,
  - RFC tecnico versionado.

## 7. Evolucion Fase 0.1

- Se define una meta de cobertura superior en `backend/coverage-thresholds-phase01.json`.
- El backlog tecnico para cerrar la brecha se mantiene en `docs/governance/fase-0.1-coverage-backlog.md`.
- Regla de promocion: cuando `npm run coverage:check:phase01 -w backend` sea estable por 5 dias, esos umbrales pasan a ser obligatorios en CI.
