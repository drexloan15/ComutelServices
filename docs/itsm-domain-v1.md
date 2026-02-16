# ITSM Domain V1 (Semanas 1-2)

Este documento define el dominio base del sistema ITSM.

## Entidades centrales

- `User`: usuarios del sistema con rol (`ADMIN`, `AGENT`, `REQUESTER`).
- `Ticket`: entidad principal operativa (incidente/solicitud/cambio, etc.).
- `TicketComment`: comentarios y bitacora del ticket.
- `TicketStatusHistory`: auditoria de estados del ticket.
- `Asset`: activos de TI (hardware/software/servicio/red).
- `TicketAsset`: relacion N:N entre ticket y activo.
- `SlaPolicy`: politicas SLA de respuesta y resolucion.
- `TicketSlaTracking`: seguimiento SLA por ticket.

## Decisiones de modelado

- `Ticket` incluye `type`, `impact`, `urgency`, `priority`, `status`.
- Estado y auditoria no se guardan solo como campo actual:
  - estado actual: `Ticket.status`
  - historial: `TicketStatusHistory`
- Comentarios separados para soportar:
  - nota publica
  - nota interna
  - worklog
- Activos con tabla pivote (`TicketAsset`) para soportar multiples activos por ticket.
- SLA desacoplado en politica (`SlaPolicy`) + seguimiento por ticket (`TicketSlaTracking`).

## Flujo minimo cubierto en API

- Crear ticket -> crea entrada inicial en `TicketStatusHistory`.
- Actualizar estado -> agrega nueva entrada en `TicketStatusHistory`.
- Agregar comentario -> almacena autor y tipo de comentario.

## Proximo objetivo (Semanas 3-4)

- Modulo `users` (RBAC real con autenticacion).
- Modulo `assets` (CRUD + relacion con tickets).
- Motor SLA (calculo de deadlines y alertas).
