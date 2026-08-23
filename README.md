# WIP — Wallet Integration Piggy

**La alcancía compartida del grupo, con un guardián que no se puede sobornar.**

WIP no es un work in progress: es la alcancía que sí cierra bien.

Un agente con billetera propia y un reglamento explícito que el grupo define por
adelantado. Un miembro pide un pago en lenguaje natural, el agente lo valida
contra ese reglamento —topes, lista blanca, presupuesto mensual, aprobaciones de
varias personas— y solo entonces ejecuta una transferencia real de USD₮. Cada
pago y **cada rechazo** quedan en un registro auditable que cualquier miembro
puede leer.

La idea central: **le das una billetera a un agente, pero con un contrato social
que no puede romper.**

---

## La integración con WDK

Todo el trabajo con la billetera vive en un solo archivo, y es corto a
propósito: [**`lib/wdk.ts`**](https://github.com/ALFA117/wip-wallet-integration-piggy/blob/1167dace78d70beba6b45cbeabb2b0c92870a323/lib/wdk.ts)

**Las cuatro funciones, con permalinks a las líneas exactas:**

| Función | Qué hace |
|---|---|
| [`getTreasuryAddress()`](https://github.com/ALFA117/wip-wallet-integration-piggy/blob/1167dace78d70beba6b45cbeabb2b0c92870a323/lib/wdk.ts#L219-L235) | Dirección de la billetera del agente |
| [`getUsdtBalance()`](https://github.com/ALFA117/wip-wallet-integration-piggy/blob/1167dace78d70beba6b45cbeabb2b0c92870a323/lib/wdk.ts#L237-L248) | Balance real leído del CLI, **nunca de la base** |
| [`sendUsdt(to, amount)`](https://github.com/ALFA117/wip-wallet-integration-piggy/blob/1167dace78d70beba6b45cbeabb2b0c92870a323/lib/wdk.ts#L250-L285) | Transferencia real; devuelve el hash de Sepolia |
| [`getHistory(limit)`](https://github.com/ALFA117/wip-wallet-integration-piggy/blob/1167dace78d70beba6b45cbeabb2b0c92870a323/lib/wdk.ts#L287-L320) | Historial leído del CLI |

**Las piezas de soporte:**

| | |
|---|---|
| [`CLI_COMMANDS`](https://github.com/ALFA117/wip-wallet-integration-piggy/blob/1167dace78d70beba6b45cbeabb2b0c92870a323/lib/wdk.ts#L106-L140) | La forma exacta de cada comando, en un solo objeto — verificada contra `--help`, no contra la memoria |
| [`resolveBin()`](https://github.com/ALFA117/wip-wallet-integration-piggy/blob/1167dace78d70beba6b45cbeabb2b0c92870a323/lib/wdk.ts#L34-L61) | Ejecuta el `.mjs` del paquete con Node, evitando los shims `.cmd` sin recurrir a `shell: true` |
| [`runCli()`](https://github.com/ALFA117/wip-wallet-integration-piggy/blob/1167dace78d70beba6b45cbeabb2b0c92870a323/lib/wdk.ts#L148-L188) | Lanza el proceso, parsea `--json`, propaga el stderr real |
| [`WdkError`](https://github.com/ALFA117/wip-wallet-integration-piggy/blob/1167dace78d70beba6b45cbeabb2b0c92870a323/lib/wdk.ts#L70-L78) | Lleva el stderr del CLI hasta la interfaz sin perderlo |

**Paquetes de WDK instalados**

| Paquete | Versión exacta |
|---|---|
| `@tetherto/wdk-cli` | `1.0.0-beta.3` |

Un solo lugar en todo el código invoca al CLI. No hay una capa de abstracción
encima: las bases penalizan el sobre-diseño, y el jurado tiene que poder leer la
integración de un tirón.

**La forma de los comandos salió de `--help`, no de suposiciones.** La primera
versión de este archivo daba por hecho `wallet balance` y `--name`; el CLI real
usa `get balance` y `--wallet`. Por eso los comandos viven aislados en un solo
objeto: corregir el contrato del CLI no toca ni una línea de lógica.

**El wrapper nunca ve la passphrase.** El CLI trabaja con sesiones: `wdk wallet
unlock --ttl 0` la pide por consola y la guarda en un daemon. No va por
argumento (quedaría visible en la lista de procesos) ni por variable de entorno.

---

## Modelo de seguridad

Esta es la sección que importa. El track paga por *a thoughtful safety model*.

### El parser nunca decide

```
texto libre ──► parseIntent() ──► { amount, toEmail, reason }
                                          │
                                          ▼
                                    evaluate()   ← determinista, sin IA
                                          │
                ┌─────────────────────────┼─────────────────────────┐
                ▼                         ▼                         ▼
              AUTO                    MULTI_SIG                 REJECTED
         (ejecuta ya)          (espera N aprobaciones)      (nunca ejecuta)
```

[`lib/parse.ts`](lib/parse.ts) solo traduce texto a una intención estructurada,
con regex y heurísticas. No puede alucinar un monto. Si el texto es ambiguo
—dos cifras, dos correos, ningún beneficiario— **devuelve un error pidiendo
reformular en vez de adivinar**. Un agente que pregunta vale más que uno que
inventa una cifra, y eso también es parte del modelo de seguridad.

La decisión la toma [`lib/rules.ts`](lib/rules.ts): una función pura sobre
`(request, rules, state)`, sin red ni base de datos, testeada. Es lo que separa
este proyecto de un juguete que le da las llaves a un modelo de lenguaje.

### Los 9 chequeos

Corren en este orden exacto. El primero que falla corta la evaluación, y el
`decisionLog` termina justo ahí — que es lo que la interfaz muestra en rojo.

| # | Chequeo | Qué verifica |
|---|---|---|
| 1 | `beneficiary_resolvable` | El correo existe y tiene dirección registrada |
| 2 | `beneficiary_in_allowlist` | Está en la lista blanca del reglamento |
| 3 | `not_self_payment` | Quien pide no es quien recibe |
| 4 | `amount_valid` | Número positivo, finito, máximo 2 decimales |
| 5 | `max_single_tx` | No supera el tope duro por transacción |
| 6 | `daily_limit` | Lo ejecutado hoy más este monto |
| 7 | `monthly_budget` | Lo ejecutado este mes más este monto |
| 8 | `onchain_balance` | El balance **real leído del CLI** alcanza |
| 9 | `approval_tier` | Decide la vía: automático, varias firmas o administrador |

### Invariantes que el código garantiza

- Un `Payment` solo pasa a `EXECUTING` desde `APPROVED`. Nunca desde
  `PENDING_APPROVAL` directo.
- **Quien pide un pago no puede aprobarlo.** Se comprueba en la API, no solo
  escondiendo el botón: una llamada directa a `/api/payments/[id]/approve`
  responde `403`.
- Una persona vota una sola vez — lo fuerza un `@@unique` en la base.
- Un solo veto manda el pago a `REJECTED` de inmediato.
- Los cálculos de presupuesto cuentan solo pagos en `SUCCESS` y `EXECUTING`.
  Los rechazados nunca consumen presupuesto.
- **Antes de ejecutar se re-evalúan los chequeos 5 a 8.** Entre que se pidió el
  pago y que se aprobó, el balance pudo cambiar.
- `status = 'EXECUTING'` se persiste **antes** de llamar a la cadena: si el
  proceso muere a mitad, queda rastro.
- **Nunca se reintenta automáticamente una transferencia fallida.** Un pago que
  se manda dos veces por un retry es mucho peor que uno que falla y avisa.

### Los tests

[`lib/rules.test.ts`](lib/rules.test.ts) — 15 casos, sin dependencias externas
(`node:test`).

```bash
npm test
```

Los cinco de aceptación: `$50` → automático · `$400` → dos firmas · `$3,000` →
rechazado por tope · beneficiario fuera de la lista → rechazado · quien pide
intenta aprobar → bloqueado.

---

## Qué es real y qué es mock

**Real, no se simula:**

- La billetera creada con `@tetherto/wdk-cli`, con dirección real en Sepolia.
- Las transferencias de USD₮: se firman, se mandan a la red, producen un
  `txHash` verificable en `sepolia.etherscan.io`.
- Las lecturas de balance e historial: salen del CLI, nunca de la base.
- El motor de reglas: aprueba y rechaza de verdad, y bloquea transferencias
  reales.
- La persistencia: usuarios, reglas, pagos y aprobaciones.

**Mock, solo para poder grabar la demo:**

- Autenticación: un selector de usuario en la barra superior. Sin login.
- Los miembros del grupo son filas sembradas por `prisma/seed.ts`.

---

## Red y token

> ### ⚠️ El token de la demo es un mock, y hay que decirlo claro
>
> Las transferencias que se ven en el video mueven un **ERC-20 propio**, no el
> USD₮ de Tether:
>
> **`0xf95bee261a5f25634979be54173c1283d662c060`** · 6 decimales · Sepolia
> · [ver en Etherscan](https://sepolia.etherscan.io/address/0xf95bee261a5f25634979be54173c1283d662c060)
>
> Las transacciones son reales y verificables. El token no es el de Tether.

**Por qué.** El USD₮ de testnet en Sepolia existe y `@tetherto/wdk-cli` lo trae
registrado de fábrica en `0xd077A400968890Eacc75cdc901F0356c943e4fDb`
([verificable](https://sepolia.etherscan.io/token/0xd077A400968890Eacc75cdc901F0356c943e4fDb):
Tether USD, 6 decimales, 200M de supply, 1 670 holders):

```bash
npx wdk token info --network sepolia --token usdt --json
```

Lo que no encontramos fue **cómo obtenerlo**. Los faucets que las bases mencionan
—Pimlico y Candide— no están accesibles públicamente, y la doc del CLI no cubre
el fondeo. Sin fondos no hay demo, así que se tomó el plan B que el propio brief
contempla: desplegar un ERC-20 con los mismos 6 decimales y **documentarlo de
forma prominente** en vez de hacer pasar por USD₮ el token de otro emisor.

| | |
|---|---|
| Red | **Sepolia** testnet |
| Token de la demo | [`0xf95bee26…c060`](https://sepolia.etherscan.io/address/0xf95bee261a5f25634979be54173c1283d662c060) — mock, 6 decimales |
| USD₮ real de Sepolia | [`0xd077A400…4fDb`](https://sepolia.etherscan.io/token/0xd077A400968890Eacc75cdc901F0356c943e4fDb) — soportado, sin fondear |
| Contrato del mock | [`contracts/TestUSDT.sol`](contracts/TestUSDT.sol) |

**Cambiar de uno a otro es una variable de entorno**, no una refactorización: el
código referencia el token por su nombre en el registro del CLI, nunca por una
dirección pegada a mano. Con fondos de USD₮ real basta con `WDK_TOKEN="usdt"`.

```bash
npx wdk token add contracts/token-spec.json   # registra el mock como `testusdt`
```

---

## Cómo correrlo

```bash
git clone https://github.com/ALFA117/wip-wallet-integration-piggy.git
cd wip-wallet-integration-piggy
npm install
cp .env.example .env     # y rellena las variables
npm run db:push
npm run seed
npm run dev
```

Node 22.18.0 o superior (lo exige `@tetherto/wdk-cli`; está fijado en `.nvmrc`).

### Por qué esto no está desplegado en ninguna nube

No es una tarea pendiente: es una consecuencia del diseño. El backend invoca el
binario de `@tetherto/wdk-cli` como proceso hijo, y ese binario no existe en un
entorno serverless. Una versión desplegada en Vercel levantaría, mostraría el
dashboard, y **fallaría exactamente en lo único que importa**: firmar y mandar
la transferencia.

Podría evitarse metiendo la seed de la billetera en un servicio remoto, pero eso
cambia el modelo de custodia por conveniencia de demo — justo al revés de lo que
este proyecto defiende. La billetera vive donde vive el reglamento.

### Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Las dos que
bloquean todo lo demás:

- `DATABASE_URL` — Postgres. Probado sobre Supabase.
- `WDK_USDT_CONTRACT` — el contrato de USD₮ en Sepolia. **Verificado, nunca
  inventado.**

`WDK_DRY_RUN=1` levanta la interfaz sin CLI, con balance simulado y
transferencias deshabilitadas. Sirve para desarrollar la UI; **la demo se graba
con `0`**.

### Preparar la billetera

```bash
npx wdk wallet create --name wip-treasury      # guarda la seed phrase
npx wdk wallet unlock --name wip-treasury --ttl 0
npx wdk get address --network sepolia --wallet wip-treasury --json
```

La passphrase se pide por consola y queda en un daemon de sesión. **Nunca entra
al código ni al `.env`**: el wrapper no la ve, ni por argumento ni por variable
de entorno. Un argumento, además, quedaría visible en la lista de procesos.

Pon la dirección resultante en `WDK_TREASURY_ADDRESS`, fondéala con ETH de
Sepolia para gas, y consigue USD₮ de testnet.

### Verificar la integración con WDK

```bash
npm run wdk:check
npm run wdk:check -- --send 1 0xDIRECCION   # transferencia real
```

---

## Arquitectura

```
   Web UI ──► Next.js API Routes ──► Rules Engine ──► WDK CLI ──► Sepolia
                       │
                       └──► Prisma ──► Postgres
```

Una sola fuente de verdad: toda la lógica —parseo, reglas, WDK, persistencia—
vive en las rutas API. Nada de lógica duplicada en el cliente.

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript estricto |
| Estilos | Tailwind CSS 4 |
| Base de datos | Postgres vía Prisma 7 |
| Motor cripto | `@tetherto/wdk-cli` como proceso hijo |
| Validación | `zod` |
| Gráficas | `recharts` |

### Endpoints

| Ruta | Método | Qué hace |
|---|---|---|
| `/api/payments/request` | POST | Parsea → evalúa → crea el `Payment` con su `decisionLog` → si es automático ejecuta y devuelve `txHash` |
| `/api/payments/[id]/approve` | POST | Registra el voto → si se juntaron las aprobaciones, re-valida 5–8 y ejecuta |
| `/api/payments` | GET | Historial con filtro por estado, incluye `decisionLog` |
| `/api/treasury` | GET | Dirección, **balance on-chain real**, gastado del mes, pendientes |
| `/api/rules` | GET / PUT | Leer y editar el reglamento (PUT solo `ADMIN`) |
| `/api/members` | GET | Miembros con dirección y si están en lista blanca |

---

## Escalabilidad

**Técnica — qué aguanta hoy y qué cambiaría.** Hoy es un proceso Next.js contra
un Postgres. El cuello de botella real no es la base sino el CLI: cada operación
levanta un proceso. Para volumen, el camino es el SDK (`@tetherto/wdk`) en
proceso, o una cola con un worker que serialice las transferencias por
tesorería — lo que además evita carreras de doble gasto. El motor de reglas es
una función pura, así que se mueve a un worker, a un servicio o a un cliente MCP
sin tocarlo. Multi-tesorería ya está en el modelo de datos: `Treasury` es una
entidad de primera clase, no un singleton. Y multi-cadena es donde WDK paga
solo: la misma lógica de reglas sirve sobre Bitcoin, Lightning, Solana, TON o
TRON cambiando el módulo de billetera, sin reescribir el producto.

**De producto — a quién le sirve.** Empieza en el caso más chico y más doloroso:
3 a 10 personas con un fondo común y cero infraestructura financiera. Startups
pre-banco, cooperativas, colectivos, equipos remotos que pagan a freelancers en
varios países. El siguiente escalón son tesorerías de comunidad y DAOs chicas,
que hoy usan multisig on-chain: rígida, cara y hostil para quien no sabe de
cripto. WIP da el mismo control con reglas expresivas y una interfaz que
cualquiera entiende. El modelo de negocio no cobra por mover dinero —eso ya es
casi gratis— sino por **el registro auditable y el control de gasto**: gratis
hasta 3 miembros, tarifa plana por grupo, y un plan superior con exportación
contable y retención de auditoría. El foso no es el código: es el reglamento
acumulado y el historial.

**Los límites, con honestidad.** Esto es un prototipo de fin de semana. Para
producción faltaría: autenticación real, custodia con hardware o MPC, firma en
dispositivo por miembro, límites por rol más finos que ADMIN/MEMBER, y un
proceso de recuperación de billetera.

---

## Estado

- [x] Modelo de datos y persistencia
- [x] Wrapper de WDK con las 4 funciones
- [x] Parser de lenguaje natural
- [x] Motor de reglas con los 9 chequeos + 15 tests
- [x] Las 6 rutas API
- [x] Interfaz: dashboard, solicitud con `decisionLog` animado, detalle, reglamento
- [ ] Fondeo real y `txHash` verificado en Etherscan
- [ ] Video de demo
