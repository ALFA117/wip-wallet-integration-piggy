import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { RulesEditor } from '@/components/rules-editor'

export default async function Page() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return <RulesEditor />
}
