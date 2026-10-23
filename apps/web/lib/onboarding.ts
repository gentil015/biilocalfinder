import { ProviderOnboardingStep } from './api';

// Single source of truth for "where does this step live"
export function onboardingStepPath(step: ProviderOnboardingStep): string {
  switch (step) {
    case 'TYPE_SELECTION':
      return '/provider/onboarding';
    case 'PROFILE_DETAILS':
      return '/provider/onboarding/profile';
    case 'SERVICES_SETUP':
    case 'VERIFICATION':
      return '/provider/onboarding/services';
    case 'COMPLETED':
      return '/provider/dashboard';
    default:
      return '/provider/onboarding';
  }
}
