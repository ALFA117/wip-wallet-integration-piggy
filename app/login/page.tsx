import { redirect } from 'next/navigation'

import { auth, signIn } from '@/auth'
import { Button, Card } from '@/components/ui'

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect('/')

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-8">
        <div>
          <p className="eyebrow">WIP · Wallet Integration Piggy</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink text-balance">
            La alcancía del grupo, con un guardián que no se puede sobornar.
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
            Un agente con billetera propia valida cada pago contra un reglamento que el
            grupo escribe por adelantado. Si una regla no se cumple, no hay transferencia.
          </p>
        </div>

        <Card className="flex flex-col gap-5 p-6">
          <div>
            <h2 className="text-sm font-semibold text-ink">Pruébalo con tu propia alcancía</h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
              Entra y recibes una tesorería tuya en la testnet de Sepolia, con cuatro
              integrantes y un reglamento por defecto. Un botón la fondea con USD₮ de
              prueba y ya puedes pedir pagos.
            </p>
          </div>

          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: '/' })
            }}
          >
            <Button type="submit" className="w-full">
              Entrar con Google
            </Button>
          </form>

          <p className="text-xs leading-relaxed text-faint">
            Solo se usa tu correo para separar tu alcancía de la de los demás. Todo ocurre
            en una red de pruebas: el dinero no tiene valor.
          </p>
        </Card>

        <div className="flex flex-col gap-2 text-xs text-faint">
          <p className="font-medium text-muted">Lo que vas a poder hacer:</p>
          <ul className="flex flex-col gap-1.5">
            <li>
              Pedir un pago escribiendo <span className="text-ink">“paga $50 a juan@wip.demo
              por el café”</span> y ver los nueve chequeos correr uno a uno.
            </li>
            <li>Comprobar el hash de cada transferencia en Etherscan.</li>
            <li>Intentar un pago de $3 000 y ver por qué el agente se niega.</li>
            <li>Aprobar un pago con dos firmas, cambiando de integrante.</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
