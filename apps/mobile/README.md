# Reset Fit

App móvil de fitness/coaching multi-cliente (white-label) con 3 pilares — **Entrenamiento**, **Nutrición** y **Progreso/Salud** — más capa social (comunidad), relación cliente–coach (rutinas, mensajería), metas diarias, logros/rachas y suscripciones con Mercado Pago.

Stack: **Expo SDK 56 · React Native 0.85 · React 19 · TypeScript strict · React Navigation v7 · Zustand · Supabase**.

---

## Supuestos y decisiones por defecto

- **Nombre comercial**: "Reset Fit" (configurable por cliente en `src/config/clientConfig.ts`, junto con módulos activos, copy y defaults de negocio).
- **Idioma**: español (es-AR) por defecto; los strings están centralizados en pantallas/config con arquitectura lista para extraer a i18n.
- **Mascota 3D**: se usan las ilustraciones provistas por el cliente (`assets/mascot/`), recortadas por pose desde los sprite sheets originales con `scripts/crop_mascot.py`.
- **Fechas de datos diarios** (`date` en DB): fecha local del dispositivo (helpers en `src/lib/dates.ts`); timestamps en UTC.
- **Offline**: caché stale-while-revalidate con AsyncStorage para datos del día (`src/lib/cache.ts`). La sesión de entrenamiento en vivo persiste en AsyncStorage y sobrevive a cierres de la app.
- **Comunidad**: la UI usa datos de demostración locales (no hay tablas sociales en el esquema de referencia); lista para conectar a backend.
- **Apple HealthKit** (`react-native-health`) y **expo-speech-recognition** requieren *development build* (no funcionan en Expo Go); la app degrada con elegancia si no están disponibles.
- **Pagos**: Checkout Pro de Mercado Pago vía Edge Function (`mp-create-preference`); el webhook `mp-webhook` activa la suscripción. El access token de MP vive SOLO en secrets del backend.
- **Seguridad**: el cliente usa únicamente la anon key; RLS estricta en todas las tablas; helper `private.is_admin()` (security definer en schema no expuesto) para políticas de admin.
- El **panel admin/coach** opera contra el mismo backend vía políticas RLS de admin (panel externo o Supabase Studio); la app móvil es para el cliente.

---

## Setup

### 1. Dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key (NUNCA la service_role) |

### 3. Base de datos (orden de migraciones)

Ejecutar los archivos de `supabase/migrations/` **en orden numérico** (SQL Editor o `supabase db push`):

1. `0001_core_identity.sql` — helpers, profiles/user_profiles, trigger de registro
2. `0002_goals.sql` — metas (templates, asignaciones, diarias)
3. `0003_training.sql` — logs + catálogo de entrenamiento
4. `0004_nutrition.sql` — alimentos + diario de comidas
5. `0005_health_progress.sql` — hidratación, medidas, fotos
6. `0006_push_subscriptions.sql` — push tokens, planes, suscripciones
7. `0007_coach.sql` — rutinas asignadas + mensajería (realtime)
8. `0008_functions.sql` — RPCs de metas
9. `0009_seeds.sql` — seeds (metas, planes, programa demo)
10. `0010_storage.sql` — buckets + políticas de Storage

Todas las migraciones son idempotentes (se pueden re-ejecutar).

### 4. Edge Functions

```bash
supabase secrets set MP_ACCESS_TOKEN=<token-mercado-pago> APP_BASE_URL=<url-base>
supabase functions deploy mp-create-preference
supabase functions deploy mp-webhook --no-verify-jwt
supabase functions deploy push-goal-completed --no-verify-jwt
```

- Configurar en Mercado Pago la URL del webhook: `https://<proyecto>.supabase.co/functions/v1/mp-webhook`.
- Para push de metas: crear un **Database Webhook** (Dashboard → Database → Webhooks) sobre `UPDATE` de `public.daily_goals` apuntando a `push-goal-completed`.

### 5. OAuth (Apple / Google)

Habilitar los providers en Supabase Auth y agregar el redirect `reset-fitness://` a *Redirect URLs*.

### 6. Correr la app

> La app usa módulos nativos propios (`expo-dev-client`, HealthKit, reconocimiento de voz) y **no corre en Expo Go**. Siempre se necesita un *development build*.

#### Opción A — Simulador iOS (sin cable, solo Mac)

Requisito: Xcode instalado con al menos un simulador descargado.

```bash
# Desde la raíz del monorepo:
npm run dev

# O desde apps/mobile:
npm run dev
```

La primera vez compila el nativo (~3-5 min) e instala la app en el simulador automáticamente. Las siguientes veces, si el simulador ya tiene la app instalada, podés arrancar solo el servidor JS:

```bash
npm run metro
```

Los cambios en código JS/TS se reflejan solos al guardar (Fast Refresh). No hace falta reiniciar.

---

#### Opción B — iPhone físico (con cable USB)

**Requisitos previos (una sola vez):**

1. **Conectar el iPhone por cable USB** a la Mac.
2. En el iPhone: desbloquearlo y tocar **"Confiar en este ordenador"** cuando aparezca el diálogo.
3. En la Mac, abrir **Xcode → Settings → Accounts** y verificar que tu Apple ID esté agregado (no hace falta cuenta paga, sirve una gratuita).
4. En el iPhone: ir a **Ajustes → General → VPN y gestión de dispositivos** y confiar en el certificado de tu Apple ID (aparece después del primer build).

**Correr:**

```bash
# Desde la raíz del monorepo:
npm run dev:device

# O desde apps/mobile:
npm run dev:device
```

Seleccioná tu iPhone de la lista que aparece en la terminal. Expo compila, firma e instala la app por cable. Una vez instalada, las próximas veces podés conectarte por WiFi (misma red) sin cable:

```bash
npm run metro    # solo el servidor JS, el iPhone se conecta por WiFi
```

**Si el iPhone no aparece en la lista:**
- Asegurate de que el cable transmita datos (no solo carga).
- En Xcode → Window → Devices and Simulators verificá que aparezca el dispositivo.
- Destrabá el iPhone antes de correr el comando.

---

#### Opción C — iPhone físico ya instalado (sin cable, uso diario)

Una vez que la app está instalada en el iPhone (via Opción B), el flujo diario es:

**Requisito:** Mac e iPhone en la **misma red WiFi**.

```bash
# Desde la raíz del monorepo:
npm run metro
```

Abrís la app Reset Fit en el iPhone → se conecta sola al servidor Metro de la Mac → carga el JS. Si ves "No development servers found":
- Verificá que Mac e iPhone estén en la misma WiFi.
- Asegurate de que `npm run metro` esté corriendo en la terminal.
- Agitá el iPhone o cerrá y volvé a abrir la app.

---

#### Checklist de inicio rápido (uso diario)

Cada vez que querés trabajar en la app:

```
1. Abrir terminal en la raíz del monorepo (/Desktop/Repos/habito)
2. npm run metro
3. Abrir Reset Fit en el iPhone o en el simulador
4. Listo — los cambios en código se reflejan solos al guardar
```

Si el simulador está cerrado → lo abre Expo solo cuando corrés `npm run dev`.
Si la app no está instalada en el iPhone → `npm run dev:device` con el cable.

---

#### Resumen de comandos

| Comando | Cuándo usarlo |
|---|---|
| `npm run dev` | Primera vez o después de cambiar deps nativas — simulador |
| `npm run dev:device` | Primera vez en iPhone físico (requiere cable USB) |
| `npm run metro` | **Uso diario**: arranca el servidor JS, app ya instalada |
| `npm run dev:android` | Emulador o dispositivo Android conectado |

---

## Calidad

```bash
npx tsc --noEmit   # 0 errores
npx eslint .       # 0 errores
```

## Estructura

```
src/
  config/clientConfig.ts    # white-label: branding, módulos, defaults
  theme/                    # design tokens (colors, typography, spacing, illustrations)
  components/common/        # design system (Button, Card, MetricCard, ProgressRing, ...)
  components/charts/        # LineChart SVG
  lib/                      # supabase client, cache SWR, fechas, haptics
  services/                 # OFF, pagos, push, salud, pasos, storage, rachas
  stores/                   # Zustand: auth, training, nutrition, progress, goals, ui
  navigation/               # Root, tabs con FAB central, AddMenuOverlay
  screens/                  # auth, home, training, nutrition, progress, goals,
                            # community, profile, subscription, coach, achievements
supabase/
  migrations/               # SQL idempotente con RLS
  functions/                # mp-create-preference, mp-webhook, push-goal-completed
assets/mascot/              # ilustraciones 3D de la mascota (provistas por el cliente)
```

## Atribuciones

- Datos de productos alimenticios: **© Open Food Facts** — licencia ODbL (atribuido también en la UI).
