import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { Dashboard } from '@/components/dashboard'

export default async function Page() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return <Dashboard />
}
