import { Dashboard } from '@/components/dashboard'

/**
 * La sesión de Privy vive en el cliente, así que el guardián está dentro del
 * panel: si no hay identidad, redirige a /login.
 */
export default function Page() {
  return <Dashboard />
}
