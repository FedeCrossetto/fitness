export interface OnboardingFormData {
  firstName: string;
  lastName: string;
  country: string;
  city: string;
  postalCode: string;
  street: string;
  streetNumber: string;
  apartment: string;
  birthDate: string;
  phoneCode: string;
  /** cca2 del país elegido para el código de teléfono (ej. "US"). Varios países
   * comparten el mismo `phoneCode` (+1 = EE.UU./Canadá/Rep. Dominicana/...), así
   * que solo el código no alcanza para saber cuál mostrar seleccionado. */
  phoneCountryCca2: string;
  phone: string;
  gender: 'male' | 'female' | 'other' | null;
  genderOther: string;
  shareBodyLater: boolean;
  weightKg: string;
  heightCm: string;
  goals: string[];
  level: string | null;
  exerciseHabit: string | null;
  weeklyFrequency: string | null;
  availableDays: string[];
  equipment: string[];
  injuries: string;
  comments: string;
}

export const EMPTY_ONBOARDING: OnboardingFormData = {
  firstName: '',
  lastName: '',
  country: '',
  city: '',
  postalCode: '',
  street: '',
  streetNumber: '',
  apartment: '',
  birthDate: '',
  phoneCode: '+54',
  phoneCountryCca2: 'AR',
  phone: '',
  gender: null,
  genderOther: '',
  shareBodyLater: false,
  weightKg: '',
  heightCm: '',
  goals: [],
  level: null,
  exerciseHabit: null,
  weeklyFrequency: null,
  availableDays: [],
  equipment: [],
  injuries: '',
  comments: '',
};
