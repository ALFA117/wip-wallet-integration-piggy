import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // El CLI (db push, migrate) usa la conexión en modo sesión: el pooler en
    // modo transacción no soporta bien el DDL. En runtime, lib/prisma.ts usa
    // DATABASE_URL a través del adapter.
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
})
