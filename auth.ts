/**
 * Autenticación con Google.
 *
 * La sesión solo sirve para saber de quién es cada alcancía. WIP no autentica a
 * los miembros del grupo —esos siguen siendo el selector de la barra superior,
 * que es lo que permite grabar el flujo de varias firmas sin coordinar a
 * nadie—; autentica al dueño del espacio de pruebas.
 */

import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'

import { prisma } from '@/lib/prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: 'database' },
  pages: { signIn: '/login' },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
})
