'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePrivy } from '@privy-io/react-auth'
import { ArrowUpRight, LogOut, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button, Card, EmptyState, PathBadge, Select, Skeleton, StatusBadge } from '@/components/ui'
import { RequestDialog } from '@/components/request-dialog'
import { PaymentDetail } from '@/components/payment-detail'
import { FundingCard } from '@/components/funding-card'
import { AuthGate } from '@/components/auth-gate'
import { Logo } from '@/components/logo'
import { api } from '@/lib/api'
import { cn, formatDate, money, shortAddress, shortHash } from '@/lib/utils'
import type { MemberDTO, PaymentDTO, TreasuryDTO } from '@/lib/types'

const EXPLORER_BASE = 'https://sepolia.etherscan.io/tx/'
const CURRENT_USER_KEY = 'wip.currentUserId'

export function Dashboard() {
  return (
    <AuthGate>
      <DashboardInner />
    </AuthGate>
  )
}

function DashboardInner() {
  const [treasury, setTreasury] = useState<TreasuryDTO | null>(null)
  const [members, setMembers] = useState<MemberDTO[]>([])
  const [payments, setPayments] = useState<PaymentDTO[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [detail, setDetail] = useState<PaymentDTO | null>(null)
  const [voting, setVoting] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      // La primera visita crea la alcancía en el servidor, así que estas tres
      // llamadas no son independientes de verdad: van juntas a propósito para
      // que el panel no se pinte a medias.
      const [treasuryData, membersData, paymentsData] = await Promise.all([
        api.get<TreasuryDTO>('/api/treasury'),
        api.get<{ members: MemberDTO[] }>('/api/members'),
        api.get<{ payments: PaymentDTO[] }>('/api/payments?limit=60'),
      ])

      setTreasury(treasuryData)
      setMembers(membersData.members)
      setPayments(paymentsData.payments)
      setLoadError(null)

      setCurrentUserId((previous) => {
        if (previous) return previous
        const stored = window.localStorage.getItem(CURRENT_USER_KEY)
        const exists = membersData.members.some((m) => m.id === stored)
        return exists ? stored! : (membersData.members[0]?.id ?? '')
      })
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (currentUserId) window.localStorage.setItem(CURRENT_USER_KEY, currentUserId)
  }, [currentUserId])

  const currentUser = useMemo(
    () => members.find((member) => member.id === currentUserId) ?? null,
    [members, currentUserId],
  )

  /** Pendientes sobre los que el usuario activo puede votar. */
  const votable = useMemo(
    () =>
      payments.filter(
        (payment) =>
          payment.status === 'PENDING_APPROVAL' &&
          payment.requestedBy.id !== currentUserId &&
          !payment.approvals.some((approval) => approval.approver.id === currentUserId) &&
          (!payment.adminRequired || currentUser?.role === 'ADMIN'),
      ),
    [payments, currentUserId, currentUser],
  )

  async function vote(paymentId: string, approved: boolean) {
    if (!currentUser) return
    setVoting(paymentId)
    try {
      const data = await api.post<{
        status: string
        txHash?: string
        rejectReason?: string
        errorMessage?: string
        remaining?: number
      }>(`/api/payments/${paymentId}/approve`, {
        approverId: currentUser.id,
        approved,
      })

      if (data.status === 'SUCCESS') toast.success(`Pago ejecutado · ${shortHash(data.txHash!)}`)
      else if (data.status === 'REJECTED') toast.error(data.rejectReason ?? 'Pago rechazado')
      else if (data.status === 'FAILED') toast.error(data.errorMessage ?? 'La transferencia falló')
      else if (data.status === 'PENDING_APPROVAL')
        toast.success(`Voto registrado · faltan ${data.remaining}`)

      await load()
    } catch (error) {
      toast.error(String(error))
    } finally {
      setVoting(null)
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-24">
        <Card className="border-bad/30 p-6">
          <h1 className="text-base font-semibold text-bad">No pude cargar la alcancía</h1>
          <p className="mt-2 text-[0.8125rem] text-muted">{loadError}</p>
          <p className="mt-4 text-[0.8125rem] text-muted">
            Revisa que <code className="hash">DATABASE_URL</code> apunte a tu base y que hayas
            corrido <code className="hash">npm run db:push</code> y{' '}
            <code className="hash">npm run seed</code>.
          </p>
        </Card>
      </main>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <Logo className="h-[22px] w-auto" />
            <span className="hidden border-l border-line pl-2.5 text-[0.8125rem] text-muted sm:inline">
              {treasury?.treasury.name ?? 'Alcancía'}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/rules"
              className="rounded-[var(--radius)] px-3 py-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              Reglamento
            </Link>

            {/* El selector cambia de integrante, no de cuenta: es lo que deja
                probar el flujo de varias firmas sin coordinar a nadie. */}
            <Select
              aria-label="Integrante activo"
              value={currentUserId}
              onChange={(event) => setCurrentUserId(event.target.value)}
              className="h-9 w-auto py-0 text-[0.8125rem]"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                  {member.role === 'ADMIN' ? ' · admin' : ''}
                </option>
              ))}
            </Select>

            <AccountButton email={treasury?.session?.email} name={treasury?.session?.name} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink">
              La alcancía del grupo
            </h1>
            <p className="mt-0.5 text-[0.8125rem] text-muted">
              Nadie es el tesorero. Un reglamento decide, y cada decisión queda escrita.
            </p>
          </div>
          <Button onClick={() => setRequestOpen(true)} disabled={!currentUser}>
            Solicitar pago
          </Button>
        </div>

        {treasury?.needsFunding ? (
          <FundingCard
            address={treasury.treasury.address}
            usdt={treasury.onchainBalance}
            eth={treasury.gasBalance}
            onFunded={load}
          />
        ) : null}

        {treasury?.balanceError ? (
          <Card className="flex items-start gap-3 border-bad/30 bg-bad-wash px-4 py-3">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-bad" />
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-semibold text-bad">
                No pude leer el balance del CLI
              </p>
              <pre className="hash mt-1 overflow-x-auto whitespace-pre-wrap text-muted">
                {treasury.balanceError}
              </pre>
            </div>
          </Card>
        ) : null}

        <Metrics treasury={treasury} loading={loading} />

        {votable.length > 0 ? (
          <PendingBand
            payments={votable}
            voting={voting}
            onVote={vote}
            onOpen={setDetail}
          />
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          <SpendChart treasury={treasury} loading={loading} />
          <ActivityTable payments={payments} loading={loading} onOpen={setDetail} />
        </div>
      </main>

      <RequestDialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        currentUser={currentUser}
        members={members}
        explorerBase={EXPLORER_BASE}
        onSettled={load}
      />
      <PaymentDetail
        payment={detail}
        explorerBase={EXPLORER_BASE}
        onClose={() => setDetail(null)}
      />
    </>
  )
}

// ---------------------------------------------------------------------------

/** Quién eres y cómo salir. Nada más: el resto de la barra es del producto. */
function AccountButton({ email, name }: { email?: string | null; name?: string | null }) {
  const { logout } = usePrivy()
  const initial = (name ?? email ?? '?').charAt(0).toUpperCase()

  return (
    <div className="ml-1 flex items-center gap-1.5">
      <span
        title={email ?? undefined}
        className="flex size-8 items-center justify-center rounded-full text-xs font-semibold"
        style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}
      >
        {initial}
      </span>
      <button
        onClick={logout}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="rounded-[var(--radius)] p-2 text-faint transition-colors hover:bg-sunken hover:text-ink"
      >
        <LogOut size={15} />
      </button>
    </div>
  )
}

function Metrics({ treasury, loading }: { treasury: TreasuryDTO | null; loading: boolean }) {
  const progress = treasury
    ? Math.min((treasury.spentThisMonth / treasury.monthlyBudget) * 100, 100)
    : 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric
        label="Balance on-chain"
        loading={loading}
        value={
          treasury?.onchainBalance === null
            ? 'No disponible'
            : `${money(treasury?.onchainBalance ?? 0, 2)}`
        }
        foot={
          treasury ? (
            <span className="hash text-faint">{shortAddress(treasury.treasury.address)}</span>
          ) : null
        }
      />
      <Metric
        label="Gastado este mes"
        loading={loading}
        value={money(treasury?.spentThisMonth ?? 0)}
        foot={
          treasury ? (
            <div className="flex flex-col gap-1.5">
              <div className="h-1 overflow-hidden rounded-full bg-sunken">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500',
                    progress > 85 ? 'bg-warn' : 'bg-accent',
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="tnum text-xs text-faint">
                de {money(treasury.monthlyBudget)} · quedan {money(treasury.available)}
              </span>
            </div>
          ) : null
        }
      />
      <Metric
        label="Pendientes de aprobación"
        loading={loading}
        value={String(treasury?.pendingCount ?? 0)}
      />
      <Metric
        label="Miembros"
        loading={loading}
        value={String(treasury?.memberCount ?? 0)}
      />
    </div>
  )
}

function Metric({
  label,
  value,
  foot,
  loading,
}: {
  label: string
  value: string
  foot?: React.ReactNode
  loading: boolean
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <p className="eyebrow">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <p className="tnum text-2xl font-semibold tracking-tight text-ink">{value}</p>
      )}
      {loading ? <Skeleton className="h-3 w-32" /> : foot}
    </Card>
  )
}

// ---------------------------------------------------------------------------

function PendingBand({
  payments,
  voting,
  onVote,
  onOpen,
}: {
  payments: PaymentDTO[]
  voting: string | null
  onVote: (id: string, approved: boolean) => void
  onOpen: (payment: PaymentDTO) => void
}) {
  return (
    <Card className="overflow-hidden border-warn/30">
      <header className="border-b border-line bg-warn-wash px-4 py-2.5">
        <p className="text-[0.8125rem] font-semibold text-warn">
          {payments.length === 1
            ? 'Un pago espera tu voto'
            : `${payments.length} pagos esperan tu voto`}
        </p>
      </header>
      <ul className="divide-y divide-line">
        {payments.map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <button
              onClick={() => onOpen(payment)}
              className="min-w-0 flex-1 text-left transition-opacity hover:opacity-70"
            >
              <p className="text-sm text-ink">
                <span className="tnum font-semibold">{money(payment.amount, 2)}</span> a{' '}
                {payment.toEmail}
              </p>
              <p className="truncate text-xs text-muted">
                {payment.requestedBy.name} · {payment.reason} · faltan{' '}
                {Math.max(payment.approvalsNeeded - payment.approvalsGiven, 0)}
              </p>
            </button>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                disabled={voting === payment.id}
                onClick={() => onVote(payment.id, false)}
              >
                Rechazar
              </Button>
              <Button
                size="sm"
                disabled={voting === payment.id}
                onClick={() => onVote(payment.id, true)}
              >
                {voting === payment.id ? 'Enviando…' : 'Aprobar'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ---------------------------------------------------------------------------

function SpendChart({ treasury, loading }: { treasury: TreasuryDTO | null; loading: boolean }) {
  const data = (treasury?.chart ?? []).map((point) => {
    const [year, month] = point.month.split('-')
    const date = new Date(Number(year), Number(month) - 1, 1)
    return { label: date.toLocaleDateString('es-MX', { month: 'short' }), amount: point.amount }
  })

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <p className="eyebrow">Gasto por mes</p>
        <p className="mt-0.5 text-[0.8125rem] text-muted">Últimos seis meses, en USD₮</p>
      </div>
      {loading ? (
        <Skeleton className="h-[180px] w-full" />
      ) : (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--ink-faint)', fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--ink-faint)', fontSize: 11 }}
                tickFormatter={(value: number) => (value >= 1000 ? `${value / 1000}k` : String(value))}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-sunken)' }}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                  color: 'var(--ink)',
                }}
                formatter={(value) => [money(Number(value)), 'Gastado']}
              />
              <Bar dataKey="amount" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------

function ActivityTable({
  payments,
  loading,
  onOpen,
}: {
  payments: PaymentDTO[]
  loading: boolean
  onOpen: (payment: PaymentDTO) => void
}) {
  return (
    <Card className="overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <p className="eyebrow">Actividad</p>
      </header>

      {loading ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          title="Todavía no hay movimientos"
          hint="Cuando alguien solicite un pago, aparecerá aquí con su rastro completo de decisiones."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line text-xs text-faint">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Solicitó</th>
                <th className="px-4 py-2 font-medium">Para</th>
                <th className="px-4 py-2 text-right font-medium">Monto</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Transacción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  onClick={() => onOpen(payment)}
                  className="cursor-pointer transition-colors hover:bg-sunken"
                >
                  <td className="tnum whitespace-nowrap px-4 py-2.5 text-muted">
                    {formatDate(payment.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-ink">{payment.requestedBy.name}</td>
                  <td className="max-w-[180px] truncate px-4 py-2.5 text-muted">
                    {payment.toEmail}
                  </td>
                  <td className="tnum whitespace-nowrap px-4 py-2.5 text-right font-semibold text-ink">
                    {money(payment.amount, 2)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={payment.status} />
                      <PathBadge path={payment.decisionPath} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {payment.txHash ? (
                      <a
                        href={`${EXPLORER_BASE}${payment.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="hash inline-flex items-center gap-1 text-accent underline underline-offset-2"
                      >
                        {shortHash(payment.txHash)}
                        <ArrowUpRight size={12} />
                      </a>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
