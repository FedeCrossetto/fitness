export interface EvaluationFormData {
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  city: string;
  phoneCode: string;
  phoneCountryCca2: string;
  phone: string;
  gender: 'male' | 'female' | 'other' | null;
  genderOther: string;
  shareBodyLater: boolean;
  weightKg: string;
  heightCm: string;
  mainGoal: string | null;
  situation: string;
  acceptedTerms: boolean;
}

export const EMPTY_EVALUATION: EvaluationFormData = {
  firstName: '',
  lastName: '',
  email: '',
  country: '',
  city: '',
  phoneCode: '+54',
  phoneCountryCca2: 'AR',
  phone: '',
  gender: null,
  genderOther: '',
  shareBodyLater: false,
  weightKg: '',
  heightCm: '',
  mainGoal: null,
  situation: '',
  acceptedTerms: false,
};

export const EVALUATION_GOALS = [
  'Bajar de peso',
  'Ganar masa muscular',
  'Mejorar hábitos',
  'Recomposición corporal',
  'Otro',
] as const;
