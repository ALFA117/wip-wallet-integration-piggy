/**
 * El motor de reglas. Determinista, sin IA, sin acceso a red ni a base de datos.
 *
 * `evaluate` es una función pura sobre (request, rules, state): las mismas
 * entradas dan siempre la misma decisión. Eso la hace testeable de verdad y
 * permite moverla a un worker, a un servicio o a un cliente MCP sin tocarla.
 *
 * El parser propone; este archivo dispone.
 */

export type DecisionPath = 'AUTO' | 'MULTI_SIG' | 'ADMIN_ONLY' | 'REJECTED'

export type CheckName =
  | 'beneficiary_resolvable'
  | 'beneficiary_in_allowlist'
  | 'not_self_payment'
  | 'amount_valid'
  | 'max_single_tx'
  | 'daily_limit'
  | 'monthly_budget'
  | 'onchain_balance'
  | 'approval_tier'

export interface CheckStep {
  check: CheckName
  passed: boolean
  detail: string
}

export interface RuleSet {
  autoApproveUnder: number
  requireApprovals: number
  adminOnlyOver: number
  monthlyBudget: number
  dailyLimit: number
  maxSingleTx: number
  allowlistCsv: string
}

export interface EvaluationRequest {
  amount: number
  toEmail: string
  requestedByEmail: string
}

export interface TreasuryState {
  /** Beneficiario resuelto contra la tabla User, o null si no existe. */
  beneficiary: { email: string; walletAddress: string } | null
  /** Suma de pagos en SUCCESS y EXECUTING de hoy. Nunca cuenta rechazados. */
  spentToday: number
  /** Suma de pagos en SUCCESS y EXECUTING del mes en curso. */
  spentThisMonth: number
  /** Balance real leído del CLI. Nunca de la base de datos. */
  onchainBalance: number
}

export interface Evaluation {
  decision: DecisionPath
  decisionLog: CheckStep[]
  rejectReason?: string
  /** Aprobaciones distintas al solicitante que hacen falta. 0 si es AUTO. */
  approvalsNeeded: number
  /** true si al menos una de esas aprobaciones tiene que ser de un ADMIN. */
  adminRequired: boolean
}

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function parseAllowlist(csv: string): string[] {
  return csv
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Los 9 chequeos, en este orden exacto. El primero que falla corta la
 * evaluación: el `decisionLog` termina en el chequeo que falló, y eso es
 * precisamente lo que la UI muestra en rojo.
 */
export function evaluate(
  request: EvaluationRequest,
  rules: RuleSet,
  state: TreasuryState,
): Evaluation {
  const log: CheckStep[] = []
  const amount = request.amount
  const toEmail = request.toEmail.trim().toLowerCase()
  const fromEmail = request.requestedByEmail.trim().toLowerCase()

  const reject = (reason: string): Evaluation => ({
    decision: 'REJECTED',
    decisionLog: log,
    rejectReason: reason,
    approvalsNeeded: 0,
    adminRequired: false,
  })

  // 1 — El beneficiario existe y tiene dirección para recibir.
  if (!state.beneficiary || !state.beneficiary.walletAddress) {
    log.push({
      check: 'beneficiary_resolvable',
      passed: false,
      detail: `${toEmail} no existe o no tiene dirección registrada`,
    })
    return reject(`No conozco a ${toEmail}`)
  }
  log.push({
    check: 'beneficiary_resolvable',
    passed: true,
    detail: `${toEmail} → ${state.beneficiary.walletAddress.slice(0, 10)}…`,
  })

  // 2 — Está en la lista blanca del reglamento.
  const allowlist = parseAllowlist(rules.allowlistCsv)
  if (!allowlist.includes(toEmail)) {
    log.push({
      check: 'beneficiary_in_allowlist',
      passed: false,
      detail: `${toEmail} no está en la lista blanca`,
    })
    return reject(`${toEmail} no está en la lista blanca del reglamento`)
  }
  log.push({
    check: 'beneficiary_in_allowlist',
    passed: true,
    detail: `${toEmail} está en la lista blanca`,
  })

  // 3 — Quien pide no es quien recibe.
  if (toEmail === fromEmail) {
    log.push({
      check: 'not_self_payment',
      passed: false,
      detail: 'el solicitante es el beneficiario',
    })
    return reject('No puedes pagarte a ti mismo')
  }
  log.push({
    check: 'not_self_payment',
    passed: true,
    detail: `${fromEmail} ≠ ${toEmail}`,
  })

  // 4 — Número positivo, finito, máximo 2 decimales.
  const hasTwoDecimalsMax = Number.isInteger(Math.round(amount * 100))
    && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-9
  if (!Number.isFinite(amount) || amount <= 0 || !hasTwoDecimalsMax) {
    log.push({
      check: 'amount_valid',
      passed: false,
      detail: `${amount} no es un monto válido`,
    })
    return reject('El monto tiene que ser positivo y con dos decimales como máximo')
  }
  log.push({ check: 'amount_valid', passed: true, detail: `${money(amount)} es un monto válido` })

  // 5 — Tope duro por transacción.
  if (amount > rules.maxSingleTx) {
    log.push({
      check: 'max_single_tx',
      passed: false,
      detail: `${money(amount)} supera el tope por transacción de ${money(rules.maxSingleTx)}`,
    })
    return reject(`Supera el tope por transacción (${money(rules.maxSingleTx)})`)
  }
  log.push({
    check: 'max_single_tx',
    passed: true,
    detail: `${money(amount)} ≤ ${money(rules.maxSingleTx)}`,
  })

  // 6 — Lo ejecutado hoy más este monto.
  if (state.spentToday + amount > rules.dailyLimit) {
    log.push({
      check: 'daily_limit',
      passed: false,
      detail: `${money(amount)} + ${money(state.spentToday)} gastados hoy supera ${money(rules.dailyLimit)}`,
    })
    return reject(`Supera el tope diario (${money(rules.dailyLimit)})`)
  }
  log.push({
    check: 'daily_limit',
    passed: true,
    detail: `${money(amount)} + ${money(state.spentToday)} gastados hoy ≤ ${money(rules.dailyLimit)}`,
  })

  // 7 — Lo ejecutado este mes más este monto.
  if (state.spentThisMonth + amount > rules.monthlyBudget) {
    log.push({
      check: 'monthly_budget',
      passed: false,
      detail: `${money(amount)} + ${money(state.spentThisMonth)} este mes supera ${money(rules.monthlyBudget)}`,
    })
    return reject(`Supera el presupuesto mensual (${money(rules.monthlyBudget)})`)
  }
  log.push({
    check: 'monthly_budget',
    passed: true,
    detail: `${money(amount)} + ${money(state.spentThisMonth)} este mes ≤ ${money(rules.monthlyBudget)}`,
  })

  // 8 — El balance real leído del CLI alcanza.
  if (state.onchainBalance < amount) {
    log.push({
      check: 'onchain_balance',
      passed: false,
      detail: `balance real ${money(state.onchainBalance)} USD₮ < ${money(amount)}`,
    })
    return reject('La alcancía no tiene fondos suficientes')
  }
  log.push({
    check: 'onchain_balance',
    passed: true,
    detail: `balance real ${money(state.onchainBalance)} USD₮ ≥ ${money(amount)}`,
  })

  // 9 — La vía de aprobación.
  if (amount <= rules.autoApproveUnder) {
    log.push({
      check: 'approval_tier',
      passed: true,
      detail: `${money(amount)} ≤ ${money(rules.autoApproveUnder)} → automático`,
    })
    return { decision: 'AUTO', decisionLog: log, approvalsNeeded: 0, adminRequired: false }
  }

  if (amount > rules.adminOnlyOver) {
    log.push({
      check: 'approval_tier',
      passed: true,
      detail: `${money(amount)} > ${money(rules.adminOnlyOver)} → requiere un administrador`,
    })
    return { decision: 'ADMIN_ONLY', decisionLog: log, approvalsNeeded: 1, adminRequired: true }
  }

  log.push({
    check: 'approval_tier',
    passed: true,
    detail: `${money(amount)} entre ${money(rules.autoApproveUnder)} y ${money(rules.adminOnlyOver)} → ${rules.requireApprovals} aprobaciones`,
  })
  return {
    decision: 'MULTI_SIG',
    decisionLog: log,
    approvalsNeeded: rules.requireApprovals,
    adminRequired: false,
  }
}

// ---------------------------------------------------------------------------
// Invariantes de aprobación
// ---------------------------------------------------------------------------

export interface ApprovalVote {
  approverEmail: string
  approverRole: string
  approved: boolean
}

export type ApprovalOutcome =
  | { status: 'PENDING_APPROVAL'; remaining: number }
  | { status: 'APPROVED' }
  | { status: 'REJECTED'; reason: string }

/**
 * Quien pide un pago no puede aprobarlo. Se comprueba aquí y en la ruta API,
 * no solo escondiendo el botón en la UI.
 */
export function canVote(
  voterEmail: string,
  requesterEmail: string,
  alreadyVoted: string[],
): { allowed: boolean; reason?: string } {
  const voter = voterEmail.trim().toLowerCase()
  if (voter === requesterEmail.trim().toLowerCase()) {
    return { allowed: false, reason: 'Quien solicita un pago no puede aprobarlo' }
  }
  if (alreadyVoted.map((e) => e.trim().toLowerCase()).includes(voter)) {
    return { allowed: false, reason: 'Ya votaste sobre este pago' }
  }
  return { allowed: true }
}

/**
 * Estado de un pago pendiente dados sus votos.
 * Un solo veto lo manda a REJECTED de inmediato.
 */
export function resolveApprovals(
  votes: ApprovalVote[],
  needed: number,
  adminRequired: boolean,
): ApprovalOutcome {
  const veto = votes.find((vote) => !vote.approved)
  if (veto) {
    return { status: 'REJECTED', reason: `${veto.approverEmail} vetó el pago` }
  }

  const approvals = votes.filter((vote) => vote.approved)

  if (adminRequired) {
    const hasAdmin = approvals.some((vote) => vote.approverRole === 'ADMIN')
    if (!hasAdmin) return { status: 'PENDING_APPROVAL', remaining: 1 }
    return { status: 'APPROVED' }
  }

  if (approvals.length < needed) {
    return { status: 'PENDING_APPROVAL', remaining: needed - approvals.length }
  }
  return { status: 'APPROVED' }
}
