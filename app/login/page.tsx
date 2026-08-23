'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { ArrowRight, Check, ShieldCheck, X } from 'lucide-react'

import { Button, Card, Skeleton } from '@/components/ui'
import { Logo } from '@/components/logo'

export default function LoginPage() {
  const { ready, authenticated, login } = usePrivy()
  const router = useRouter()

  useEffect(() => {
    if (ready && authenticated) router.replace('/')
  }, [ready, authenticated, router])

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-12">
      <Backdrop />

      <div className="relative flex w-full max-w-lg flex-col gap-8">
        <header className="rise-in flex flex-col gap-5">
          <Logo className="h-11 w-auto" />
          <div>
            <h1 className="text-[1.75rem] font-bold leading-[1.15] tracking-tight text-ink text-balance">
              La alcancía del grupo, con un guardián que no se puede sobornar.
            </h1>
            <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-muted">
              Un agente con billetera propia valida cada pago contra un reglamento que
              el grupo escribe por adelantado. Si una regla no se cumple, no hay
              transferencia.
            </p>
          </div>
        </header>

        <Card
          className="rise-in flex flex-col gap-5 p-6"
          style={{ animationDelay: '80ms' }}
        >
          <div>
            <h2 className="text-sm font-semibold text-ink">Pruébalo con tu propia alcancía</h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
              Entra y recibes una tesorería tuya en la testnet de Sepolia, con cuatro
              integrantes y un reglamento. Un botón la fondea y ya puedes pedir pagos.
            </p>
          </div>

          {!ready ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Button onClick={login} className="w-full gap-2">
              Entrar
              <ArrowRight size={15} />
            </Button>
          )}

          <p className="flex items-start gap-2 text-xs leading-relaxed text-faint">
            <ShieldCheck size={14} className="mt-px shrink-0 text-teal" />
            <span>
              Con Google, correo o tu billetera. Solo se usa para separar tu alcancía de
              la de los demás. Todo ocurre en una red de pruebas: el dinero no vale nada.
            </span>
          </p>
        </Card>

        <section
          className="rise-in flex flex-col gap-3"
          style={{ animationDelay: '160ms' }}
        >
          <p className="eyebrow">Lo que vas a poder hacer</p>
          <ul className="flex flex-col gap-2.5">
            <Item ok>
              Escribir <Quote>paga $50 a juan@wip.demo por el café</Quote> y ver los nueve
              chequeos correr uno a uno.
            </Item>
            <Item ok>Comprobar el hash de cada transferencia en Etherscan.</Item>
            <Item ok>Aprobar un pago con dos firmas, cambiando de integrante.</Item>
            <Item>
              Pedir <Quote>$3,000</Quote> y ver al agente negarse, con el motivo exacto.
            </Item>
          </ul>
        </section>
      </div>
    </main>
  )
}

function Item({ children, ok = false }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-[0.8125rem] leading-relaxed text-muted">
      <span
        className={
          ok
            ? 'mt-0.5 flex size-[17px] shrink-0 items-center justify-center rounded-full bg-ok-wash text-ok'
            : 'mt-0.5 flex size-[17px] shrink-0 items-center justify-center rounded-full bg-bad-wash text-bad'
        }
        aria-hidden
      >
        {ok ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </li>
  )
}

function Quote({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-ink">“{children}”</span>
}

/**
 * Fondo: dos manchas de color, una por cada tono de la marca, solapadas donde
 * se cruzan igual que en el logotipo. Muy tenue, para que la página respire sin
 * competir con el texto.
 */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -left-32 -top-40 size-[34rem] rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'var(--brand-navy)' }}
      />
      <div
        className="absolute -bottom-48 -right-32 size-[30rem] rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'var(--brand-teal)' }}
      />
    </div>
  )
}
