/**
 * Los 5 casos de aceptación del motor de reglas.
 * Es el único lugar del proyecto con tests, y es el que demuestra el rigor.
 *
 *   npm test
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canVote,
  evaluate,
  resolveApprovals,
  type RuleSet,
  type TreasuryState,
} from './rules.ts'
import { parseIntent, ParseError } from './parse.ts'

const RULES: RuleSet = {
  autoApproveUnder: 100,
  requireApprovals: 2,
  adminOnlyOver: 500,
  monthlyBudget: 5000,
  dailyLimit: 1000,
  maxSingleTx: 2000,
  allowlistCsv: 'sofia@wip.demo,juan@wip.demo,maria@wip.demo,carlos@wip.demo',
}

const state = (over: Partial<TreasuryState> = {}): TreasuryState => ({
  beneficiary: { email: 'maria@wip.demo', walletAddress: '0x' + 'a'.repeat(40) },
  spentToday: 0,
  spentThisMonth: 2300,
  onchainBalance: 4820,
  ...over,
})

describe('motor de reglas', () => {
  it('caso 1 — $50 a un miembro en lista blanca se auto-aprueba', () => {
    const result = evaluate(
      { amount: 50, toEmail: 'maria@wip.demo', requestedByEmail: 'juan@wip.demo' },
      RULES,
      state(),
    )

    assert.equal(result.decision, 'AUTO')
    assert.equal(result.approvalsNeeded, 0)
    assert.equal(result.decisionLog.length, 9, 'corre los 9 chequeos')
    assert.ok(result.decisionLog.every((step) => step.passed))
  })

  it('caso 2 — $400 exige 2 aprobaciones y se ejecuta al juntarlas', () => {
    const result = evaluate(
      { amount: 400, toEmail: 'maria@wip.demo', requestedByEmail: 'juan@wip.demo' },
      RULES,
      state(),
    )

    assert.equal(result.decision, 'MULTI_SIG')
    assert.equal(result.approvalsNeeded, 2)

    // Con una sola aprobación sigue pendiente.
    const parcial = resolveApprovals(
      [{ approverEmail: 'sofia@wip.demo', approverRole: 'ADMIN', approved: true }],
      result.approvalsNeeded,
      result.adminRequired,
    )
    assert.deepEqual(parcial, { status: 'PENDING_APPROVAL', remaining: 1 })

    // Con las dos, queda aprobado.
    const completo = resolveApprovals(
      [
        { approverEmail: 'sofia@wip.demo', approverRole: 'ADMIN', approved: true },
        { approverEmail: 'carlos@wip.demo', approverRole: 'MEMBER', approved: true },
      ],
      result.approvalsNeeded,
      result.adminRequired,
    )
    assert.deepEqual(completo, { status: 'APPROVED' })
  })

  it('caso 3 — $3,000 se rechaza por max_single_tx y no genera transacción', () => {
    const result = evaluate(
      { amount: 3000, toEmail: 'maria@wip.demo', requestedByEmail: 'juan@wip.demo' },
      RULES,
      state(),
    )

    assert.equal(result.decision, 'REJECTED')

    const last = result.decisionLog.at(-1)!
    assert.equal(last.check, 'max_single_tx')
    assert.equal(last.passed, false)

    // La evaluación corta ahí: no llega a mirar el balance on-chain.
    assert.ok(!result.decisionLog.some((step) => step.check === 'onchain_balance'))
  })

  it('caso 4 — un beneficiario fuera de la lista blanca se rechaza en el chequeo 2', () => {
    const result = evaluate(
      { amount: 50, toEmail: 'ajeno@otro.com', requestedByEmail: 'juan@wip.demo' },
      RULES,
      state({ beneficiary: { email: 'ajeno@otro.com', walletAddress: '0x' + 'b'.repeat(40) } }),
    )

    assert.equal(result.decision, 'REJECTED')
    assert.equal(result.decisionLog.length, 2)
    assert.equal(result.decisionLog[1].check, 'beneficiary_in_allowlist')
    assert.equal(result.decisionLog[1].passed, false)
  })

  it('caso 5 — quien pide no puede aprobar su propio pago', () => {
    const propio = canVote('juan@wip.demo', 'juan@wip.demo', [])
    assert.equal(propio.allowed, false)
    assert.match(propio.reason!, /no puede aprobarlo/i)

    // Otro miembro sí puede.
    assert.equal(canVote('sofia@wip.demo', 'juan@wip.demo', []).allowed, true)

    // Pero solo una vez.
    assert.equal(canVote('sofia@wip.demo', 'juan@wip.demo', ['sofia@wip.demo']).allowed, false)

    // Y un pago a uno mismo ni siquiera llega a la etapa de aprobación.
    const auto = evaluate(
      { amount: 50, toEmail: 'juan@wip.demo', requestedByEmail: 'juan@wip.demo' },
      RULES,
      state({ beneficiary: { email: 'juan@wip.demo', walletAddress: '0x' + 'c'.repeat(40) } }),
    )
    assert.equal(auto.decision, 'REJECTED')
    assert.equal(auto.decisionLog.at(-1)!.check, 'not_self_payment')
  })
})

describe('invariantes adicionales', () => {
  it('un solo veto rechaza el pago aunque ya haya aprobaciones', () => {
    const outcome = resolveApprovals(
      [
        { approverEmail: 'sofia@wip.demo', approverRole: 'ADMIN', approved: true },
        { approverEmail: 'carlos@wip.demo', approverRole: 'MEMBER', approved: false },
      ],
      2,
      false,
    )
    assert.equal(outcome.status, 'REJECTED')
  })

  it('sobre el tope de admin, dos miembros no bastan: hace falta un ADMIN', () => {
    const result = evaluate(
      { amount: 800, toEmail: 'maria@wip.demo', requestedByEmail: 'juan@wip.demo' },
      RULES,
      state({ spentToday: 0, spentThisMonth: 0 }),
    )
    assert.equal(result.decision, 'ADMIN_ONLY')
    assert.equal(result.adminRequired, true)

    const soloMiembros = resolveApprovals(
      [
        { approverEmail: 'carlos@wip.demo', approverRole: 'MEMBER', approved: true },
        { approverEmail: 'maria@wip.demo', approverRole: 'MEMBER', approved: true },
      ],
      result.approvalsNeeded,
      result.adminRequired,
    )
    assert.equal(soloMiembros.status, 'PENDING_APPROVAL')

    const conAdmin = resolveApprovals(
      [{ approverEmail: 'sofia@wip.demo', approverRole: 'ADMIN', approved: true }],
      result.approvalsNeeded,
      result.adminRequired,
    )
    assert.equal(conAdmin.status, 'APPROVED')
  })

  it('el presupuesto mensual corta aunque el monto quepa en el tope por transacción', () => {
    const result = evaluate(
      { amount: 900, toEmail: 'maria@wip.demo', requestedByEmail: 'juan@wip.demo' },
      RULES,
      state({ spentThisMonth: 4500 }),
    )
    assert.equal(result.decision, 'REJECTED')
    assert.equal(result.decisionLog.at(-1)!.check, 'monthly_budget')
  })

  it('el balance real del CLI puede bloquear un pago que las reglas permiten', () => {
    const result = evaluate(
      { amount: 900, toEmail: 'maria@wip.demo', requestedByEmail: 'juan@wip.demo' },
      RULES,
      state({ spentThisMonth: 0, onchainBalance: 100 }),
    )
    assert.equal(result.decision, 'REJECTED')
    assert.equal(result.decisionLog.at(-1)!.check, 'onchain_balance')
  })
})

describe('parser', () => {
  const members = [
    { email: 'sofia@wip.demo', name: 'Sofía Ramírez' },
    { email: 'juan@wip.demo', name: 'Juan Pérez' },
  ]

  it('extrae monto, beneficiario y motivo de una frase natural', () => {
    const intent = parseIntent('paga $50 a juan@wip.demo por el café de la oficina', members)
    assert.equal(intent.amount, 50)
    assert.equal(intent.toEmail, 'juan@wip.demo')
    assert.match(intent.reason, /café/i)
  })

  it('entiende montos con coma y decimales', () => {
    const intent = parseIntent('transfiere $1,250.50 a sofia@wip.demo por el servidor', members)
    assert.equal(intent.amount, 1250.5)
  })

  it('resuelve un nombre contra los miembros conocidos', () => {
    const intent = parseIntent('paga $80 a Sofía por el dominio', members)
    assert.equal(intent.toEmail, 'sofia@wip.demo')
  })

  it('pide reformular en vez de adivinar cuando hay dos montos', () => {
    assert.throws(
      () => parseIntent('paga $50 o $80 a juan@wip.demo por el café', members),
      ParseError,
    )
  })

  it('pide reformular cuando no hay beneficiario', () => {
    assert.throws(() => parseIntent('paga $50 por el café', members), ParseError)
  })

  it('no confunde un número suelto con un monto', () => {
    assert.throws(() => parseIntent('paga la factura 2024 a juan@wip.demo', members), ParseError)
  })
})
