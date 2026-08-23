-- Cierra la Data API de Supabase sobre las tablas de WIP.
--
-- Por qué hace falta: con RLS desactivado, cualquiera que tenga la URL del
-- proyecto y la publishable key puede leer y escribir estas tablas por la API
-- REST (PostgREST). La publishable key está pensada para ir en el cliente, así
-- que se asume pública — lo que la protege es RLS, no el secreto de la llave.
--
-- Por qué no rompe la app: WIP no usa la Data API. Se conecta por Postgres
-- directo con Prisma usando el rol `postgres`, que hace BYPASSRLS. Activar RLS
-- sin políticas deja la puerta REST cerrada y la app funcionando igual.
--
-- Cómo aplicarlo: SQL Editor > New query > pega esto > Run.

ALTER TABLE public."User"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Treasury" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Rule"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Approval" ENABLE ROW LEVEL SECURITY;

-- Sin políticas: anon y authenticated no pueden hacer nada.
-- Cuando el proyecto tenga autenticación real, las políticas se escriben aquí.

-- Verificación: las cinco tablas deben salir con rowsecurity = true.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
