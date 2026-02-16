## Thunder Client (Flujo Auth + RBAC)

La coleccion nativa esta en:

- `.thunder-client/collections/tc_col_comutel_auth_rbac.json`
- `.thunder-client/environments/tc_env_comutel_local.json`

### Uso rapido

1. Abre Thunder Client en VS Code.
2. Selecciona environment `Comutel Local`.
3. Ejecuta `01 Bootstrap Admin` (si ya existe admin puede responder 409).
4. Ejecuta `02 Login Admin` y copia `accessToken` en `adminAccessToken`.
5. Ejecuta `03 List Users` y copia el `id` del requester en `requesterUserId`.
6. Ejecuta `04 Login Requester` y copia `accessToken` en `requesterAccessToken`.
7. Ejecuta los requests `05` a `11` en orden.

Nota: Thunder Client no actualiza automaticamente variables con scripts en este archivo, por eso debes pegar manualmente los tokens/ids.
