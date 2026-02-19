# ITSM Roadmap 2026

Este roadmap define la evolucion de `ComutelServices` para consolidar procesos ITSM sobre arquitectura propia (`NestJS + Next.js`).

## Objetivos de producto

- Consolidar `Incident/Request` con operacion diaria medible.
- Implementar `Problem Management` y `Change Enablement` como dominios dedicados.
- Escalar `CMDB + SLM/SLA` para impacto y cumplimiento empresarial.
- Habilitar extensibilidad controlada (plugins/hooks) sin romper el core.

## Fases

### Fase 0 (Semanas 1-2) - Base tecnica y gobernanza

- Roadmap y RFC tecnico aprobados.
- Quality gates obligatorios en PR: lint, test unitario, e2e, cobertura minima.
- Definition of Done estandar del equipo.

### Fase 1 (Semanas 3-6) - Operacion de Tickets

- Endurecer transiciones de estado por tipo de ticket.
- Estandarizar macros/plantillas operativas por rol.
- KPIs operativos: backlog, aging, MTTA, MTTR, reopen rate.

### Fase 2 (Semanas 7-10) - Problem Management

- Modulo `Problem` dedicado (RCA, Known Error, workaround).
- Relacion Problema <-> Incidentes.
- Dashboard de recurrencia y eliminacion de causa raiz.

### Fase 3 (Semanas 11-14) - Change Enablement

- Modulo `Change` dedicado (RFC, riesgo, aprobacion CAB, rollback, PIR).
- Calendario de cambios e impacto sobre servicios/CI.
- Metricas de cambio exitoso y rollback.

### Fase 4 (Semanas 15-18) - CMDB avanzada

- Clases de CI y ciclo de vida.
- Grafo de dependencias e impacto multi-salto.
- Importacion y reconciliacion de inventario.

### Fase 5 (Semanas 19-22) - SLM/SLA enterprise

- OLA/UC ademas de SLA.
- Escalamiento multinivel por criticidad y horario.
- Reportes ejecutivos de cumplimiento por servicio.

### Fase 6 (Semanas 23-24) - Extensibilidad

- Contrato de plugin/hook versionado.
- Eventos internos y webhooks externos.
- 2 integraciones de referencia (notificaciones y sincronizacion CMDB).

## KPIs globales

- Reduccion de MTTR >= 20%.
- Reduccion de breaches SLA >= 30%.
- Cambio exitoso >= 90%.
- Cobertura backend en modulos criticos con crecimiento sprint a sprint.
