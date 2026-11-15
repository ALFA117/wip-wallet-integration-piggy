'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { usePrivy } from '@privy-io/react-auth'

import {
  Button,
  Card,
  Field,
  Input,
  OfflineState,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui'
import { AuthGate } from '@/components/auth-gate'
import { RuleBands } from '@/components/rule-bands'
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
  const [saved, setSaved] = useState<RuleDTO | null>(null)
  const [members, setMembers] = useState<MemberDTO[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const { logout } = usePrivy()

  useEffect(() => {
    async function load() {
      try {
        const [rulesData, membersData] = await Promise.all([
          api.get<{ rules: RuleDTO }>('/api/rules'),
          api.get<{ members: MemberDTO[] }>('/api/members'),
        ])

        setRules(rulesData.rules)
        setSaved(rulesData.rules)
        setMembers(membersData.members)

        const stored = window.localStorage.getItem(CURRENT_USER_KEY)
        const exists = membersData.members.some((m) => m.id === stored)
        setCurrentUserId(exists ? stored! : (membersData.members[0]?.id ?? ''))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause))
        try {
          const status = (await fetch('/api/status', { cache: 'no-store' }).then((r) => r.json())) as {
            database?: boolean
          }
          setOffline(status.database === false)
        } catch {
          setOffline(false)
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const currentUser = members.find((member) => member.id === currentUserId) ?? null
  const isAdmin = currentUser?.role === 'ADMIN'

  /**
   * ¿Hay cambios sin guardar?
   *
   * Sin esto, el botón "Guardar" está siempre activo y no hay forma de saber si
   * lo que se ve en pantalla es lo que rige de verdad. Que además se pueda
   * descartar evita tener que recargar para volver atrás.
   */
  const dirty =
    rules !== null &&
    saved !== null &&
    (['autoApproveUnder', 'requireApprovals', 'adminOnlyOver', 'monthlyBudget', 'dailyLimit', 'maxSingleTx', 'allowlistCsv'] as const).some(
      (key) => String(rules[key]) !== String(saved[key]),
    )

  function update<K extends keyof RuleDTO>(key: K, value: RuleDTO[K]) {
    setRules((previous) => (previous ? { ...previous, [key]: value } : previous))
  }

  function discard() {
    setRules(saved)
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
      setSaved(data.rules)
      toast.success('Reglamento actualizado')
    } catch (cause) {
      toast.error(String(cause))
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <OfflineState
        offline={offline}
        detail={error}
        onRetry={() => window.location.reload()}
        onLogout={logout}
      />
    )
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line-strong bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
          <Link
            href="/app"
            className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius)] px-2 text-sm font-semibold text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <ArrowLeft size={16} aria-hidden />
            Alcancía
          </Link>
          <Select
            aria-label="Usuario activo"
            value={currentUserId}
            onChange={(event) => setCurrentUserId(event.target.value)}
            className="ml-auto min-w-0 max-w-[60%] py-0 text-sm sm:w-auto sm:max-w-none"
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

      <main
        id="contenido"
        className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10"
      >
        <div className="border-b border-line pb-5">
          <h1 className="display text-[clamp(1.75rem,4vw,2.25rem)] leading-tight text-ink">
            Reglamento
          </h1>
          <p className="mt-1.5 text-base text-muted">
            El contrato social que el agente no puede romper.
          </p>
        </div>

        {loading || !rules ? (
          <Card className="flex flex-col gap-4 p-5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </Card>
        ) : (
          <>
            <Card className="flex flex-col gap-5 p-5 sm:p-6">
              <div>
                <h2 className="text-base font-semibold text-ink">Qué pasa con cada monto</h2>
                <p className="mt-1 text-sm text-muted">
                  Cambia los topes de abajo y esta franja se mueve contigo.
                </p>
              </div>
              <RuleBands rules={rules} />
              <p className="border-t border-line pt-4 text-base leading-relaxed text-muted">
                {prose(rules)}
              </p>
            </Card>

            <Card className="flex flex-col gap-6 p-5 sm:p-6">
              <div>
                <h2 className="text-base font-semibold text-ink">Topes</h2>
                <p className="mt-1 text-sm text-muted">Montos en USD₮ de prueba.</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
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

              <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-relaxed text-muted">
                  {!isAdmin ? (
                    `${currentUser?.name.split(' ')[0] ?? 'Este integrante'} puede leer el reglamento, pero solo un administrador lo edita.`
                  ) : dirty ? (
                    <span className="font-medium text-warn">
                      Tienes cambios sin guardar.
                    </span>
                  ) : (
                    'Los cambios aplican a las solicitudes nuevas, no a las que ya están en curso.'
                  )}
                </p>
                <div className="flex shrink-0 gap-2">
                  {dirty ? (
                    <Button variant="ghost" onClick={discard} disabled={saving}>
                      Descartar
                    </Button>
                  ) : null}
                  <Button
                    onClick={save}
                    disabled={!isAdmin || saving || !dirty}
                    className="min-w-28 justify-center"
                  >
                    {saving ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado'}
                  </Button>
                </div>
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
