'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Card, Field, Input, Select, Skeleton, Textarea } from '@/components/ui'
import { AuthGate } from '@/components/auth-gate'
import { api } from '@/lib/api'
import { money } from '@/lib/utils'
import type { MemberDTO, RuleDTO } from '@/lib/types'

const CURRENT_USER_KEY = 'wip.currentUserId'

export function RulesEditor() {
  return (
    <AuthGate>
      <RulesEditorInner />
    </AuthGate>
  )
}

function RulesEditorInner() {
  const [rules, setRules] = useState<RuleDTO | null>(null)
  const [members, setMembers] = useState<MemberDTO[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [rulesData, membersData] = await Promise.all([
          api.get<{ rules: RuleDTO }>('/api/rules'),
          api.get<{ members: MemberDTO[] }>('/api/members'),
        ])

        setRules(rulesData.rules)
        setMembers(membersData.members)

        const stored = window.localStorage.getItem(CURRENT_USER_KEY)
        const exists = membersData.members.some((m) => m.id === stored)
        setCurrentUserId(exists ? stored! : (membersData.members[0]?.id ?? ''))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const currentUser = members.find((member) => member.id === currentUserId) ?? null
  const isAdmin = currentUser?.role === 'ADMIN'

  function update<K extends keyof RuleDTO>(key: K, value: RuleDTO[K]) {
    setRules((previous) => (previous ? { ...previous, [key]: value } : previous))
  }

  async function save() {
    if (!rules || !currentUser) return
    setSaving(true)
    try {
      const data = await api.put<{ rules: RuleDTO }>('/api/rules', {
        actorId: currentUser.id,
        autoApproveUnder: Number(rules.autoApproveUnder),
        requireApprovals: Number(rules.requireApprovals),
        adminOnlyOver: Number(rules.adminOnlyOver),
        monthlyBudget: Number(rules.monthlyBudget),
        dailyLimit: Number(rules.dailyLimit),
        maxSingleTx: Number(rules.maxSingleTx),
        allowlistCsv: rules.allowlistCsv,
      })
      setRules(data.rules)
      toast.success('Reglamento actualizado')
    } catch (cause) {
      toast.error(String(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-2 py-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <ArrowLeft size={14} />
            Alcancía
          </Link>
          <Select
            aria-label="Usuario activo"
            value={currentUserId}
            onChange={(event) => setCurrentUserId(event.target.value)}
            className="ml-auto h-9 min-w-0 max-w-[55%] py-0 text-[0.8125rem] sm:w-auto sm:max-w-none"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.role === 'ADMIN' ? ' · admin' : ''}
              </option>
            ))}
          </Select>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Reglamento</h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            El contrato social que el agente no puede romper.
          </p>
        </div>

        {error ? (
          <Card className="border-bad/30 p-4 text-[0.8125rem] text-bad">{error}</Card>
        ) : null}

        {loading || !rules ? (
          <Card className="flex flex-col gap-4 p-5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </Card>
        ) : (
          <>
            <Card className="border-accent/25 bg-accent-wash px-5 py-4">
              <p className="eyebrow">En una frase</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{prose(rules)}</p>
            </Card>

            <Card className="flex flex-col gap-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Se ejecuta solo hasta" hint="Pagos de este monto o menos, sin votos.">
                  <Input
                    type="number"
                    min="1"
                    disabled={!isAdmin}
                    value={rules.autoApproveUnder}
                    onChange={(event) => update('autoApproveUnder', Number(event.target.value))}
                  />
                </Field>
                <Field label="Aprobaciones en la banda media" hint="Personas distintas a quien pide.">
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    disabled={!isAdmin}
                    value={rules.requireApprovals}
                    onChange={(event) => update('requireApprovals', Number(event.target.value))}
                  />
                </Field>
                <Field label="Exige administrador sobre" hint="Por encima de esto, un miembro no basta.">
                  <Input
                    type="number"
                    min="1"
                    disabled={!isAdmin}
                    value={rules.adminOnlyOver}
                    onChange={(event) => update('adminOnlyOver', Number(event.target.value))}
                  />
                </Field>
                <Field label="Tope duro por transacción" hint="Nada lo supera, con votos o sin ellos.">
                  <Input
                    type="number"
                    min="1"
                    disabled={!isAdmin}
                    value={rules.maxSingleTx}
                    onChange={(event) => update('maxSingleTx', Number(event.target.value))}
                  />
                </Field>
                <Field label="Tope diario">
                  <Input
                    type="number"
                    min="1"
                    disabled={!isAdmin}
                    value={rules.dailyLimit}
                    onChange={(event) => update('dailyLimit', Number(event.target.value))}
                  />
                </Field>
                <Field label="Presupuesto mensual">
                  <Input
                    type="number"
                    min="1"
                    disabled={!isAdmin}
                    value={rules.monthlyBudget}
                    onChange={(event) => update('monthlyBudget', Number(event.target.value))}
                  />
                </Field>
              </div>

              <Field
                label="Lista blanca"
                hint="Correos separados por coma. Solo estas personas pueden recibir un pago."
              >
                <Textarea
                  rows={3}
                  disabled={!isAdmin}
                  value={rules.allowlistCsv}
                  onChange={(event) => update('allowlistCsv', event.target.value)}
                />
              </Field>

              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted">
                  {isAdmin
                    ? 'Los cambios aplican a las solicitudes nuevas.'
                    : `${currentUser?.name ?? 'Este miembro'} puede leer el reglamento, pero solo un administrador lo edita.`}
                </p>
                <Button onClick={save} disabled={!isAdmin || saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </Card>
          </>
        )}
      </main>
    </>
  )
}

/** El resumen en prosa. Se deriva del formulario, así que nunca se desincroniza. */
function prose(rules: RuleDTO): string {
  const members = rules.allowlistCsv.split(',').filter(Boolean).length
  return (
    `Los pagos de hasta ${money(rules.autoApproveUnder)} se ejecutan automáticamente. ` +
    `Entre ${money(rules.autoApproveUnder)} y ${money(rules.adminOnlyOver)} necesitan ` +
    `${rules.requireApprovals} aprobaciones de personas distintas a quien los pide. ` +
    `Sobre ${money(rules.adminOnlyOver)}, tiene que aprobarlos un administrador. ` +
    `Ninguna transferencia supera ${money(rules.maxSingleTx)}, ni ${money(rules.dailyLimit)} en un día, ` +
    `ni ${money(rules.monthlyBudget)} en el mes. ` +
    `Solo ${members} ${members === 1 ? 'persona puede' : 'personas pueden'} recibir pagos.`
  )
}
