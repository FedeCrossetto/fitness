# Contexto para implementar pantallas de Habito

App móvil de fitness (Expo SDK 56 + React Native + React 19 + TypeScript strict). Idioma del producto: ESPAÑOL (es-AR), copy claro, motivador, premium. Estética minimalista deportiva: fondo negro #0C0C0C, acento verde lima #BEFC50, tipografía Inter.

## Reglas obligatorias

1. **TypeScript strict** con `noUnusedLocals` y `noUnusedParameters`: no dejar imports ni variables sin usar.
2. **Cero colores/valores mágicos**: usar SIEMPRE los tokens de `src/theme` (`colors`, `spacing`, `radius`, `typography`, `layout`, `shadows`, `illustrations`).
3. **Texto SIEMPRE con `<AppText variant=... color=...>`** (nunca `<Text>` directo).
4. Toda pantalla con datos remotos debe contemplar 4 estados: **cargando** (Skeleton/CardSkeleton), **error** (`ErrorState` con onRetry), **vacío** (`EmptyState` con la mascota del pilar) y **con datos**.
5. Las pantallas dentro de tabs deben dejar padding inferior `layout.tabBarHeight + spacing.xxl` para no quedar tapadas por la tab bar flotante.
6. Pantallas con header propio: usar `useSafeAreaInsets()` y `paddingTop: insets.top + spacing.md`. Para volver atrás: `IconButton icon="chevron-back"`.
7. Listas largas: `FlatList` (virtualizada). Imágenes: `expo-image` (`Image` con `contentFit`).
8. Feedback háptico (`src/lib/haptics`): `hapticSuccess()` al completar acciones importantes, `hapticTap()` en CTAs (el componente Button ya lo hace).
9. Toasts: `useUiStore.getState().showToast('success'|'error'|'info', 'mensaje')`.
10. Exportar cada pantalla como **named export function** (ej: `export function ProgramScreen(...)`) — los navigators ya las importan así (ver `src/navigation/stacks.tsx`).
11. Tipar props de navegación con `NativeStackScreenProps<XStackParamList, 'ScreenName'>` desde `src/types/navigation.ts`.
12. Íconos: `Ionicons` de `@expo/vector-icons`, estilo outline.
13. No usar librerías que no estén en package.json.

## Archivos que DEBÉS leer antes de codear

- `src/theme/colors.ts`, `src/theme/typography.ts`, `src/theme/spacing.ts`, `src/theme/illustrations.ts`
- `src/components/common/index.ts` y los componentes que vayas a usar
- `src/types/navigation.ts` y `src/types/database.ts`
- Los stores de tu dominio en `src/stores/`
- `src/screens/home/HomeScreen.tsx` como referencia de patrón/estilo
- `src/navigation/stacks.tsx` (rutas y nombres exactos)

## APIs clave de componentes comunes (src/components/common)

- `AppText`: props `variant` (h1..h3, body17/16/14/13/12 [+Medium/SemiBold], caps14..caps11, metricLarge/Medium/Small), `color`, `align`.
- `Button`: `label, onPress, variant('primary'|'secondary'|'ghost'), size('md'|'lg'), icon, loading, disabled, fullWidth, style`.
- `IconButton`: `icon, onPress, accessibilityLabel, size, color, backgroundColor, style`.
- `Card`: `children, onPress?, elevated?, style`.
- `MetricCard`: `label, value, unit?, delta?, deltaPositive?, icon?, accent?, onPress?, size('medium'|'large'), style`.
- `ProgressRing`: `progress(0..1), size, strokeWidth, color, children` (children van centrados).
- `ProgressBar`: `progress(0..1), height, color, style`.
- `Input`: `label, error, icon, containerStyle` + TextInputProps.
- `Chip`: `label, active, onPress`.
- `SectionHeader`: `title, actionLabel?, onAction?`.
- `Avatar`: `name?, imageUrl?, size`.
- `SegmentedTabs`: `tabs(string[]), activeIndex, onChange`.
- `BottomSheet`: `visible, onClose, title?, children`.
- `EmptyState`: `pillar('training'|'nutrition'|'progress'|'generic'), title, message, actionLabel?, onAction?, compact?`.
- `ErrorState`: `message, onRetry?`.
- `Skeleton`/`CardSkeleton`, `ToastHost` (ya montado en App).
- `ProgressiveBlurHeader`: `title, scrollY(SharedValue), leftSlot?, rightSlot?` — usar con `Animated.ScrollView` + `useAnimatedScrollHandler`.
- Gráficos: `LineChart` en `src/components/charts/LineChart.tsx` (`data: {label,value}[], height, width, color, formatValue`).

## Datos

- Sesión: `useAuthStore((s) => s.session)` → `session.user.id`.
- Supabase client: `src/lib/supabase.ts` (tipado con Database).
- Fechas: helpers en `src/lib/dates.ts` (`todayISO`, `formatLongDate`, `formatDuration`, etc).
- Config white-label: `src/config/clientConfig.ts`.
