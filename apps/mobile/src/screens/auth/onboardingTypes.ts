export interface OnboardingFormData {
  phone: string;
  gender: 'male' | 'female' | null;
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
  phone: '',
  gender: null,
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
