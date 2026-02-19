# Definition of Done (DoD) - ComutelServices

Version: 1.0  
Fecha: 2026-02-18

## Checklist obligatoria por historia/PR

1. Funcionalidad terminada y validada contra criterios de aceptacion.
2. Seguridad minima aplicada (validacion de input, control de acceso por rol, sin secretos hardcodeados).
3. Lint en verde:
   - `npm run lint -w backend`
   - `npm run lint -w frontend`
4. Tests en verde:
   - Unitarios: `npm run test:cov:ci -w backend`
   - E2E: `npm run test:e2e:ci -w backend`
5. Cobertura minima cumplida:
   - `npm run coverage:check -w backend`
6. Build en verde:
   - `npm run build -w backend`
   - `npm run build -w frontend`
7. Cambios documentados si afectan arquitectura, dominio o API.
8. Logs/auditoria actualizados si el flujo impacta operaciones ITSM.
9. PR con descripcion clara:
   - problema,
   - solucion,
   - riesgos,
   - evidencias de prueba.
10. Sin deuda tecnica critica abierta por el cambio.

## Reglas para merge

- Ningun PR se mergea con quality gates en rojo.
- Todo cambio en contratos API debe incluir versionado o compatibilidad explicita.
- Todo cambio de dominio ITSM debe quedar reflejado en `docs/`.

## Evidencias minimas en PR

- Captura o salida resumida de lint/tests/build.
- Nota de impacto funcional (que flujo cambia y para que rol).
- Nota de rollback (como revertir en caso de incidente).
