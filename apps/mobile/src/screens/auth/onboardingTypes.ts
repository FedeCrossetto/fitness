export interface OnboardingFormData {
  country: string;
  city: string;
  address: string;
  phoneCode: string;
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
  country: '',
  city: '',
  address: '',
  phoneCode: '+54',
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
