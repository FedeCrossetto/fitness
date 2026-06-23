# OAuth — handoff al entrenador (Reset Fit)

**Titular del producto:** `pmenosvmas@gmail.com`  
Todas las cuentas de publicación y login social deben estar a nombre del entrenador, no del desarrollador.

El código ya soporta Google (activo) y Apple (preparado, apagado hasta configurar).

---

## Qué tiene cada uno

| Responsable | Qué gestiona |
|-------------|--------------|
| **Entrenador** (`pmenosvmas@gmail.com`) | Apple Developer Program, App Store Connect, Google Cloud (consent screen), titular Supabase (ideal) |
| **Desarrollador** | Código, Vercel (puente OAuth), despliegues técnicos |

---

## Estado actual

- **Google:** funciona en iPhone y Android.
- **Apple:** botón oculto (`EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=false`) hasta que completes los pasos de abajo.
- **Email/contraseña:** funciona siempre.

---

## Cuando el entrenador pague Apple Developer (USD 99/año)

### 1. Inscribirse con el Apple ID correcto

1. Ir a [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll).
2. Usar **pmenosvmas@gmail.com** (o el Apple ID vinculado a ese correo).
3. Esperar aprobación (horas a ~48 h).

### 2. Identifiers (Apple Developer)

**App ID** — `com.fedecrossetto.resetfitness`  
Activar **Sign In with Apple** → *Enable as a primary App ID*.

**Services ID** — crear `com.fedecrossetto.resetfitness.auth`  
Sign In with Apple → Configure:

- **Domain:** `lddadlaqvvqelbftvgpd.supabase.co`
- **Return URL:** `https://lddadlaqvvqelbftvgpd.supabase.co/auth/v1/callback`

**Key** — crear key con Sign In with Apple, descargar `.p8`, anotar **Key ID**.

Avisar al dev el **Team ID** nuevo (aparece arriba a la derecha en el portal; reemplaza al actual en builds iOS).

### 3. Supabase → Authentication → Providers → Apple

| Campo | Valor |
|-------|--------|
| Enable | ON |
| Services ID | `com.fedecrossetto.resetfitness.auth` |
| Team ID | (el del portal, post-inscripción) |
| Key ID | (10 caracteres) |
| Secret Key | contenido del `.p8` |

### 4. Redirect URLs (Supabase → URL Configuration)

Deben existir:

```
https://reset-fitness.vercel.app/auth/mobile-callback
https://reset-fitness.vercel.app/auth/callback
reset-fitness://auth/callback
```

### 5. Activar en la app

El dev setea en `.env` / EAS:

```
EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true
```

Rebuild de la app → el botón Apple aparece en iPhone.

---

## Google (Android + iPhone)

El consent screen y el email de soporte en [Google Cloud Console](https://console.cloud.google.com) deben ser **pmenosvmas@gmail.com**.

Redirect URI del cliente **Web** (para Supabase):

```
https://lddadlaqvvqelbftvgpd.supabase.co/auth/v1/callback
```

Cliente **Android**: package `com.fedecrossetto.resetfitness` + SHA-1 del keystore de release.

---

## Supabase (recomendado)

Transferir ownership del proyecto al entrenador o agregar `pmenosvmas@gmail.com` como **Owner** en Organization Settings, para que las claves OAuth no dependan del dev.

---

## Checklist rápido

- [ ] Apple Developer Program activo con `pmenosvmas@gmail.com`
- [ ] Services ID + Key `.p8` configurados
- [ ] Apple provider ON en Supabase
- [ ] Google consent email = entrenador
- [ ] `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true` + nuevo build
- [ ] (Opcional futuro) Cambiar bundle ID a dominio del entrenador al publicar en stores
