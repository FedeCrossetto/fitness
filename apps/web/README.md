# Habito · Panel del entrenador (web)

Panel de administración web para entrenadores. Comparte tipos y cliente Supabase
con la app mobile a través de `packages/shared`.

## Stack

- Vite 5 + React 18 + TypeScript
- React Router 6
- Supabase JS (mismo proyecto que el mobile)

## Puesta en marcha

```bash
cd apps/web
cp .env.example .env.local   # completá VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:5173
```

> El `VITE_SUPABASE_ANON_KEY` es la **anon key** del proyecto Supabase
> (Settings → API). No uses la service_role key en el frontend.

## Acceso

El login usa email/contraseña de Supabase Auth. Solo entran cuentas con
`profiles.role = 'trainer'` o `'admin'`; el resto ve una pantalla "Sin acceso".
La seguridad real la imponen las RLS del backend, no el frontend.

## Estructura

```
src/
  lib/supabase.ts      → cliente (usa la fábrica de @habito/shared)
  hooks/useAuth.tsx    → sesión + perfil + guard de rol
  components/Layout.tsx→ shell con sidebar
  pages/
    Login.tsx
    Dashboard.tsx      → métricas resumen
    Branding.tsx       → editor de marca (trainer_branding)
    Students.tsx       → tabla de alumnos vinculados
    Routines.tsx       → placeholder (editor de rutinas, próximamente)
```

## Notas

- Los tipos de la base viven en `packages/shared/src/types/database.ts`
  (fuente única, compartida con el mobile).
- Esta app es **aditiva**: no modifica la app mobile. La migración de la app
  Expo a `apps/mobile` (monorepo completo con workspaces) es un paso posterior.
