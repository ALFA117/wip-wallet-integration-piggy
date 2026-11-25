# WIP · Detalle técnico

Notas técnicas que antes vivían en el README principal. Volver al [README](../README.md).

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

## Despliegue y billetera

### Los dos backends de billetera

El wrapper del CLI lanza un proceso hijo, lo que sirve en una máquina pero no en
serverless, donde no hay binario. Por eso hay dos implementaciones, ambas con
paquetes oficiales de WDK:

| Archivo | Paquete | Cómo corre | Dónde |
|---|---|---|---|
| [`lib/wdk.ts`](../lib/wdk.ts) | `@tetherto/wdk-cli` | proceso hijo | local |
| [`lib/wdk-sdk.ts`](../lib/wdk-sdk.ts) | `@tetherto/wdk-wallet-evm` | en proceso | local y desplegado |

El SDK además expone `quoteTransfer`, que estima la comisión antes de firmar —
la parte de *"quotes"* que el track menciona y que el CLI no ofrece.

**Custodia en la versión desplegada.** Una sola seed maestra vive en una
variable de entorno del servidor y de ella se deriva una cuenta por usuario con
su índice BIP-44. La base de datos guarda el índice, nunca una frase semilla. Es
un modelo custodial, apropiado para una demo en testnet donde el dinero no vale
nada, y se declara como tal aquí en vez de disimularlo.

### Variables de entorno

Todas están documentadas en [`.env.example`](../.env.example). Las dos que
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

## API


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
