/**
 * Shim de @react-native-community/datetimepicker.
 *
 * No viene incluido en Expo Go (necesita dev client), y un import estático
 * puede explotar ahí. Se carga con require dinámico dentro de try/catch; si
 * no está disponible, `DateTimePicker` queda en null y quien lo use debe caer
 * a un selector propio. En una build nativa carga el componente real.
 */

type DateTimePickerModule = typeof import('@react-native-community/datetimepicker');

let mod: DateTimePickerModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('@react-native-community/datetimepicker') as DateTimePickerModule;
} catch {
  mod = null;
}

export const DateTimePicker = mod?.default ?? null;
export const nativeDatePickerAvailable = mod !== null;
