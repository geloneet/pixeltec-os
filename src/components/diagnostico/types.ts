export interface WizardAnswers {
  companyType: string;
  problems: string[];
  companySize: string;
  priority: string;
  name: string;
  email: string;
  phone: string;
  empresa: string;
  consent: boolean;
  /** Honeypot — debe llegar vacío. */
  website: string;
}

export const DEFAULT_WIZARD_ANSWERS: WizardAnswers = {
  companyType: '',
  problems: [],
  companySize: '',
  priority: '',
  name: '',
  email: '',
  phone: '',
  empresa: '',
  consent: false,
  website: '',
};

export interface StepProps {
  answers: WizardAnswers;
  update: (updates: Partial<WizardAnswers>) => void;
  onNext: () => void;
}
