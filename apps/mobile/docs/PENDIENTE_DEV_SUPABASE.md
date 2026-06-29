# Pendiente: configuración Dev / Supabase / Vercel

> Tareas que requieren acceso al dashboard de Supabase, a Vercel y al `.env`.
> El código de la app ya está listo para todas — solo falta la config externa.
> Última actualización: 2026-06-28

---

## 1. Confirmación de cuenta por código (OTP de 6 dígitos) — **NUEVO**

Cuando un usuario crea cuenta, la app lo manda a una pantalla para ingresar un
código de 6 dígitos. Para que ese código llegue por mail hay que:

### a) Activar confirmación de email
`Authentication → Sign In / Providers → Email` → activar **"Confirm email"**.

> Si está desactivado, Supabase crea la sesión al instante y la pantalla de
> código nunca aparece.

### b) Cambiar el template para que envíe el código (no un link)
`Authentication → Emails → Templates → "Confirm signup"` → reemplazar el cuerpo por:

```html
<h2>Confirmá tu cuenta</h2>
<p>Tu código de confirmación es:</p>
<p><strong style="font-size:28px; letter-spacing:6px;">{{ .Token }}</strong></p>
<p>Ingresalo en la app para activar tu cuenta. Vence en 1 hora.</p>
```

La clave es **`{{ .Token }}`** (código random de 6 dígitos). El template por
defecto trae `{{ .ConfirmationURL }}` (un link) — por eso hoy no llega ningún código.

---

## 2. Reseteo de contraseña en Expo Go — **deploy web + redirect URL**

El link de "olvidé mi contraseña" abre una página puente en Vercel que reenvía a
la app. Ya se actualizó el código de esa página para soportar Expo Go, pero falta:

### a) Deployar el web a Vercel
```bash
cd apps/web
npx vercel --prod
```
Esto publica el cambio de `src/pages/AuthMobileCallback.tsx` (botones "Abrir en
Expo Go" / "Abrir en app instalada").

### b) Agregar la URL de Expo Go en Supabase
`Authentication → URL Configuration → Redirect URLs` → agregar:
```
exp+reset-fitness://auth/callback
```
(dejar también las que ya están: `https://reset-fitness.vercel.app/auth/mobile-callback`,
`https://reset-fitness.vercel.app/auth/callback`, `reset-fitness://auth/callback`)

---

## 3. Login con Apple — **solo para producción**

El botón de Apple ya aparece en iOS pero está **deshabilitado a propósito**
(Apple no funciona en Expo Go). Para activarlo en producción:

### a) Configurar el proveedor Apple en Supabase
`Authentication → Sign In / Providers → Apple` → completar con los datos del
Apple Developer (ver `docs/TRAINER_OAUTH_SETUP.md`).

### b) Activar el flag en el `.env`
```
EXPO_PUBLIC_APPLE_SIGN_IN_READY=true
```
(el flag `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true` ya está puesto — ese solo
muestra el botón; `_READY` lo hace funcional.)

---

## Checklist rápido

- [ ] Supabase: activar "Confirm email"
- [ ] Supabase: template "Confirm signup" con `{{ .Token }}`
- [ ] Vercel: `npx vercel --prod` desde `apps/web`
- [ ] Supabase: agregar `exp+reset-fitness://auth/callback` a Redirect URLs
- [ ] (Prod) Supabase: configurar proveedor Apple
- [ ] (Prod) `.env`: `EXPO_PUBLIC_APPLE_SIGN_IN_READY=true`
